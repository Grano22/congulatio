import { Component, ElementRef, Injector, afterNextRender, inject, signal } from '@angular/core';
import { Command, CommandsService } from './commands';
import { TomeHistory } from '../store/tomeHistory';

type MenuItem = { kind: 'command'; id: string } | { kind: 'separator' } | { kind: 'header'; label: string };

type MenuDef = { label: string; items: MenuItem[] };

const cmd = (id: string): MenuItem => ({ kind: 'command', id });
const SEP: MenuItem = { kind: 'separator' };
const header = (label: string): MenuItem => ({ kind: 'header', label });

const MENUS: MenuDef[] = [
  {
    label: 'File',
    items: [cmd('tome.save'), cmd('tome.import'), SEP, cmd('tome.export'), cmd('tome.exportHistory'), SEP, cmd('tome.reset')],
  },
  { label: 'Edit', items: [cmd('edit.undo'), cmd('edit.redo'), SEP, cmd('edit.history')] },
  {
    label: 'View',
    items: [
      cmd('view.left'),
      cmd('view.inspector'),
      cmd('view.inspectorReadonly'),
      SEP,
      header('Layout presets'),
      cmd('view.preset.balanced'),
      cmd('view.preset.writer'),
      cmd('view.preset.codex'),
      cmd('view.preset.map'),
      cmd('view.preset.stage'),
      SEP,
      cmd('view.maximize'),
      cmd('view.fullscreen'),
      SEP,
      header('Go to'),
      cmd('tab.character'),
      cmd('tab.sculptor'),
      cmd('tab.dialogue'),
      cmd('tab.routines'),
      cmd('tab.interactions'),
      cmd('tab.relations'),
      cmd('tab.simulation'),
    ],
  },
  { label: 'Tools', items: [cmd('tools.summon'), cmd('tools.sculpt'), cmd('tools.simulate'), cmd('tools.map')] },
  { label: 'Help', items: [cmd('help.tour'), cmd('help.about')] },
];

@Component({
  selector: 'app-main-menu',
  styleUrl: './main-menu.css',
  host: { '(document:pointerdown)': 'onOutside($event)' },
  template: `
    <nav class="mm" role="menubar" aria-label="Main menu">
      @for (menu of menus; track menu.label; let m = $index) {
        <div class="mm__slot">
          <button
            type="button"
            class="mm__top"
            role="menuitem"
            aria-haspopup="menu"
            [class.mm__top--open]="openIndex() === m"
            [attr.aria-expanded]="openIndex() === m"
            [attr.tabindex]="m === focusIndex() ? 0 : -1"
            [attr.data-top]="m"
            (click)="toggle(m)"
            (pointerenter)="openIndex() >= 0 && openIndex() !== m && openMenu(m, false)"
            (keydown)="onTopKey($event, m)"
          >{{ menu.label }}</button>

          @if (openIndex() === m) {
            <div class="mm__menu" role="menu" [attr.aria-label]="menu.label" (keydown)="onMenuKey($event, m)">
              @for (item of menu.items; track $index; let i = $index) {
                @switch (item.kind) {
                  @case ('separator') {
                    <div class="mm__sep" role="separator"></div>
                  }
                  @case ('header') {
                    <div class="mm__header" role="presentation">{{ $any(item).label }}</div>
                  }
                  @case ('command') {
                    @let command = commandFor(item);
                    @if (command) {
                      <button
                        type="button"
                        class="mm__item"
                        [attr.role]="command.checked ? 'menuitemcheckbox' : 'menuitem'"
                        [attr.aria-checked]="command.checked ? command.checked() : null"
                        [attr.aria-disabled]="!commands.isEnabled(command)"
                        [class.mm__item--disabled]="!commands.isEnabled(command)"
                        [attr.data-item]="i"
                        tabindex="-1"
                        (click)="choose(command)"
                        (pointerenter)="focusItem(m, i)"
                      >
                        <span class="mm__check" aria-hidden="true">{{ command.checked && command.checked() ? '✓' : '' }}</span>
                        <span class="mm__label">{{ labelFor(command) }}</span>
                        <span class="mm__keys">{{ commands.shortcut(command) }}</span>
                      </button>
                    }
                  }
                }
              }
            </div>
          }
        </div>
      }
    </nav>
  `,
})
export class MainMenu {
  protected readonly commands = inject(CommandsService);
  private readonly history = inject(TomeHistory);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);

  protected readonly menus = MENUS;
  protected readonly openIndex = signal(-1);
  protected readonly focusIndex = signal(0);

  protected commandFor(item: MenuItem): Command | undefined {
    return item.kind === 'command' ? this.commands.get(item.id) : undefined;
  }

  protected labelFor(command: Command): string {
    if (command.id === 'edit.undo' && this.history.canUndo()) return `Undo: ${this.history.undoLabel()}`;
    if (command.id === 'edit.redo' && this.history.canRedo()) return `Redo: ${this.history.redoLabel()}`;
    return command.label;
  }

  protected toggle(m: number): void {
    if (this.openIndex() === m) this.close(true);
    else this.openMenu(m, false);
  }

  protected openMenu(m: number, focusFirst: boolean, fromEnd = false): void {
    this.openIndex.set(m);
    this.focusIndex.set(m);
    if (focusFirst) this.afterRender(() => this.focusEdgeItem(m, fromEnd));
  }

  protected choose(command: Command): void {
    if (!this.commands.isEnabled(command)) return;
    this.close(true);
    command.run();
  }

  protected focusItem(m: number, i: number): void {
    this.itemElement(m, i)?.focus();
  }

  protected onTopKey(event: KeyboardEvent, m: number): void {
    switch (event.key) {
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.openMenu(m, true);
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.openMenu(m, true, true);
        return;
      case 'ArrowRight':
      case 'ArrowLeft': {
        event.preventDefault();
        const next = this.wrap(m + (event.key === 'ArrowRight' ? 1 : -1));
        this.focusIndex.set(next);
        if (this.openIndex() >= 0) this.openMenu(next, false);
        this.topElement(next)?.focus();
        return;
      }
      case 'Escape':
        this.close(true);
        return;
    }
  }

  protected onMenuKey(event: KeyboardEvent, m: number): void {
    const items = this.enabledItems(m);
    const current = items.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        items[(current + step + items.length) % items.length]?.focus();
        return;
      }
      case 'Home':
      case 'End':
        event.preventDefault();
        (event.key === 'Home' ? items[0] : items[items.length - 1])?.focus();
        return;
      case 'ArrowRight':
      case 'ArrowLeft':
        event.preventDefault();
        this.openMenu(this.wrap(m + (event.key === 'ArrowRight' ? 1 : -1)), true);
        return;
      case 'Escape':
        event.preventDefault();
        this.close(true);
        return;
      case 'Tab':
        this.close(false);
        return;
    }
  }

  protected onOutside(event: PointerEvent): void {
    if (this.openIndex() >= 0 && !this.host.nativeElement.contains(event.target as Node)) this.close(false);
  }

  private close(returnFocus: boolean): void {
    const m = this.openIndex();
    this.openIndex.set(-1);
    if (returnFocus && m >= 0) this.topElement(m)?.focus();
  }

  private wrap(m: number): number {
    return (m + MENUS.length) % MENUS.length;
  }

  private focusEdgeItem(m: number, fromEnd: boolean): void {
    const items = this.enabledItems(m);
    (fromEnd ? items[items.length - 1] : items[0])?.focus();
  }

  private enabledItems(m: number): HTMLElement[] {
    const root = this.host.nativeElement as HTMLElement;
    const menu = root.querySelectorAll<HTMLElement>('.mm__slot')[m];
    return menu ? [...menu.querySelectorAll<HTMLElement>('.mm__item:not(.mm__item--disabled)')] : [];
  }

  private itemElement(m: number, i: number): HTMLElement | null {
    const root = this.host.nativeElement as HTMLElement;
    return root.querySelectorAll<HTMLElement>('.mm__slot')[m]?.querySelector<HTMLElement>(`[data-item="${i}"]`) ?? null;
  }

  private topElement(m: number): HTMLElement | null {
    return (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-top="${m}"]`);
  }

  private afterRender(fn: () => void): void {
    afterNextRender(fn, { injector: this.injector });
  }
}
