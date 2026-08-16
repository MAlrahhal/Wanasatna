/**
 * P9-B.4 Guessing Challenge 3D performance contracts.
 * Seat/camera geometry and desktop composition stay frozen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAMERA_FOV,
  CAMERA_Y,
  CAMERA_Z,
  cameraPositionForSeat,
  mapRemoteLookPitch,
  mapRemoteLookYaw,
  teammateSeatPosition,
} from '../plugins/guessing-challenge/real3d/seat-layout';
import { GC_COMPACT_GPU_MQ } from '../plugins/guessing-challenge/real3d/gpu-profile';
import {
  clearGcLooks,
  getGcLook,
  setGcLook,
} from '../plugins/guessing-challenge/real3d/look-runtime';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : error);
  }
}

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

test('desktop seat/camera geometry is unchanged', () => {
  assert.equal(CAMERA_FOV, 55);
  assert.equal(CAMERA_Y, 1.35);
  assert.equal(CAMERA_Z, 1.65);
  assert.deepEqual(cameraPositionForSeat('1v1', 0), [0, 1.35, 1.65]);
  assert.deepEqual(cameraPositionForSeat('2v2', 0), [-0.26, 1.35, 1.65]);
  assert.deepEqual(cameraPositionForSeat('2v2', 1), [0.26, 1.35, 1.65]);
  assert.deepEqual(teammateSeatPosition(0), [1.22, 0, 1.53]);
  assert.deepEqual(teammateSeatPosition(1), [-1.22, 0, 1.53]);
  assert.equal(mapRemoteLookYaw(0.6, 'toward-camera'), -0.6);
  assert.equal(mapRemoteLookYaw(0.6, 'same-as-local'), 0.6);
  assert.equal(mapRemoteLookPitch(0.4), 0.4);

  const inner = read('plugins/guessing-challenge/real3d/real3d-scene-inner.tsx');
  assert.match(inner, /fov: CAMERA_FOV/);
  assert.match(inner, /-2\.15/);
  assert.match(inner, /position=\{\[-0\.62, 0, -2\.2\]\}/);
  assert.match(inner, /position=\{\[0\.62, 0, -2\.2\]\}/);
  assert.doesNotMatch(inner, /fov:\s*(?!CAMERA_FOV)\d+/);
});

test('1v1 and 2v2 scene composition stays in place', () => {
  const inner = read('plugins/guessing-challenge/real3d/real3d-scene-inner.tsx');
  assert.match(inner, /matchMode === '2v2'/);
  assert.match(inner, /gc-opponent-pair/);
  assert.match(inner, /gc-teammate-seat/);
  assert.match(inner, /no local third-person body/);
  assert.match(inner, /holdHand="right"/);
  assert.match(inner, /holdHand="left"/);
  assert.match(inner, /sharedCard: true/);
});

test('head/look mapping and live look store stay wired', () => {
  const bean = read('plugins/guessing-challenge/real3d/bean-character.tsx');
  const look = read('plugins/guessing-challenge/real3d/look-controls.tsx');
  const hook = read('plugins/guessing-challenge/use-player-view.ts');
  assert.match(bean, /lookYaw \* lookYawScale/);
  assert.match(bean, /headPitch = lookPitch \* 0\.45/);
  assert.match(bean, /lookYaw \* 0\.05/);
  assert.match(bean, /getGcLook/);
  assert.match(bean, /mapRemoteLookYaw/);
  assert.match(look, /DEFAULT_YAW_LIMIT = \(38 \* Math\.PI\) \/ 180/);
  assert.match(look, /DEFAULT_PITCH_LIMIT = \(18 \* Math\.PI\) \/ 180/);
  assert.doesNotMatch(look, /requestPointerLock/);
  assert.match(hook, /setGcLook\(payload\.playerId, payload\.yaw, payload\.pitch\)/);
  assert.doesNotMatch(hook, /patchLookInView/);
  assert.doesNotMatch(hook, /setView\(\(prev\) => \(prev \? patchLookInView/);

  clearGcLooks();
  setGcLook('opp-1', 0.4, -0.2);
  assert.deepEqual(getGcLook('opp-1'), { yaw: 0.4, pitch: -0.2 });
  setGcLook('opp-1', 0.4, -0.2);
  assert.deepEqual(getGcLook('opp-1'), { yaw: 0.4, pitch: -0.2 });
  clearGcLooks();
  assert.equal(getGcLook('opp-1'), undefined);
});

test('render loop uses demand + invalidate, and pauses when hidden', () => {
  const inner = read('plugins/guessing-challenge/real3d/real3d-scene-inner.tsx');
  const look = read('plugins/guessing-challenge/real3d/look-controls.tsx');
  assert.match(inner, /frameloop=\{pageVisible \? 'demand' : 'never'\}/);
  assert.match(inner, /SceneFramePulse/);
  assert.match(inner, /registerGcCanvasInvalidator/);
  assert.match(inner, /visibilityState === 'hidden'/);
  assert.match(look, /invalidate\(\)/);
  assert.doesNotMatch(inner, /frameloop="always"/);
});

test('desktop DPR/shadows stay; mobile-only GPU caps exist', () => {
  const inner = read('plugins/guessing-challenge/real3d/real3d-scene-inner.tsx');
  const lounge = read('plugins/guessing-challenge/real3d/lounge-room.tsx');
  const gpu = read('plugins/guessing-challenge/real3d/gpu-profile.ts');
  assert.equal(GC_COMPACT_GPU_MQ, '(max-width: 430px)');
  assert.match(gpu, /max-width: 430px/);
  assert.match(inner, /dpr=\{compactGpu \? \[1, 1\] : \[1, 1\.5\]\}/);
  assert.match(inner, /shadow-mapSize=\{compactGpu \? \[512, 512\] : \[1024, 1024\]\}/);
  assert.match(inner, /antialias: !compactGpu/);
  assert.match(inner, /MobileShadowFreeze/);
  assert.match(lounge, /castShadow=\{!compactGpu\}/);
  assert.match(lounge, /OrangeArmchair/);
  assert.match(lounge, /position=\{\[-3\.25, 2\.95, -4\.28\]\}/);
});

test('useFrame paths do not allocate Vector3/Euler/Quaternion per frame', () => {
  const look = read('plugins/guessing-challenge/real3d/look-controls.tsx');
  const bean = read('plugins/guessing-challenge/real3d/bean-character.tsx');
  const hands = read('plugins/guessing-challenge/real3d/first-person-hands.tsx');
  for (const source of [look, bean, hands]) {
    assert.doesNotMatch(source, /useFrame\([\s\S]*new THREE\.Vector3/);
    assert.doesNotMatch(source, /useFrame\([\s\S]*new THREE\.Quaternion/);
  }
  assert.match(look, /euler = useRef\(new THREE\.Euler/);
  assert.match(look, /lastEmitted\.current\.yaw = nYaw/);
  assert.match(hands, /createPortal/);
  assert.doesNotMatch(hands, /position\.copy\(camera\.position\)/);
});

test('useThree subscriptions are selector-based', () => {
  const inner = read('plugins/guessing-challenge/real3d/real3d-scene-inner.tsx');
  const look = read('plugins/guessing-challenge/real3d/look-controls.tsx');
  const hands = read('plugins/guessing-challenge/real3d/first-person-hands.tsx');
  assert.doesNotMatch(inner, /useThree\(\)/);
  assert.doesNotMatch(look, /useThree\(\)/);
  assert.doesNotMatch(hands, /useThree\(\)/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
