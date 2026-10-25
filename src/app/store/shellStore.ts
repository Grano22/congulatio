import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

export type ShellDialog = 'about' | 'tour' | 'history' | 'reset' | 'remove-dialogue' | 'remove-soul';

export type ShellNotice = { kind: 'success' | 'error' | 'info'; text: string };

export type LayoutPresetId = 'balanced' | 'writer' | 'codex' | 'map' | 'stage';

export type LayoutPreset = {
  id: LayoutPresetId;
  label: string;
  hint: string;
  leftVisible: boolean;
  leftWidth: number;
  inspectorVisible: boolean;
  inspectorWidth: number;
};

export const LEFT_MIN = 320;
export const LEFT_MAX = 680;
export const INSPECTOR_MIN = 260;
export const INSPECTOR_MAX = 420;

export const LAYOUT_PRESETS: LayoutPreset[] = [
  { id: 'balanced', label: 'Balanced', hint: 'Codex 420 · Inspector 292', leftVisible: true, leftWidth: 420, inspectorVisible: true, inspectorWidth: 292 },
  { id: 'writer', label: 'Writer', hint: 'Narrow codex, roomy inspector', leftVisible: true, leftWidth: 320, inspectorVisible: true, inspectorWidth: 380 },
  { id: 'codex', label: 'Codex focus', hint: 'Wide codex, slim inspector', leftVisible: true, leftWidth: 600, inspectorVisible: true, inspectorWidth: 260 },
  { id: 'map', label: 'Map & inspector', hint: 'No codex, inspector beside the map', leftVisible: false, leftWidth: 420, inspectorVisible: true, inspectorWidth: 340 },
  { id: 'stage', label: 'Wide stage', hint: 'Both side panes hidden', leftVisible: false, leftWidth: 420, inspectorVisible: false, inspectorWidth: 292 },
];

const LAYOUT_KEY = 'congulatio.layout.v1';
const NOTICE_MS = 4000;

type StoredLayout = Pick<LayoutPreset, 'leftVisible' | 'leftWidth' | 'inspectorVisible' | 'inspectorWidth'> & {
  inspectorReadonly?: boolean;
};

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, Math.round(v)));

function readLayout(): StoredLayout | null {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<StoredLayout>;
    return {
      leftVisible: v.leftVisible !== false,
      leftWidth: clamp(Number(v.leftWidth) || 420, LEFT_MIN, LEFT_MAX),
      inspectorVisible: v.inspectorVisible !== false,
      inspectorWidth: clamp(Number(v.inspectorWidth) || 292, INSPECTOR_MIN, INSPECTOR_MAX),
      inspectorReadonly: v.inspectorReadonly === true,
    };
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class ShellStore {
  private readonly stored: StoredLayout = readLayout() ?? LAYOUT_PRESETS[0];

  readonly leftVisible = signal(this.stored.leftVisible);
  readonly leftWidth = signal(this.stored.leftWidth);
  readonly inspectorVisible = signal(this.stored.inspectorVisible);
  readonly inspectorWidth = signal(this.stored.inspectorWidth);
  readonly inspectorReadonly = signal(this.stored.inspectorReadonly ?? false);
  readonly maximized = signal(false);
  readonly fullscreen = signal(false);
  readonly searchFocus = signal(0);
  readonly dialog = signal<ShellDialog | null>(null);
  readonly removeDialogueId = signal<string | null>(null);
  readonly removeSoulId = signal<string | null>(null);
  readonly notice = signal<ShellNotice | null>(null);
  private noticeTimer?: ReturnType<typeof setTimeout>;

  readonly activePreset = computed(
    () =>
      LAYOUT_PRESETS.find(
        (p) =>
          p.leftVisible === this.leftVisible() &&
          p.inspectorVisible === this.inspectorVisible() &&
          (!p.leftVisible || p.leftWidth === this.leftWidth()) &&
          (!p.inspectorVisible || p.inspectorWidth === this.inspectorWidth()),
      )?.id ?? null,
  );

  constructor() {
    effect(() => {
      const layout: StoredLayout = {
        leftVisible: this.leftVisible(),
        leftWidth: this.leftWidth(),
        inspectorVisible: this.inspectorVisible(),
        inspectorWidth: this.inspectorWidth(),
        inspectorReadonly: this.inspectorReadonly(),
      };
      try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
      } catch {
        return;
      }
    });
    const onFullscreen = (): void => this.fullscreen.set(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      clearTimeout(this.noticeTimer);
    });
  }

  applyPreset(id: LayoutPresetId): void {
    const preset = LAYOUT_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    this.leftVisible.set(preset.leftVisible);
    this.leftWidth.set(preset.leftWidth);
    this.inspectorVisible.set(preset.inspectorVisible);
    this.inspectorWidth.set(preset.inspectorWidth);
    this.maximized.set(false);
  }

  setLeftWidth(width: number): void {
    this.leftWidth.set(clamp(width, LEFT_MIN, LEFT_MAX));
  }

  toggleFullscreen(): void {
    const doc = document;
    if (!doc.documentElement.requestFullscreen || !doc.exitFullscreen) {
      this.notify('error', 'This browser does not allow fullscreen.');
      return;
    }
    const request = doc.fullscreenElement ? doc.exitFullscreen() : doc.documentElement.requestFullscreen();
    void request.catch(() => this.notify('error', 'Fullscreen was blocked by the browser.'));
  }

  open(dialog: ShellDialog): void {
    this.dialog.set(dialog);
  }

  confirmRemoveDialogue(id: string): void {
    this.removeDialogueId.set(id);
    this.dialog.set('remove-dialogue');
  }

  confirmRemoveSoul(id: string): void {
    this.removeSoulId.set(id);
    this.dialog.set('remove-soul');
  }

  closeDialog(): void {
    this.dialog.set(null);
  }

  notify(kind: ShellNotice['kind'], text: string): void {
    clearTimeout(this.noticeTimer);
    this.notice.set({ kind, text });
    this.noticeTimer = setTimeout(() => this.notice.set(null), NOTICE_MS);
  }
}
