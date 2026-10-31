import { Component, effect, inject, untracked } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Session } from './cloud/session';
import { CloudSync } from './cloud/cloudSync';
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
  protected readonly sync = inject(CloudSync);

  constructor() {
    effect(() => {
      if (!this.session.ready()) return;
      const uid = this.session.user().uid;
      untracked(() => {
        const owner = this.history.owner();
        if (owner && owner !== uid) void this.history.open(uid, this.session.takeLocalTome());
      });
    });
  }
}
