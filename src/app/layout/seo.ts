import { DestroyRef, Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

export type SeoData = { description?: string; robots?: string };

const DEFAULT_ROBOTS = 'index, follow, max-image-preview:large';

@Injectable({ providedIn: 'root' })
export class Seo {
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly destroy = inject(DestroyRef);
  private readonly defaultDescription = this.meta.getTag('name="description"')?.content ?? '';
  private readonly siteUrl = this.document.querySelector<HTMLLinkElement>('link[rel=canonical]')?.href ?? '';

  start(): void {
    const subscription = this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => this.apply(e.urlAfterRedirects));
    this.destroy.onDestroy(() => subscription.unsubscribe());
  }

  private apply(url: string): void {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let data: SeoData = {};
    while (route) {
      data = { ...data, ...(route.data as SeoData) };
      route = route.firstChild;
    }
    this.meta.updateTag({ name: 'description', content: data.description ?? this.defaultDescription });
    this.meta.updateTag({ name: 'robots', content: data.robots ?? DEFAULT_ROBOTS });
    const canonical = this.document.querySelector<HTMLLinkElement>('link[rel=canonical]');
    if (canonical && this.siteUrl) {
      const path = url.split(/[?#]/)[0].replace(/^\//, '');
      canonical.href = new URL(path, this.siteUrl).href;
      this.meta.updateTag({ property: 'og:url', content: canonical.href });
    }
  }
}
