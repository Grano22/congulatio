import { Component, input } from '@angular/core';
import type { ThemeId } from '../domain/themes';

@Component({
  selector: 'app-theme-preview',
  styles: [
    `
      :host {
        display: block;
        flex: none;
      }
      .tp {
        width: 100%;
        aspect-ratio: 16 / 10;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: 6px;
        border: 1px solid var(--color-wood-950);
        background: var(--color-stone-900);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
      }
      .tp__bar {
        display: flex;
        align-items: center;
        gap: 6%;
        height: 26%;
        padding: 0 7%;
        background: linear-gradient(180deg, var(--color-wood-600), var(--color-wood-800) 60%, var(--color-wood-900));
        border-bottom: 1px solid var(--color-wood-950);
        box-shadow: inset 0 1px 0 rgb(var(--sheen-rgb) / 0.2);
      }
      .tp__gem {
        width: 9%;
        aspect-ratio: 1;
        transform: rotate(45deg) scale(0.8);
        background: radial-gradient(circle at 35% 30%, var(--color-gold-100), var(--color-gold-400) 45%, var(--color-gold-700));
        box-shadow: 0 0 6px rgb(var(--accent-rgb) / 0.7);
      }
      .tp__title {
        height: 22%;
        width: 42%;
        border-radius: 2px;
        background: var(--color-gold-300);
        opacity: 0.9;
      }
      .tp__body {
        flex: 1;
        display: flex;
        gap: 4%;
        padding: 5%;
      }
      .tp__rail {
        width: 14%;
        border-radius: 3px;
        background: linear-gradient(90deg, var(--color-wood-700), var(--color-wood-900));
        box-shadow: inset 0 0 0 1px var(--color-wood-950);
      }
      .tp__page {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 9%;
        padding: 7% 8%;
        border-radius: 3px;
        background:
          radial-gradient(120% 90% at 90% 100%, rgb(var(--page-shade-rgb) / 0.35), transparent 60%),
          linear-gradient(168deg, var(--page-a), var(--page-b) 52%, var(--page-c));
        border: 1px solid var(--color-wood-950);
      }
      .tp__line {
        height: 7%;
        border-radius: 2px;
        background: var(--color-ink-700);
        opacity: 0.55;
      }
      .tp__line--short {
        width: 60%;
      }
      .tp__btn {
        margin-top: auto;
        align-self: flex-end;
        width: 38%;
        height: 18%;
        border-radius: 3px;
        background: linear-gradient(180deg, var(--color-gold-200), var(--color-gold-400) 45%, var(--color-gold-600));
        border: 1px solid var(--color-gold-700);
      }
    `,
  ],
  template: `
    <div class="tp" [attr.data-theme-preview]="theme()" aria-hidden="true">
      <div class="tp__bar"><span class="tp__gem"></span><span class="tp__title"></span></div>
      <div class="tp__body">
        <span class="tp__rail"></span>
        <span class="tp__page">
          <span class="tp__line"></span>
          <span class="tp__line tp__line--short"></span>
          <span class="tp__btn"></span>
        </span>
      </div>
    </div>
  `,
})
export class ThemePreview {
  readonly theme = input.required<ThemeId>();
}
