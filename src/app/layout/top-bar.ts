import { Component, computed, inject, input, output } from '@angular/core';
import { Download, PanelLeftClose, PanelLeftOpen, Save, Shield } from 'lucide';
import { RpgButton } from '../ui/rpg-button';
import { LucideIcon } from '../ui/lucide-icon';
import { MainMenu } from './main-menu';
import { GlobalSearch } from './global-search';
import { CommandsService } from './commands';
import { TomeHistory } from '../store/tomeHistory';
import { ShellStore } from '../store/shellStore';
import { Session } from '../cloud/session';
import { CloudSync } from '../cloud/cloudSync';
import { AccountStore } from '../cloud/account';

@Component({
  selector: 'app-top-bar',
  imports: [RpgButton, LucideIcon, MainMenu, GlobalSearch],
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
  protected readonly sync = inject(CloudSync);
  protected readonly account = inject(AccountStore);
  protected readonly initial = computed(() => (this.session.user()?.name ?? '?').trim().charAt(0).toUpperCase() || '?');
  protected readonly syncTitle = computed(() => {
    const user = this.session.user();
    if (!user) return '';
    if (user.kind === 'offline') return `${user.name} · this device only`;
    return `${user.name} · cloud ${this.sync.status() === 'idle' ? 'in sync' : this.sync.status()}`;
  });
  protected readonly saveKeys = this.commands.shortcut(this.commands.get('tome.save')!);
  protected readonly exportKeys = this.commands.shortcut(this.commands.get('tome.export')!);

  protected readonly panelIcon = computed(() =>
    this.leftSidebarOpen() ? PanelLeftOpen : PanelLeftClose,
  );
  protected readonly shieldIcon = Shield;
  protected readonly downloadIcon = Download;
  protected readonly saveIcon = Save;
}