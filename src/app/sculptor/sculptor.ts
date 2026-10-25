import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { Camera, CircleAlert, CircleCheck, Play, RotateCcw, Save, Square, Upload } from 'lucide';
import {
  CircleGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RpgPanel } from '../ui/rpg-panel';
import { RpgButton } from '../ui/rpg-button';
import { LucideIcon } from '../ui/lucide-icon';
import { CharactersStore } from '../store/charactersStore';
import { WorkspaceStore } from '../store/workspaceStore';
import { BUILD_PRESETS, BUILD_RANGES, BuildKey, BuildPreset, CharacterBuild, buildOf, defaultBuild, sameBuild } from '../domain/build';
import { Appearance, HAIR_COLORS, HAIR_PRESETS, HairPresetId, appearanceOf } from '../domain/hair';
import { FigureRig, buildFigure, disposeFigure, headWorldPosition, lookOf } from '../domain/figureRig';
import { MIXAMO_URL, MixamoAnimation, MixamoError, applyMixamoPose, disposeMixamo, loadMixamoFile, stopMixamo } from '../domain/mixamo';

type SculptNotice = { kind: 'success' | 'error'; text: string };

type SculptSection = 'body' | 'hair' | 'animate';

const NOTICE_MS = 3500;
const PORTRAIT_SIZE = 256;

type Stage = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  ground: Mesh;
  resize: ResizeObserver;
  rig: FigureRig | null;
  lastFrame: number;
};

@Component({
  selector: 'app-sculptor',
  imports: [RpgPanel, RpgButton, LucideIcon],
  styleUrl: './sculptor.css',
  templateUrl: './sculptor.html',
})
export class Sculptor {
  private readonly store = inject(CharactersStore);
  private readonly workspace = inject(WorkspaceStore);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('stage');
  private stage: Stage | null = null;

  protected readonly saveIcon = Save;
  protected readonly resetIcon = RotateCcw;
  protected readonly avatarIcon = Camera;
  protected readonly playIcon = Play;
  protected readonly stopIcon = Square;
  protected readonly uploadIcon = Upload;
  protected readonly successIcon = CircleCheck;
  protected readonly errorIcon = CircleAlert;
  protected readonly presets = BUILD_PRESETS;
  protected readonly hairPresets = HAIR_PRESETS;
  protected readonly hairColors = HAIR_COLORS;
  protected readonly mixamoUrl = MIXAMO_URL;
  protected readonly sections: { id: SculptSection; label: string }[] = [
    { id: 'body', label: 'Body' },
    { id: 'hair', label: 'Hair' },
    { id: 'animate', label: 'Animate' },
  ];

  protected readonly section = signal<SculptSection>('body');
  protected readonly souls = this.store.characters;
  protected readonly characterId = linkedSignal(() => {
    const focus = this.workspace.focus();
    return (focus?.kind === 'soul' ? focus.id : null) ?? this.store.selectedId() ?? this.store.characters()[0]?.id ?? '';
  });
  protected readonly character = computed(() => this.souls().find((c) => c.id === this.characterId()) ?? null);
  protected readonly draft = linkedSignal<CharacterBuild | null>(() => {
    const c = this.character();
    return c ? buildOf(c) : null;
  });
  protected readonly look = linkedSignal<Appearance | null>(() => {
    const c = this.character();
    return c ? appearanceOf(c) : null;
  });
  protected readonly ranges = computed(() =>
    BUILD_RANGES.filter((r) => !r.femaleOnly || this.character()?.sex === 'female'),
  );
  protected readonly activePreset = computed(() => {
    const d = this.draft();
    return d ? (BUILD_PRESETS.find((p) => sameBuild(p.build, d))?.id ?? null) : null;
  });
  protected readonly dirty = computed(() => {
    const c = this.character();
    const d = this.draft();
    const l = this.look();
    if (!c || !d || !l) return false;
    const saved = appearanceOf(c);
    return !sameBuild(buildOf(c), d) || saved.hair !== l.hair || saved.hairColor !== l.hairColor;
  });

  protected readonly animations = signal<MixamoAnimation[]>([]);
  protected readonly playingId = signal<string | null>(null);
  protected readonly inPlace = signal(true);
  protected readonly loading = signal(false);

  protected readonly webglFailed = signal(false);
  protected readonly notice = signal<SculptNotice | null>(null);
  private noticeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    afterNextRender(() => this.mountStage());
    effect(() => {
      const c = this.character();
      const d = this.draft();
      const l = this.look();
      if (c && d && l) this.showFigure(buildFigure(d, lookOf(c, l)));
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.noticeTimer);
      this.animations().forEach(disposeMixamo);
      this.unmountStage();
    });
  }

  protected pickSoul(id: string): void {
    this.characterId.set(id);
    this.workspace.focusOn({ kind: 'soul', id });
  }

  protected setValue(key: BuildKey, value: string): void {
    this.draft.update((d) => (d ? { ...d, [key]: Number(value) } : d));
  }

  protected applyPreset(preset: BuildPreset): void {
    this.draft.set({ ...preset.build });
  }

  protected setHair(hair: HairPresetId): void {
    this.look.update((l) => (l ? { ...l, hair } : l));
  }

  protected setHairColor(hairColor: string): void {
    this.look.update((l) => (l ? { ...l, hairColor } : l));
  }

  protected format(value: number, key: BuildKey): string {
    return key === 'chest' ? `${Math.round(value * 100)}%` : `×${value.toFixed(2)}`;
  }

  protected resetToDefault(): void {
    const c = this.character();
    if (c) this.draft.set(defaultBuild(c));
  }

  protected save(): void {
    const c = this.character();
    const d = this.draft();
    const l = this.look();
    if (!c || !d || !l) return this.notify('error', 'Choose a soul to sculpt.');
    const outOfRange = BUILD_RANGES.find((r) => d[r.key] < r.min || d[r.key] > r.max);
    if (outOfRange) return this.notify('error', `${outOfRange.label} is out of range.`);
    try {
      this.store.save({ ...c, build: d, appearance: l });
    } catch {
      return this.notify('error', 'The clay cracked. The build could not be saved.');
    }
    this.notify('success', `${c.firstName}’s build was saved to the Codex.`);
  }

  protected makeAvatar(): void {
    const c = this.character();
    const d = this.draft();
    const l = this.look();
    if (!c || !d || !l) return this.notify('error', 'Choose a soul to sculpt.');
    if (!this.stage?.rig) return this.notify('error', 'The 3D stage is not ready, so no avatar can be taken.');
    let portrait: string;
    try {
      portrait = this.capturePortrait(this.stage);
    } catch {
      return this.notify('error', 'The portrait could not be captured.');
    }
    this.store.save({ ...c, build: d, appearance: l, portrait });
    this.notify('success', `${c.firstName}’s avatar was made from the sculpt.`);
  }

  protected async loadAnimations(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const files = [...(inputEl.files ?? [])];
    inputEl.value = '';
    if (!files.length) return;
    this.loading.set(true);
    const loaded: MixamoAnimation[] = [];
    const failures: string[] = [];
    for (const file of files) {
      try {
        loaded.push(await loadMixamoFile(file));
      } catch (e) {
        failures.push(e instanceof MixamoError ? e.message : `${file.name} could not be loaded.`);
      }
    }
    this.loading.set(false);
    if (loaded.length) {
      this.animations.update((list) => [...list, ...loaded]);
      this.play(loaded[0]);
    }
    if (failures.length) this.notify('error', failures.join(' '));
    else this.notify('success', `${loaded.length} animation${loaded.length === 1 ? '' : 's'} loaded from Mixamo.`);
  }

  protected play(animation: MixamoAnimation): void {
    const current = this.animations().find((a) => a.id === this.playingId());
    if (current && current !== animation) current.action.stop();
    animation.action.reset().play();
    this.playingId.set(animation.id);
  }

  protected stop(): void {
    const current = this.animations().find((a) => a.id === this.playingId());
    if (current) stopMixamo(this.stage?.rig ?? null, current);
    this.playingId.set(null);
  }

  protected remove(animation: MixamoAnimation): void {
    if (animation.id === this.playingId()) this.stop();
    disposeMixamo(animation);
    this.animations.update((list) => list.filter((a) => a !== animation));
  }

  private capturePortrait(stage: Stage): string {
    const head = headWorldPosition(stage.rig!);
    const shot = new PerspectiveCamera(24, stage.camera.aspect, 0.05, 20);
    shot.position.set(head.x + 0.12, head.y + 0.04, head.z + 1.1);
    shot.lookAt(head.x, head.y - 0.06, head.z);
    stage.ground.visible = false;
    stage.renderer.render(stage.scene, shot);
    const source = stage.renderer.domElement;
    const side = Math.min(source.width, source.height);
    const canvas = document.createElement('canvas');
    canvas.width = PORTRAIT_SIZE;
    canvas.height = PORTRAIT_SIZE;
    const ctx = canvas.getContext('2d')!;
    const backdrop = ctx.createRadialGradient(128, 90, 10, 128, 128, 180);
    backdrop.addColorStop(0, '#423b2f');
    backdrop.addColorStop(1, '#131110');
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
    ctx.drawImage(source, (source.width - side) / 2, (source.height - side) / 2, side, side, 0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
    stage.ground.visible = true;
    return canvas.toDataURL('image/png');
  }

  private mountStage(): void {
    const el = this.host().nativeElement;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      this.webglFailed.set(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    const scene = new Scene();
    scene.add(new HemisphereLight(0xfff4d6, 0x221406, 1.4));
    const sun = new DirectionalLight(0xffe2b0, 2.4);
    sun.position.set(2, 4, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    const ground = new Mesh(new CircleGeometry(1.1, 10), new MeshStandardMaterial({ color: 0x26221c, flatShading: true }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const camera = new PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0.6, 1.3, 4.4);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.9, 0);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minDistance = 1.2;
    controls.maxDistance = 7;
    controls.maxPolarAngle = Math.PI * 0.55;

    const resize = new ResizeObserver(() => {
      const { clientWidth: w, clientHeight: h } = el;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resize.observe(el);

    const stage: Stage = { renderer, scene, camera, controls, ground, resize, rig: null, lastFrame: performance.now() };
    this.stage = stage;
    renderer.setAnimationLoop((now: number) => {
      const dt = Math.min(0.1, (now - stage.lastFrame) / 1000);
      stage.lastFrame = now;
      const playing = this.animations().find((a) => a.id === this.playingId());
      if (playing && stage.rig) {
        playing.mixer.update(dt);
        applyMixamoPose(stage.rig, playing, this.inPlace());
      }
      controls.update();
      renderer.render(scene, camera);
    });
    const c = this.character();
    const d = this.draft();
    const l = this.look();
    if (c && d && l) this.showFigure(buildFigure(d, lookOf(c, l)));
  }

  private showFigure(rig: FigureRig): void {
    const stage = this.stage;
    if (!stage) {
      disposeFigure(rig);
      return;
    }
    if (stage.rig) {
      stage.scene.remove(stage.rig.root);
      disposeFigure(stage.rig);
    }
    stage.scene.add(rig.root);
    stage.rig = rig;
    stage.controls.target.y = rig.height * 0.5;
  }

  private unmountStage(): void {
    const stage = this.stage;
    if (!stage) return;
    stage.renderer.setAnimationLoop(null);
    stage.resize.disconnect();
    stage.controls.dispose();
    if (stage.rig) {
      stage.scene.remove(stage.rig.root);
      disposeFigure(stage.rig);
    }
    stage.scene.traverse((node) => {
      if (node instanceof Mesh) {
        node.geometry.dispose();
        (node.material as MeshStandardMaterial).dispose();
      }
    });
    stage.renderer.dispose();
    stage.renderer.domElement.remove();
    this.stage = null;
  }

  private notify(kind: SculptNotice['kind'], text: string): void {
    clearTimeout(this.noticeTimer);
    this.notice.set({ kind, text });
    this.noticeTimer = setTimeout(() => this.notice.set(null), NOTICE_MS);
  }
}
