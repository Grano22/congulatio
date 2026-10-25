import { booleanAttribute, Component, computed, inject, input, output, signal } from '@angular/core';
import { Flame, Swords, Trash2, X } from 'lucide';
import { RpgPanel } from '../ui/rpg-panel';
import { RpgButton } from '../ui/rpg-button';
import { LucideIcon } from '../ui/lucide-icon';
import { PixelAvatar } from '../ui/pixel-avatar';
import { CharactersStore } from '../store/charactersStore';
import { ShellStore } from '../store/shellStore';
import type { SoulStatus } from '../domain/randomCharacter';

const STATUS_LABEL: Record<SoulStatus, string> = {
  quest: 'On Quest',
  alive: 'Alive',
  resting: 'Resting',
};

@Component({
  selector: 'app-characters-galery',
  imports: [RpgPanel, RpgButton, LucideIcon, PixelAvatar],
  styleUrl: './characters-galery.css',
  templateUrl: './characters-galery.html',
})
export class CharactersGalery {
  readonly closable = input(false, { transform: booleanAttribute });
  readonly close = output<void>();
  /** a soul was picked (or a new one engraved) — the main stage should show the forge */
  readonly focusCharacter = output<void>();

  private readonly store = inject(CharactersStore);
  private readonly shell = inject(ShellStore);

  protected readonly xIcon = X;
  protected readonly swordsIcon = Swords;
  protected readonly flameIcon = Flame;
  protected readonly trashIcon = Trash2;

  protected readonly souls = computed(() => this.store.characters());
  protected readonly selectedId = computed(() => this.store.selectedId());
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly subtitleText = computed(() => `${this.souls().length} souls bound`);
  protected readonly filter = signal('');

  protected readonly filteredSouls = computed(() => {
    const query = this.filter().trim().toLowerCase();
    if (!query) return this.souls();
    return this.souls().filter((soul) => `${soul.firstName} ${soul.lastName}`.toLowerCase().includes(query));
  });

  /** load the soul on the forge, then pull the main stage to it */
  protected select(id: string): void {
    this.store.select(id);
    this.focusCharacter.emit();
  }

  protected remove(id: string): void {
    this.shell.confirmRemoveSoul(id);
  }

  /** clear the selection — a fresh soul awaits on the forge */
  protected engraveNew(): void {
    this.store.select(null);
    this.focusCharacter.emit();
  }
}
