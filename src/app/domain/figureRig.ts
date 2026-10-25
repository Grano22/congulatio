import { BoxGeometry, BufferGeometry, Group, Mesh, MeshStandardMaterial, Object3D, SphereGeometry, Vector3 } from 'three';
import type { CharacterBuild } from './build';
import type { RandomCharacter } from './randomCharacter';
import { Appearance, HairPresetId, appearanceOf } from './hair';

type Vec3 = [number, number, number];

export type JointName =
  | 'Hips'
  | 'Spine'
  | 'Neck'
  | 'Head'
  | 'LeftArm'
  | 'LeftForeArm'
  | 'LeftHand'
  | 'RightArm'
  | 'RightForeArm'
  | 'RightHand'
  | 'LeftUpLeg'
  | 'LeftLeg'
  | 'LeftFoot'
  | 'RightUpLeg'
  | 'RightLeg'
  | 'RightFoot';

export const JOINT_PARENT: Record<JointName, JointName | null> = {
  Hips: null,
  Spine: 'Hips',
  Neck: 'Spine',
  Head: 'Neck',
  LeftArm: 'Spine',
  LeftForeArm: 'LeftArm',
  LeftHand: 'LeftForeArm',
  RightArm: 'Spine',
  RightForeArm: 'RightArm',
  RightHand: 'RightForeArm',
  LeftUpLeg: 'Hips',
  LeftLeg: 'LeftUpLeg',
  LeftFoot: 'LeftLeg',
  RightUpLeg: 'Hips',
  RightLeg: 'RightUpLeg',
  RightFoot: 'RightLeg',
};

export const JOINT_ORDER = Object.keys(JOINT_PARENT) as JointName[];

export type FigureLook = {
  skin: string;
  eyes: string;
  cloth: string;
  trousers: string;
  sex: RandomCharacter['sex'];
  pointedEars: boolean;
  hair: HairPresetId;
  hairColor: string;
};

export type FigureRig = {
  root: Group;
  joints: Map<JointName, Object3D>;
  hipHeight: number;
  height: number;
  headCenter: Object3D;
};

const CLOTH_BY_RACE: Record<string, string> = {
  Human: '#6e2418',
  Elf: '#3f5a2a',
  Dwarf: '#7a5c12',
  Orc: '#432c14',
  Halfling: '#557a38',
  Undead: '#322d24',
};

const ARM_REST_ANGLE = 1.3;
const FOREARM_REST_ANGLE = 0.15;

export function lookOf(character: RandomCharacter, appearance: Appearance = appearanceOf(character)): FigureLook {
  return {
    skin: character.face[7]?.[3] ?? '#d9a86f',
    eyes: character.face[5]?.[4] ?? '#4a2f1a',
    cloth: CLOTH_BY_RACE[character.race] ?? '#6e2418',
    trousers: '#31200d',
    sex: character.sex,
    pointedEars: character.race === 'Elf',
    hair: appearance.hair,
    hairColor: appearance.hairColor,
  };
}

export function buildFigure(build: CharacterBuild, look: FigureLook): FigureRig {
  const materials = new Map<string, MeshStandardMaterial>();
  const material = (color: string): MeshStandardMaterial => {
    let m = materials.get(color);
    if (!m) {
      m = new MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 });
      materials.set(color, m);
    }
    return m;
  };
  const add = (parent: Object3D, geometry: BufferGeometry, color: string, position: Vec3, scale: Vec3 = [1, 1, 1]): void => {
    const mesh = new Mesh(geometry, material(color));
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    parent.add(mesh);
  };
  const box = (parent: Object3D, color: string, position: Vec3, size: Vec3): void =>
    add(parent, new BoxGeometry(...size), color, position);
  const blob = (parent: Object3D, color: string, position: Vec3, radii: Vec3, detail: [number, number] = [8, 6]): void =>
    add(parent, new SphereGeometry(1, ...detail), color, position, radii);

  const joints = new Map<JointName, Object3D>();
  const joint = (name: JointName, position: Vec3): Object3D => {
    const node = new Object3D();
    node.name = name;
    node.position.set(...position);
    const parentName = JOINT_PARENT[name];
    (parentName ? joints.get(parentName)! : root).add(node);
    joints.set(name, node);
    return node;
  };

  const h = build.height;
  const g = build.girth;
  const female = look.sex === 'female';

  const legLength = 0.82 * build.legLength * h;
  const legWidth = 0.13 * build.legGirth * Math.sqrt(g);
  const thighLength = (legLength - 0.06) / 2;
  const shinLength = thighLength;
  const torsoHeight = 0.62 * h;
  const torsoWidth = (female ? 0.38 : 0.44) * g;
  const torsoDepth = 0.24 * g;
  const headRadius = 0.16 * Math.sqrt(h);
  const hipSpread = Math.max(legWidth / 2 + 0.01, torsoWidth / 2 - legWidth / 2);
  const armLength = 0.6 * build.armLength * h;
  const upperArm = armLength * 0.5;
  const foreArm = armLength * 0.42;
  const armWidth = 0.1 * Math.sqrt(g);
  const handRadius = 0.05 * build.handSize;

  const root = new Group();
  const hips = joint('Hips', [0, legLength, 0]);
  box(hips, look.cloth, [0, 0.03, 0], [torsoWidth * (female ? 1.15 : 1), 0.14, torsoDepth * 1.02]);

  const spine = joint('Spine', [0, 0.05, 0]);
  const spineHeight = torsoHeight - 0.05;
  box(spine, look.cloth, [0, spineHeight / 2, 0], [torsoWidth, spineHeight, torsoDepth]);
  if (g > 1.05) {
    const belly = (g - 1) * 0.5;
    blob(spine, look.cloth, [0, spineHeight * 0.28, torsoDepth / 2], [torsoWidth * 0.42, spineHeight * 0.3, 0.05 + belly * 0.3], [7, 5]);
  }
  if (female) {
    const r = 0.035 + 0.055 * build.chest;
    for (const side of [-1, 1]) {
      blob(spine, look.cloth, [side * torsoWidth * 0.21, spineHeight * 0.68, torsoDepth / 2 - r * 0.45], [r, r * 0.85, r * 0.7], [7, 5]);
    }
  }

  const neck = joint('Neck', [0, spineHeight, 0]);
  box(neck, look.skin, [0, 0.04, 0], [0.09, 0.1, 0.09]);
  const head = joint('Head', [0, 0.08, 0]);
  const headCenter = new Object3D();
  headCenter.position.set(0, headRadius * 0.95, 0);
  head.add(headCenter);
  blob(headCenter, look.skin, [0, 0, 0], [headRadius * 0.88, headRadius, headRadius * 0.92], [9, 7]);
  const eyeR = 0.022 * build.eyeSize;
  for (const side of [-1, 1]) {
    const eye: Vec3 = [side * headRadius * 0.36, headRadius * 0.12, headRadius * 0.84];
    blob(headCenter, '#f2e6c4', eye, [eyeR * 1.4, eyeR * 1.2, eyeR * 0.5], [6, 4]);
    blob(headCenter, look.eyes, [eye[0], eye[1], eye[2] + eyeR * 0.4], [eyeR * 0.75, eyeR * 0.75, eyeR * 0.3], [6, 4]);
    const earHeight = look.pointedEars ? 0.12 : 0.06;
    box(headCenter, look.skin, [side * headRadius * 0.9, look.pointedEars ? 0.04 : 0, -0.01], [0.03, earHeight, 0.05]);
  }
  addHair(headCenter, look.hair, look.hairColor, headRadius, box, blob);

  for (const [side, prefix] of [
    [1, 'Left'],
    [-1, 'Right'],
  ] as const) {
    const arm = joint(`${prefix}Arm`, [side * (torsoWidth / 2 + 0.01), spineHeight - 0.05, 0]);
    box(arm, look.cloth, [(side * upperArm) / 2, 0, 0], [upperArm, armWidth, armWidth]);
    const fore = joint(`${prefix}ForeArm`, [side * upperArm, 0, 0]);
    box(fore, look.cloth, [(side * foreArm) / 2, 0, 0], [foreArm, armWidth * 0.9, armWidth * 0.9]);
    const hand = joint(`${prefix}Hand`, [side * foreArm, 0, 0]);
    blob(hand, look.skin, [side * handRadius * 0.9, 0, 0], [handRadius * 1.15, handRadius * 0.8, handRadius], [6, 4]);

    const thigh = joint(`${prefix}UpLeg`, [side * hipSpread, 0, 0]);
    box(thigh, look.trousers, [0, -thighLength / 2, 0], [legWidth, thighLength, legWidth * 1.05]);
    const shin = joint(`${prefix}Leg`, [0, -thighLength, 0]);
    box(shin, look.trousers, [0, -shinLength / 2, 0], [legWidth * 0.92, shinLength, legWidth * 0.95]);
    const foot = joint(`${prefix}Foot`, [0, -shinLength, 0]);
    box(foot, '#150c04', [0, -0.03, legWidth * 0.3], [legWidth * 1.1, 0.06, legWidth * 1.7]);
  }

  const rig: FigureRig = {
    root,
    joints,
    hipHeight: legLength,
    height: legLength + torsoHeight + 0.08 + headRadius * 2.1,
    headCenter,
  };
  applyRestPose(rig);
  return rig;
}

type BoxFn = (parent: Object3D, color: string, position: Vec3, size: Vec3) => void;
type BlobFn = (parent: Object3D, color: string, position: Vec3, radii: Vec3, detail?: [number, number]) => void;

function addHair(head: Object3D, style: HairPresetId, color: string, r: number, box: BoxFn, blob: BlobFn): void {
  const cap = (): void => box(head, color, [0, r * 0.82, -0.01], [r * 1.9, r * 0.45, r * 1.95]);
  const back = (length: number): void => box(head, color, [0, r * 0.6 - length / 2, -r * 0.82], [r * 1.85, length, r * 0.35]);
  switch (style) {
    case 'bald':
      return;
    case 'crop':
      box(head, color, [0, r * 0.86, 0], [r * 1.82, r * 0.25, r * 1.88]);
      return;
    case 'short':
      cap();
      back(r * 1.2);
      return;
    case 'long':
      cap();
      back(r * 2.6);
      for (const side of [-1, 1]) box(head, color, [side * r * 0.88, r * 0.4 - r * 0.8, -r * 0.1], [r * 0.25, r * 1.6, r * 1.4]);
      return;
    case 'ponytail':
      cap();
      back(r * 1.1);
      blob(head, color, [0, r * 0.3, -r * 1.0], [r * 0.22, r * 0.22, r * 0.22], [6, 4]);
      box(head, color, [0, -r * 0.5, -r * 1.08], [r * 0.35, r * 1.4, r * 0.3]);
      return;
    case 'bun':
      cap();
      back(r * 1.1);
      blob(head, color, [0, r * 0.75, -r * 0.95], [r * 0.4, r * 0.4, r * 0.4], [7, 5]);
      return;
    case 'topknot':
      cap();
      blob(head, color, [0, r * 1.3, -r * 0.1], [r * 0.25, r * 0.4, r * 0.25], [6, 4]);
      return;
    case 'mohawk':
      box(head, color, [0, r * 1.05, -r * 0.05], [r * 0.3, r * 0.55, r * 1.9]);
      return;
    case 'braids':
      cap();
      back(r * 1.1);
      for (const side of [-1, 1]) box(head, color, [side * r * 0.75, r * 0.1 - r * 1.1, -r * 0.2], [r * 0.22, r * 2.2, r * 0.22]);
      return;
    case 'bearded':
      cap();
      back(r * 1.2);
      box(head, color, [0, -r * 0.62, r * 0.55], [r * 1.35, r * 0.7, r * 0.5]);
      box(head, color, [0, -r * 0.22, r * 0.88], [r * 0.8, r * 0.14, r * 0.14]);
      return;
  }
}

export function applyRestPose(rig: FigureRig): void {
  for (const node of rig.joints.values()) node.quaternion.identity();
  rig.joints.get('Hips')!.position.set(0, rig.hipHeight, 0);
  rig.joints.get('LeftArm')!.rotation.set(0, 0, -ARM_REST_ANGLE);
  rig.joints.get('RightArm')!.rotation.set(0, 0, ARM_REST_ANGLE);
  rig.joints.get('LeftForeArm')!.rotation.set(0, -FOREARM_REST_ANGLE, 0);
  rig.joints.get('RightForeArm')!.rotation.set(0, FOREARM_REST_ANGLE, 0);
}

export function headWorldPosition(rig: FigureRig): Vector3 {
  rig.root.updateMatrixWorld(true);
  return rig.headCenter.getWorldPosition(new Vector3());
}

export function disposeFigure(rig: FigureRig): void {
  const materials = new Set<MeshStandardMaterial>();
  rig.root.traverse((node) => {
    if (node instanceof Mesh) {
      node.geometry.dispose();
      materials.add(node.material as MeshStandardMaterial);
    }
  });
  materials.forEach((m) => m.dispose());
}

