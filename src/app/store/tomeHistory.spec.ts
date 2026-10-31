import { TestBed } from '@angular/core/testing';
import { TomeHistory } from './tomeHistory';
import { CharactersStore } from './charactersStore';
import { DialoguesStore } from './dialoguesStore';
import { TOMES, TomeVault, VaultSync, VaultTome } from './tomeVault';
import { TOME_FORMAT, TomeError, describeChange, parseTomeFile } from '../domain/tome';

class MemoryVault {
  readonly rows = new Map<string, VaultTome | VaultSync>();
  get available(): boolean {
    return true;
  }
  async get(store: string, owner: string): Promise<VaultTome | VaultSync | undefined> {
    return structuredClone(this.rows.get(`${store}/${owner}`));
  }
  async put(store: string, value: object): Promise<void> {
    const row = value as VaultTome | VaultSync;
    this.rows.set(`${store}/${row.owner}`, structuredClone(row));
  }
  async remove(store: string, owner: string): Promise<void> {
    this.rows.delete(`${store}/${owner}`);
  }
  async persist(): Promise<boolean> {
    return true;
  }
}

describe('TomeHistory', () => {
  let vault: MemoryVault;
  let history: TomeHistory;
  let characters: InstanceType<typeof CharactersStore>;
  let dialogues: InstanceType<typeof DialoguesStore>;

  const rename = (firstName: string): void => {
    const first = characters.characters()[0];
    characters.save({ ...first, firstName });
    TestBed.tick();
  };

  beforeEach(() => {
    localStorage.clear();
    vault = new MemoryVault();
    TestBed.configureTestingModule({ providers: [{ provide: TomeVault, useValue: vault }] });
    history = TestBed.inject(TomeHistory);
    characters = TestBed.inject(CharactersStore);
    dialogues = TestBed.inject(DialoguesStore);
    TestBed.tick();
  });

  it('starts with a single entry and nothing to undo', () => {
    expect(history.entries().length).toBe(1);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });

  it('undoes and redoes an edit', () => {
    const original = characters.characters()[0].firstName;
    rename('Changed');
    expect(history.canUndo()).toBe(true);

    history.undo();
    expect(characters.characters()[0].firstName).toBe(original);
    expect(history.canRedo()).toBe(true);

    history.redo();
    expect(characters.characters()[0].firstName).toBe('Changed');
  });

  it('labels the entry with what changed', () => {
    rename('Changed');
    history.undo();
    history.redo();
    expect(history.entries()[1].label).toContain('Edited soul Changed');
  });

  it('drops the redo branch when a new edit follows an undo', () => {
    rename('First');
    rename('Second');
    history.undo();
    rename('Third');
    history.undo();
    history.redo();
    expect(history.canRedo()).toBe(false);
    expect(characters.characters()[0].firstName).toBe('Third');
  });

  it('jumps to any entry in the timeline', () => {
    const original = characters.characters()[0].firstName;
    rename('First');
    rename('Second');
    history.undo();
    history.redo();
    history.jumpTo(0);
    expect(characters.characters()[0].firstName).toBe(original);
    history.jumpTo(history.entries().length - 1);
    expect(characters.characters()[0].firstName).toBe('Second');
  });

  it('resets the tome as an undoable step', () => {
    dialogues.replaceAll([]);
    TestBed.tick();
    history.reset();
    expect(dialogues.nodes().length).toBeGreaterThan(0);
    history.undo();
    expect(dialogues.nodes().length).toBe(0);
  });

  it('saves to the browser database and clears the dirty flag', async () => {
    await history.open('alice');
    rename('Saved');
    expect(history.dirty()).toBe(true);
    expect(await history.persist()).toBe(true);
    expect(history.dirty()).toBe(false);
    const row = vault.rows.get(`${TOMES}/alice`) as VaultTome;
    expect(row.tome.characters[0].firstName).toBe('Saved');
  });

  it('keeps each owner in a separate tome', async () => {
    await history.open('alice');
    rename('Alice tome');
    await history.persist();
    history.close();
    await history.open('bob');
    expect(characters.characters()[0].firstName).not.toBe('Alice tome');
    history.close();
    await history.open('alice');
    expect(characters.characters()[0].firstName).toBe('Alice tome');
    expect(history.entries().length).toBe(1);
  });

  it('carries the open tome into a brand-new owner', async () => {
    await history.open('local');
    rename('Carried');
    await history.open('fresh', true);
    expect(characters.characters()[0].firstName).toBe('Carried');
    expect(history.dirty()).toBe(false);
    expect((vault.rows.get(`${TOMES}/fresh`) as VaultTome).tome.characters[0].firstName).toBe('Carried');
  });

  it('never carries the open tome over an owner that already has one', async () => {
    await history.open('known');
    rename('Known');
    await history.persist();
    history.close();
    await history.open('local');
    rename('Local');
    await history.open('known', true);
    expect(characters.characters()[0].firstName).toBe('Known');
  });

  it('moves a tome saved by older versions into the browser database', async () => {
    const tome = { ...history.current(), characters: [{ ...history.current().characters[0], firstName: 'Legacy' }] };
    localStorage.setItem('congulatio.tome.v1', JSON.stringify({ format: TOME_FORMAT, version: 1, savedAt: '2026-01-01T00:00:00.000Z', tome, changeset: [] }));
    await history.open('alice');
    expect(characters.characters()[0].firstName).toBe('Legacy');
    expect(history.dirty()).toBe(false);
    expect(localStorage.getItem('congulatio.tome.v1')).toBeNull();
    expect(vault.rows.has(`${TOMES}/alice`)).toBe(true);
  });
});

describe('tome files', () => {
  it('rejects files that are not tomes', () => {
    expect(() => parseTomeFile('not json')).toThrow(TomeError);
    expect(() => parseTomeFile('{"format":"other"}')).toThrow('not a Congulatio tome');
  });

  it('rejects damaged entries', () => {
    const file = JSON.stringify({
      format: TOME_FORMAT,
      version: 1,
      tome: { characters: [{ id: 'a' }], dialogue: [], relations: [], routines: [] },
    });
    expect(() => parseTomeFile(file)).toThrow('Entry 1 in souls is damaged.');
  });

  it('opens older tomes that have no interactions', () => {
    const file = JSON.stringify({
      format: TOME_FORMAT,
      version: 1,
      tome: { characters: [], dialogue: [], relations: [], routines: [] },
    });
    expect(parseTomeFile(file).tome.interactions).toEqual([]);
  });

  it('describes a multi-part change with counts', () => {
    const empty = { characters: [], dialogue: [], relations: [], routines: [], interactions: [], attributeDefs: [] };
    const change = describeChange(empty, {
      ...empty,
      relations: [{ id: 'r', fromId: 'a', toId: 'b', kind: 'ally', note: '' }],
      routines: [{ id: 'x', name: 'Watch', schedule: '', participantIds: [], forks: [] }],
    });
    expect(change.label).toBe('Changed 1 bond, 1 routine');
    expect(change.details.length).toBe(2);
  });
});
