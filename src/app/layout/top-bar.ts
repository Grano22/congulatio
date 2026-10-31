import { Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { Download, PanelLeftClose, PanelLeftOpen, Save, Shield, WifiOff } from 'lucide';
import { RpgButton } from '../ui/rpg-button';
import { LucideIcon } from '../ui/lucide-icon';
import { MainMenu } from './main-menu';
import { GlobalSearch } from './global-search';
import { AccountMenu } from './account-menu';
import { CommandsService } from './commands';
import { TomeHistory } from '../store/tomeHistory';
import { ShellStore } from '../store/shellStore';
import { Session } from '../cloud/session';
import { NetworkStore } from '../store/networkStore';

@Component({
  selector: 'app-top-bar',
  imports: [RpgButton, LucideIcon, MainMenu, GlobalSearch, AccountMenu],
  styleUrl: './top-bar.css',
  templateUrl: './top-bar.html',
})
export class TopBar {
  readonly leftSidebarOpen = input(false);
  readonly leftSidebarToggle = output<void>();

  protected readonly commands = inject(CommandsService);
  protected readonly history = inject(TomeHistory);
  protected readonly shell = inject(ShellStore);
  protected readonly session = inject(Session);
  private readonly router = inject(Router);
  protected readonly network = inject(NetworkStore);
  protected readonly offlineIcon = WifiOff;
  protected readonly offlineTitle = computed(() =>
    this.session.cloud()
      ? 'No connection. Saves stay in this browser and sync to the cloud when the connection returns.'
      : 'No connection. Everything keeps working and saves stay in this browser.',
  );
  protected readonly saveKeys = this.commands.shortcut(this.commands.get('tome.save')!);
  protected readonly exportKeys = this.commands.shortcut(this.commands.get('tome.export')!);

  protected readonly panelIcon = computed(() =>
    this.leftSidebarOpen() ? PanelLeftOpen : PanelLeftClose,
  );
  protected readonly shieldIcon = Shield;
  protected readonly downloadIcon = Download;
  protected readonly saveIcon = Save;

  protected signIn(): void {
    void this.router.navigate(['/login']);
  }
}