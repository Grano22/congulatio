import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RpgModal } from './rpg-modal';

@Component({
  imports: [RpgModal],
  template: `<app-rpg-modal title="T" [open]="open()" (closed)="closes = closes + 1">Body</app-rpg-modal>`,
})
class Host {
  readonly open = signal(true);
  closes = 0;
}

describe('RpgModal', () => {
  const dialogOf = (el: HTMLElement): HTMLDialogElement => el.querySelector('dialog')!;

  beforeEach(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  });

  it('does not report a close when the parent closes it', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    fixture.componentInstance.open.set(false);
    await fixture.whenStable();
    dialogOf(fixture.nativeElement).dispatchEvent(new Event('close'));
    expect(fixture.componentInstance.closes).toBe(0);
  });

  it('reports a close the user started', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    dialogOf(fixture.nativeElement).dispatchEvent(new Event('close'));
    expect(fixture.componentInstance.closes).toBe(1);
  });
});
