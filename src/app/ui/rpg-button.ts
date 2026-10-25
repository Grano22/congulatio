import { booleanAttribute, Component, computed, input } from '@angular/core';

export type RpgButtonVariant = 'gold' | 'wood' | 'ghost' | 'danger';
export type RpgButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASS: Record<RpgButtonVariant, string> = {
  gold: 'rbtn rbtn--gold',
  wood: 'rbtn rbtn--wood',
  ghost: 'rbtn rbtn--ghost',
  danger: 'rbtn rbtn--danger',
};

const SIZE_CLASS: Record<RpgButtonSize, string> = {
  sm: 'rbtn--sm',
  md: 'rbtn--md',
  lg: 'rbtn--lg',
};

/**
 * Gilded or oaken workshop button. All shared button styling lives in
 * styles.css (`.rbtn*` classes) so the component stays a thin wrapper.
 */
@Component({
  selector: 'app-rpg-button',
  styles: [
    /* the host is a tight inline-flex wrapper — any class put on
       <app-rpg-button> must size the INNER button, never the host */
    `:host {
      display: inline-flex;
      min-width: 0;
      min-height: 0;
    }`,
  ],
  template: `
    <button
      type="button"
      [class]="classes()"
      [disabled]="disabled()"
    >
      <ng-content />
    </button>
  `,
})
export class RpgButton {
  readonly variant = input<RpgButtonVariant>('wood');
  readonly size = input<RpgButtonSize>('md');
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly classes = computed(
    () => `${VARIANT_CLASS[this.variant()]} ${SIZE_CLASS[this.size()]}`,
  );
}