import { Component, effect, inject, untracked } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Session } from './cloud/session';
import { TomeHistory } from './store/tomeHistory';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  styles: [':host { display: block; min-height: 100dvh; }'],
})
export class App {
  private readonly session = inject(Session);
  private readonly history = inject(TomeHistory);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      if (!this.session.ready()) return;
      const user = this.session.user();
      untracked(() => {
        if (!user) {
          if (this.history.owner()) this.history.close();
          if (!this.router.url.startsWith('/login')) void this.router.navigate(['/login']);
          return;
        }
        if (this.history.owner() && this.history.owner() !== user.uid) void this.history.open(user.uid);
      });
    });
  }
}
