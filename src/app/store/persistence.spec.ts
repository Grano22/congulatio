import { TestBed } from '@angular/core/testing';
import { Persistence } from './persistence';
import { TomeHistory } from './tomeHistory';
import { CharactersStore } from './charactersStore';
import { SettingsStore } from './settingsStore';
import { TomeVault } from './tomeVault';

class MemoryVault {
  readonly rows = new Map<string, unknown>();
  get available(): boolean {
    return true;
  }
  async get(store: string, key: string): Promise<unknown> {
    return structuredClone(this.rows.get(`${store}/${key}`));
  }
  async put(store: string, value: { owner?: string; key?: string }): Promise<void> {
    this.rows.set(`${store}/${value.owner ?? value.key}`, structuredClone(value));
  }
  async remove(store: string, key: string): Promise<void> {
    this.rows.delete(`${store}/${key}`);
  }
  async setting(): Promise<undefined> {
    return undefined;
  }
  async remember(): Promise<void> {
    return;
  }
  async persist(): Promise<boolean> {
    return true;
  }
}

describe('Persistence', () => {
  let persistence: Persistence;
  let history: TomeHistory;
  let characters: InstanceType<typeof CharactersStore>;
  let settings: SettingsStore;

  const edit = (firstName: string): void => {
    characters.save({ ...characters.characters()[0], firstName });
    TestBed.tick();
  };

  const leave = (): BeforeUnloadEvent => {
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    window.dispatchEvent(event);
    return event;
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [{ provide: TomeVault, useValue: new MemoryVault() }] });
    persistence = TestBed.inject(Persistence);
    history = TestBed.inject(TomeHistory);
    characters = TestBed.inject(CharactersStore);
    settings = TestBed.inject(SettingsStore);
    persistence.start();
    await history.open('alice');
    TestBed.tick();
  });

  it('treats an untouched sample tome as safe to leave', () => {
    expect(history.dirty()).toBe(false);
    expect(leave().defaultPrevented).toBe(false);
  });

  it('autosaves unsaved edits into the browser database', async () => {
    edit('Autosaved');
    expect(history.dirty()).toBe(true);
    expect(await persistence.autosave()).toBe(true);
    expect(history.dirty()).toBe(false);
    expect(persistence.autosavedAt()).not.toBeNull();
  });

  it('skips autosave when nothing changed', async () => {
    expect(await persistence.autosave()).toBe(false);
  });

  it('warns before leaving with unsaved edits unless switched off', () => {
    settings.update({ autosave: false });
    edit('Unsaved');
    expect(leave().defaultPrevented).toBe(true);
    settings.update({ warnBeforeLeaving: false });
    expect(leave().defaultPrevented).toBe(false);
  });
});
