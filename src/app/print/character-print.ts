import { Component, afterRenderEffect, computed, inject, untracked } from '@angular/core';
import { PixelAvatar } from '../ui/pixel-avatar';
import { CharactersStore } from '../store/charactersStore';
import { PrintJob } from './printJob';
import { buildDndSheet, formatModifier } from '../domain/dndSheet';

@Component({
  selector: 'app-character-print',
  imports: [PixelAvatar],
  styleUrl: './character-print.css',
  templateUrl: './character-print.html',
})
export class CharacterPrint {
  private readonly print = inject(PrintJob);
  private readonly characters = inject(CharactersStore);

  protected readonly job = this.print.job;
  protected readonly soul = computed(() => {
    const job = this.job();
    return job ? (this.characters.characters().find((c) => c.id === job.soulId) ?? null) : null;
  });
  protected readonly sheet = computed(() => {
    const soul = this.soul();
    return soul ? buildDndSheet(soul) : null;
  });
  protected readonly mod = formatModifier;

  constructor() {
    afterRenderEffect(() => {
      const job = this.job();
      if (job && this.sheet()) untracked(() => void this.print.run(job));
      else if (job) untracked(() => this.job.set(null));
    });
  }
}
