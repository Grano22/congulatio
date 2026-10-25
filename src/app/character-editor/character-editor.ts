import { Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { CircleAlert, CircleCheck, Dices, Save, X } from 'lucide';
import { RpgPanel } from '../ui/rpg-panel';
import { RpgButton } from '../ui/rpg-button';
import { LucideIcon } from '../ui/lucide-icon';
import { PixelAvatar } from '../ui/pixel-avatar';
import { CharactersStore } from '../store/charactersStore';
import type { RandomCharacter } from '../domain/randomCharacter';
import { generateRandomCharacter, Race } from '../domain/randomCharacter';
import { generateFace } from '../domain/pixelFace';

/**
 * The current soul on the forge. It starts as a hand-set sample (the
 * silhouette state); one throw of the dice replaces it with a whole
 * coherent character — name, balanced traits, and an 8-bit portrait.
 */
const INITIAL_SOUL: RandomCharacter = {
  id: 'sample-aldric',
  firstName: 'Aldric',
  lastName: 'Blackwood',
  nickname: 'the Bold',
  race: 'Human',
  sex: 'male',
  origin: 'Valemark',
  zodiac: 'Aries',
  birthDate: '240-03-24',
  age: 51,
  level: 12,
  bodyType: 'Human Man',
  skin: 'Tan',
  hairColor: 'Bronze',
  hairStyle: 'short',
  eyeColor: 'Hazel',
  temperament: 'Wise',
  note: 'A wise, steady human of Valemark. Keeps a ledger of slights, and has no patience for the third one.',
  face: generateFace({
    seed: 7,
    skin: '#d9a86f',
    hair: '#8a5a2b',
    eyes: '#7a5a2f',
    hairStyle: 'short',
    race: 'Human',
    sex: 'male',
    mood: 'flat',
  }),
  status: 'alive',
};

const FORGE_FIELDS = [
  'firstName',
  'lastName',
  'nickname',
  'race',
  'sex',
  'origin',
  'zodiac',
  'birthDate',
  'eyeColor',
  'hairColor',
  'bodyType',
  'note',
] as const satisfies readonly (keyof RandomCharacter)[];

const withForgeFields = (stored: RandomCharacter, forged: RandomCharacter): RandomCharacter => ({
  ...stored,
  ...Object.fromEntries(FORGE_FIELDS.map((k) => [k, forged[k]])),
});

type ForgeNotice = { kind: 'success' | 'error'; text: string };

const NOTICE_MS = 3500;

@Component({
  selector: 'app-character-editor',
  imports: [RpgPanel, RpgButton, LucideIcon, PixelAvatar],
  styleUrl: './character-editor.css',
  templateUrl: './character-editor.html',
})
export class CharacterEditor {
  private readonly store = inject(CharactersStore);

  protected readonly races: Race[] = ['Human', 'Elf', 'Dwarf', 'Orc', 'Halfling', 'Undead'];
  protected readonly zodiacs = [
    'Aries',
    'Taurus',
    'Gemini',
    'Cancer',
    'Leo',
    'Virgo',
    'Libra',
    'Scorpio',
    'Sagittarius',
    'Capricorn',
    'Aquarius',
    'Pisces',
  ];
  protected readonly bodyTypes = ['Human Woman', 'Human Man', 'Lean', 'Average', 'Slender', 'Stocky', 'Sturdy', 'Massive', 'Petite', 'Withered'];
  protected readonly saveIcon = Save;
  protected readonly xIcon = X;
  protected readonly dicesIcon = Dices;
  protected readonly successIcon = CircleCheck;
  protected readonly errorIcon = CircleAlert;

  protected readonly sample = signal<RandomCharacter>(INITIAL_SOUL);
  /** false until the first summon — the frame shows the empty silhouette */
  protected readonly summoned = signal(false);
  /** the codex soul this forge copy edits (null = a fresh, unsaved soul) */
  protected readonly editingId = signal<string | null>(null);
  /** the last soul pulled off the codex — the load-effect's latch */
  private readonly loadedId = signal<string | null>(null);
  protected readonly notice = signal<ForgeNotice | null>(null);
  private noticeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.noticeTimer));

    // a soul clicked in the codex comes onto the forge, ready to edit
    effect(() => {
      const id = this.store.selectedId();
      if (!id || id === this.loadedId()) return;
      const char = this.store.characters().find((c) => c.id === id);
      if (!char) return;
      this.sample.set(char);
      this.summoned.set(true);
      this.editingId.set(id);
      this.loadedId.set(id);
    });

    effect(() => {
      const id = this.editingId();
      const stored = id ? this.store.characters().find((c) => c.id === id) : undefined;
      if (stored) untracked(() => this.sample.update((forged) => withForgeFields(stored, forged)));
    });
  }

  /** one button: the dice of fate roll a whole, coherent soul */
  protected randomize(): void {
    this.sample.set(generateRandomCharacter());
    this.summoned.set(true);
    // a fresh soul is not a codex entry yet — the button reads "Save to Codex"
    this.editingId.set(null);
    this.loadedId.set(null);
    this.store.select(null);
  }

  /** Save to Codex, or Edit — the same path, upserted by id */
  protected saveToCodex(): void {
    const editing = this.editingId();
    const stored = editing ? this.store.characters().find((c) => c.id === editing) : undefined;
    const char = stored ? withForgeFields(stored, this.sample()) : { ...this.sample(), id: editing ?? this.sample().id };
    const error = this.validate(char);
    if (error) {
      this.notify('error', error);
      return;
    }
    const wasEditing = this.isEditing();
    try {
      this.store.save(char);
    } catch {
      this.notify('error', 'The quill slipped — the soul could not be inscribed.');
      return;
    }
    this.store.select(char.id);
    this.sample.set(char);
    this.editingId.set(char.id);
    this.loadedId.set(char.id);
    this.summoned.set(true);
    const name = `${char.firstName} ${char.lastName}`.trim();
    this.notify('success', wasEditing ? `${name} was amended in the Codex.` : `${name} was inscribed in the Codex.`);
  }

  private validate(char: RandomCharacter): string | null {
    if (!this.summoned()) return 'Summon a soul before inscribing it.';
    if (!char.firstName.trim()) return 'A soul needs a first name.';
    const fullName = `${char.firstName} ${char.lastName}`.trim().toLowerCase();
    const twin = this.store
      .characters()
      .some((c) => c.id !== char.id && `${c.firstName} ${c.lastName}`.trim().toLowerCase() === fullName);
    if (twin) return `A soul named ${char.firstName} ${char.lastName} already lives in the Codex.`;
    return null;
  }

  private notify(kind: ForgeNotice['kind'], text: string): void {
    clearTimeout(this.noticeTimer);
    this.notice.set({ kind, text });
    this.noticeTimer = setTimeout(() => this.notice.set(null), NOTICE_MS);
  }

  /** the button reads "Edit" once the soul lives in the codex */
  protected isEditing(): boolean {
    return this.editingId() !== null;
  }

  /** discard the current soul back to the blank sample */
  protected discard(): void {
    this.sample.set(INITIAL_SOUL);
    this.summoned.set(false);
    this.editingId.set(null);
    this.loadedId.set(null);
    this.store.select(null);
  }

  /** form fields write straight back into the soul being shaped */
  protected patch(key: keyof RandomCharacter, value: unknown): void {
    this.sample.update((s) => ({ ...s, [key]: value } as RandomCharacter));
  }
}
