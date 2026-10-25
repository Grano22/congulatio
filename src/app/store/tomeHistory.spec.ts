import { TestBed } from '@angular/core/testing';
import { TomeHistory } from './tomeHistory';
import { CharactersStore } from './charactersStore';
import { DialoguesStore } from './dialoguesStore';
import { TOME_FORMAT, TomeError, describeChange, parseTomeFile } from '../domain/tome';

describe('TomeHistory', () => {
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
    TestBed.configureTestingModule({});
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

  it('saves to browser storage and clears the dirty flag', () => {
    rename('Saved');
    expect(history.dirty()).toBe(true);
    history.save();
    expect(history.dirty()).toBe(false);
    expect(localStorage.getItem('congulatio.tome.v1')).toContain('Saved');
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
