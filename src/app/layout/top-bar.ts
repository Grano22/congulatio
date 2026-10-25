import { Component, computed, inject, input, output } from '@angular/core';
import { Download, PanelLeftClose, PanelLeftOpen, Save, Shield } from 'lucide';
import { RpgButton } from '../ui/rpg-button';
import { LucideIcon } from '../ui/lucide-icon';
import { MainMenu } from './main-menu';
import { GlobalSearch } from './global-search';
import { CommandsService } from './commands';
import { TomeHistory } from '../store/tomeHistory';

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
  protected readonly saveKeys = this.commands.shortcut(this.commands.get('tome.save')!);
  protected readonly exportKeys = this.commands.shortcut(this.commands.get('tome.export')!);

  protected readonly panelIcon = computed(() =>
    this.leftSidebarOpen() ? PanelLeftOpen : PanelLeftClose,
  );
  protected readonly shieldIcon = Shield;
  protected readonly downloadIcon = Download;
  protected readonly saveIcon = Save;
}