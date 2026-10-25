import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

let modalCounter = 0;

@Component({
  selector: 'app-rpg-modal',
  styles: [
    `
      .rmodal {
        position: fixed;
        inset: 0;
        margin: auto;
        height: fit-content;
        width: min(var(--modal-width, 40rem), calc(100vw - 2rem));
        max-height: calc(100vh - 3rem);
        padding: 0;
        border: 2px solid var(--color-wood-950);
        border-radius: 12px;
        background: linear-gradient(168deg, #f4e8c8, #dcc48f);
        color: var(--color-ink-900);
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.7), inset 0 0 0 2px var(--color-gold-600);
      }
      .rmodal::backdrop {
        background: rgba(10, 7, 3, 0.65);
      }
      .rmodal__frame {
        display: flex;
        flex-direction: column;
        max-height: calc(100vh - 3rem);
      }
      .rmodal__head {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.8rem 1rem;
        background: linear-gradient(180deg, var(--color-wood-600), var(--color-wood-800));
        color: var(--color-gold-200);
      }
      .rmodal__title {
        flex: 1;
        margin: 0;
        font-family: var(--font-display);
        font-size: 1rem;
        letter-spacing: 0.06em;
      }
      .rmodal__close {
        width: 1.9rem;
        height: 1.9rem;
        border-radius: 6px;
        border: 1px solid var(--color-wood-950);
        background: var(--color-wood-700);
        color: var(--color-parchment-200);
        font-size: 1.1rem;
        cursor: pointer;
      }
      .rmodal__body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 1rem 1.2rem;
      }
      .rmodal__foot {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0.5rem;
        padding: 0.7rem 1rem;
        border-top: 1px solid var(--color-parchment-400);
      }
      .rmodal__foot:empty {
        display: none;
      }
    `,
  ],
  template: `
    <dialog
      #dialog
      class="rmodal"
      [style.--modal-width]="width()"
      [attr.aria-labelledby]="titleId"
      (close)="closed.emit()"
      (click)="onBackdrop($event)"
    >
      <div class="rmodal__frame">
        <header class="rmodal__head">
          <h2 class="rmodal__title" [id]="titleId">{{ title() }}</h2>
          <button type="button" class="rmodal__close" aria-label="Close" (click)="closed.emit()">×</button>
        </header>
        <div class="rmodal__body">
          <ng-content />
        </div>
        <footer class="rmodal__foot"><ng-content select="[modalFooter]" /></footer>
      </div>
    </dialog>
  `,
})
export class RpgModal {
  readonly open = input(false);
  readonly title = input('');
  readonly width = input('40rem');
  readonly closed = output<void>();

  protected readonly titleId = `rmodal-title-${++modalCounter}`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      if (this.open() && !el.open) el.showModal();
      if (!this.open() && el.open) el.close();
    });
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.closed.emit();
  }
}
