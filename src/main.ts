import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

function showStartupFailure(error: unknown): void {
  console.error(error);
  const panel = document.createElement('main');
  panel.setAttribute('role', 'alert');
  panel.style.cssText =
    'max-width:32rem;margin:15vh auto;padding:1.5rem;border-radius:12px;background:#f4e8c8;color:#251809;font:16px/1.5 Georgia,serif;box-shadow:0 18px 50px rgba(0,0,0,.6)';
  const title = document.createElement('h1');
  title.textContent = 'Congulatio could not start';
  title.style.cssText = 'margin:0 0 .5rem;font-size:1.25rem';
  const text = document.createElement('p');
  text.textContent = 'Your saved tome is safe in this browser. Reloading usually helps; if it keeps happening, try clearing the site cache or report it on GitHub.';
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.textContent = 'Reload';
  reload.style.cssText = 'padding:.5rem 1rem;border-radius:6px;border:1px solid #7a5c12;background:#d0ac3c;font:inherit;cursor:pointer';
  reload.addEventListener('click', () => location.reload());
  panel.append(title, text, reload);
  document.body.replaceChildren(panel);
  reload.focus();
}

bootstrapApplication(App, appConfig).catch(showStartupFailure);
