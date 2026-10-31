import { Component, computed, inject } from '@angular/core';
import { IdCard, Printer } from 'lucide';
import { RpgPanel } from '../ui/rpg-panel';
import { RpgButton } from '../ui/rpg-button';
import { LucideIcon } from '../ui/lucide-icon';
import { PixelAvatar } from '../ui/pixel-avatar';
import { CharactersStore } from '../store/charactersStore';
import { PrintJob, PrintKind } from '../print/printJob';
import { buildDndSheet, formatModifier } from '../domain/dndSheet';

@Component({
  selector: 'app-dnd-sheet',
  imports: [RpgPanel, RpgButton, LucideIcon, PixelAvatar],
  styleUrl: './dnd-sheet.css',
  templateUrl: './dnd-sheet.html',
})
export class DndSheet {
  private readonly characters = inject(CharactersStore);
  private readonly print = inject(PrintJob);

  protected readonly souls = this.characters.characters;
  protected readonly soul = computed(() => {
    const all = this.souls();
    return all.find((c) => c.id === this.characters.selectedId()) ?? all[0] ?? null;
  });
  protected readonly sheet = computed(() => {
    const soul = this.soul();
    return soul ? buildDndSheet(soul) : null;
  });
  protected readonly mod = formatModifier;
  protected readonly printIcon = Printer;
  protected readonly cardIcon = IdCard;

  protected choose(id: string): void {
    this.characters.select(id);
  }

  protected printAs(kind: PrintKind): void {
    const soul = this.soul();
    if (soul) this.print.request(kind, soul.id);
  }
}
