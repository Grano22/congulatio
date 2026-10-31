import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RpgModal } from '../ui/rpg-modal';
import { RpgButton } from '../ui/rpg-button';
import { ShellStore } from '../store/shellStore';
import { AUTOSAVE_INTERVALS, AutosaveInterval, SettingsStore } from '../store/settingsStore';
import { Persistence } from '../store/persistence';
import { Session } from '../cloud/session';

@Component({
  selector: 'app-settings-dialog',
  imports: [RpgModal, RpgButton, DatePipe],
  styleUrl: './settings-dialog.css',
  templateUrl: './settings-dialog.html',
})
export class SettingsDialog {
  protected readonly shell = inject(ShellStore);
  protected readonly store = inject(SettingsStore);
  protected readonly persistence = inject(Persistence);
  protected readonly session = inject(Session);

  protected readonly open = computed(() => this.shell.dialog() === 'settings');
  protected readonly settings = this.store.settings;
  protected readonly intervals = AUTOSAVE_INTERVALS.map((seconds) => ({
    seconds,
    label: seconds < 60 ? `every ${seconds} seconds` : seconds === 60 ? 'every minute' : `every ${seconds / 60} minutes`,
  }));

  protected setAutosave(event: Event): void {
    this.store.update({ autosave: (event.target as HTMLInputElement).checked });
  }

  protected setInterval(event: Event): void {
    this.store.update({ autosaveSeconds: Number((event.target as HTMLSelectElement).value) as AutosaveInterval });
  }

  protected setWarn(event: Event): void {
    this.store.update({ warnBeforeLeaving: (event.target as HTMLInputElement).checked });
  }
}
