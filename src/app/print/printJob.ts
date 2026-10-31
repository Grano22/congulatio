import { Injectable, signal } from '@angular/core';

export type PrintKind = 'sheet' | 'card';

export type PrintRequest = { kind: PrintKind; soulId: string };

@Injectable({ providedIn: 'root' })
export class PrintJob {
  readonly job = signal<PrintRequest | null>(null);
  private started: PrintRequest | null = null;

  request(kind: PrintKind, soulId: string): void {
    this.job.set({ kind, soulId });
  }

  async run(request: PrintRequest): Promise<void> {
    if (this.started === request) return;
    this.started = request;
    await document.fonts?.ready;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (this.job() !== request) return;
    const done = (): void => {
      window.removeEventListener('afterprint', done);
      if (this.job() === request) this.job.set(null);
    };
    window.addEventListener('afterprint', done);
    window.print();
  }
}
