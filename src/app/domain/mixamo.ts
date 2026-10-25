import { AnimationAction, AnimationClip, AnimationMixer, Bone, Group, Matrix4, Mesh, Quaternion, SkinnedMesh, Vector3 } from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { FigureRig, JOINT_ORDER, JOINT_PARENT, JointName, applyRestPose } from './figureRig';

export const MIXAMO_URL = 'https://www.mixamo.com/#/';

export class MixamoError extends Error {}

type SourceBone = { bone: Bone; bindWorld: Quaternion };

export type MixamoAnimation = {
  id: string;
  name: string;
  duration: number;
  source: Group;
  mixer: AnimationMixer;
  action: AnimationAction;
  bones: Map<string, SourceBone>;
  hipsBindPosition: Vector3;
};

const JOINT_SOURCES: Record<JointName, string[]> = {
  Hips: ['Hips'],
  Spine: ['Spine2', 'Spine1', 'Spine'],
  Neck: ['Neck'],
  Head: ['Head'],
  LeftArm: ['LeftArm'],
  LeftForeArm: ['LeftForeArm'],
  LeftHand: ['LeftHand'],
  RightArm: ['RightArm'],
  RightForeArm: ['RightForeArm'],
  RightHand: ['RightHand'],
  LeftUpLeg: ['LeftUpLeg'],
  LeftLeg: ['LeftLeg'],
  LeftFoot: ['LeftFoot'],
  RightUpLeg: ['RightUpLeg'],
  RightLeg: ['RightLeg'],
  RightFoot: ['RightFoot'],
};

let animationCounter = 0;

export const mixamoStem = (name: string): string => name.replace(/^mixamorig\d*[:_]?/i, '');

const titleFrom = (fileName: string): string =>
  fileName.replace(/\.fbx$/i, '').replace(/[_-]+/g, ' ').trim() || 'Animation';

function bindPoses(source: Group, bones: Bone[]): Map<Bone, Quaternion> {
  source.updateMatrixWorld(true);
  const poses = new Map<Bone, Quaternion>();
  source.traverse((node) => {
    if (!(node instanceof SkinnedMesh)) return;
    node.skeleton.bones.forEach((bone, i) => {
      const bind = new Matrix4().copy(node.skeleton.boneInverses[i]).invert();
      poses.set(bone, new Quaternion().setFromRotationMatrix(bind));
    });
  });
  for (const bone of bones) {
    if (!poses.has(bone)) poses.set(bone, bone.getWorldQuaternion(new Quaternion()));
  }
  return poses;
}

export async function loadMixamoFile(file: File): Promise<MixamoAnimation> {
  if (!/\.fbx$/i.test(file.name)) throw new MixamoError(`${file.name} is not an .fbx file.`);
  let source: Group;
  try {
    source = new FBXLoader().parse(await file.arrayBuffer(), '');
  } catch {
    throw new MixamoError(`${file.name} could not be read as FBX.`);
  }
  const clip: AnimationClip | undefined = source.animations[0];
  if (!clip) throw new MixamoError(`${file.name} holds no animation.`);

  const allBones: Bone[] = [];
  source.traverse((node) => {
    if (node instanceof Bone) allBones.push(node);
  });
  const poses = bindPoses(source, allBones);
  const bones = new Map<string, SourceBone>();
  for (const bone of allBones) bones.set(mixamoStem(bone.name), { bone, bindWorld: poses.get(bone)! });
  const hips = bones.get('Hips');
  if (!hips) throw new MixamoError(`${file.name} has no Mixamo skeleton.`);

  animationCounter += 1;
  const mixer = new AnimationMixer(source);
  return {
    id: `mixamo-${animationCounter}`,
    name: titleFrom(file.name),
    duration: clip.duration,
    source,
    mixer,
    action: mixer.clipAction(clip),
    bones,
    hipsBindPosition: hips.bone.getWorldPosition(new Vector3()),
  };
}

const scratchQuat = new Quaternion();
const scratchVec = new Vector3();

export function applyMixamoPose(rig: FigureRig, animation: MixamoAnimation, inPlace: boolean): void {
  animation.source.updateMatrixWorld(true);
  const worlds = new Map<JointName, Quaternion>();
  for (const name of JOINT_ORDER) {
    const joint = rig.joints.get(name)!;
    const parentName = JOINT_PARENT[name];
    const parentWorld = parentName ? worlds.get(parentName)! : new Quaternion();
    const source = JOINT_SOURCES[name].map((stem) => animation.bones.get(stem)).find((b) => !!b);
    if (!source) {
      joint.quaternion.identity();
      worlds.set(name, parentWorld.clone());
      continue;
    }
    const delta = source.bone.getWorldQuaternion(scratchQuat).clone().multiply(source.bindWorld.clone().invert());
    worlds.set(name, delta);
    joint.quaternion.copy(parentWorld.clone().invert().multiply(delta));
  }

  const hips = animation.bones.get('Hips')!.bone.getWorldPosition(scratchVec);
  const bindY = animation.hipsBindPosition.y || 1;
  const scale = rig.hipHeight / bindY;
  const offset = hips.sub(animation.hipsBindPosition).multiplyScalar(scale);
  rig.joints.get('Hips')!.position.set(inPlace ? 0 : offset.x, rig.hipHeight + offset.y, inPlace ? 0 : offset.z);
}

export function stopMixamo(rig: FigureRig | null, animation: MixamoAnimation): void {
  animation.action.stop();
  if (rig) applyRestPose(rig);
}

export function disposeMixamo(animation: MixamoAnimation): void {
  animation.action.stop();
  animation.mixer.uncacheRoot(animation.source);
  animation.source.traverse((node) => {
    if (node instanceof Mesh) {
      node.geometry.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((m) => m.dispose());
    }
  });
}
