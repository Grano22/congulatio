import { Component, inject, input, OnInit } from '@angular/core';
import { ErrorLog } from '../store/errorLog';
import { NetworkStore } from '../store/networkStore';

@Component({
  selector: 'app-load-failed',
  template: `
    <div class="lf" role="alert">
      <h2 class="lf__title">{{ what() }} could not be loaded</h2>
      <p class="lf__text">
        @if (!network.online()) {
          You are offline and this part has not been saved for offline use yet.
        } @else {
          A network hiccup or a new version of Congulatio stopped it from loading.
        }
        Your tome is safe.
      </p>
      <button type="button" class="rbtn rbtn--gold rbtn--sm" (click)="reload()">Reload</button>
    </div>
  `,
  styles: [
    `
      .lf {
        margin: 2rem auto;
        max-width: 28rem;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.6rem;
        padding: 1.2rem;
        border-radius: 10px;
        border: 1px solid var(--color-blood-400);
        background: linear-gradient(168deg, var(--page-a), var(--page-c));
        color: var(--color-ink-900);
      }
      .lf__title {
        margin: 0;
        font-family: var(--font-display);
        font-size: 1rem;
      }
      .lf__text {
        margin: 0;
        font-size: 0.9rem;
        line-height: 1.45;
      }
    `,
  ],
})
export class LoadFailed implements OnInit {
  readonly what = input('This part');
  protected readonly network = inject(NetworkStore);
  private readonly log = inject(ErrorLog);

  ngOnInit(): void {
    this.log.capture(new Error(`Lazy view failed to load: ${this.what()}`), 'lazy-load');
    this.log.dismissCritical();
  }

  protected reload(): void {
    location.reload();
  }
}
