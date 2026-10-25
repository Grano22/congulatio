import { booleanAttribute, Component, input, output } from '@angular/core';
import { X } from 'lucide';
import { RpgPanel } from '../ui/rpg-panel';
import { RpgButton } from '../ui/rpg-button';
import { LucideIcon } from '../ui/lucide-icon';

/**
 * Placeholder navigator pane: a framed scroll that shows its title and an
 * empty inscription until real content is wired in.
 */
@Component({
  selector: 'app-navigator-page',
  imports: [RpgPanel, RpgButton, LucideIcon],
  styleUrl: './navigator-page.css',
  templateUrl: './navigator-page.html',
})
export class NavigatorPage {
  readonly title = input('');
  readonly subtitle = input('');
  readonly emptyText = input('');
  readonly closable = input(false, { transform: booleanAttribute });
  readonly close = output<void>();
  readonly xIcon = X;
}