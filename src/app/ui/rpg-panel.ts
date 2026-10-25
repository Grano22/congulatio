import { booleanAttribute, Component, computed, input } from '@angular/core';

export type RpgPanelSurface = 'parchment' | 'stone' | 'wood';

/**
 * Framed workbench panel: carved-wood header with a gem and title,
 * a swappable surface (parchment / stone / wood) for the body, and an
 * optional wooden footer bar for action buttons.
 *
 * Projection slots:
 *  - default content → body
 *  - [headerActions] → right side of the header
 *  - [footer]        → footer bar (shown when `footer` is set)
 */
@Component({
  selector: 'app-rpg-panel',
  styles: [
    /* make the host fill whatever container it is projected into —
       as a flex item it grows to 100% of the parent's main size */
    `:host {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
    }`,
  ],
  template: `
    <section class="rpanel" [class]="surfaceClass()">
      <header class="rpanel__header rivets">
        <span class="gem" aria-hidden="true"></span>
        <h3 class="rpanel__title">{{ title() }}</h3>
        @if (subtitle()) {
          <span class="rpanel__subtitle">{{ subtitle() }}</span>
        }
        <div class="rpanel__header-actions">
          <ng-content select="[headerActions]" />
        </div>
      </header>

      <div class="rpanel__body grain">
        <ng-content />
      </div>

      @if (footer()) {
        <footer class="rpanel__footer rivets">
          <ng-content select="[footer]" />
        </footer>
      }
    </section>
  `,
})
export class RpgPanel {
  readonly title = input('');
  readonly subtitle = input('');
  readonly surface = input<RpgPanelSurface>('parchment');
  readonly footer = input(false, { transform: booleanAttribute });

  protected readonly surfaceClass = computed(() => `rpanel--${this.surface()}`);
}
