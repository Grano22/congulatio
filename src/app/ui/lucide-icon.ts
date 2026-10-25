import { AfterViewInit, Component, ElementRef, input, OnChanges, SimpleChanges } from '@angular/core';
import { createElement, IconNode } from 'lucide';

/**
 * Renders a framework-agnostic `lucide` icon node (raw SVG data) into the
 * DOM. Size is controlled with the `iconClass` utility classes (`.ic-*`),
 * color follows `currentColor`.
 */
@Component({
  selector: 'app-lucide-icon',
  template: `<span class="lucide" [class]="iconClass()"></span>`,
})
export class LucideIcon implements AfterViewInit, OnChanges {
  readonly icon = input.required<IconNode>();
  readonly iconClass = input('');
  readonly strokeWidth = input(2);

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.render();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.render();
  }

  private render(): void {
    const slot = this.host.nativeElement.firstElementChild;
    if (!(slot instanceof HTMLElement)) return;
    slot.replaceChildren(createElement(this.icon(), { 'stroke-width': this.strokeWidth() }));
  }
}