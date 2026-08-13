/**
 * Focused web checks for Guessing Challenge catalog + Real3D / fallback UI wiring.
 * Does not fully render WebGL in jsdom — tests boundaries and source contracts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { getGameCatalogEntry } from '@/lib/public/game-catalog';
import { mockLobbyGames, mockGameSettingsByGameId } from '@/lib/lobby/mock-games';
import { getHomeGameShowcase } from '@/lib/home/game-showcase';
import { getGameRoundCategories } from '@/lib/game/round-categories/registry';
import { resolveIdentityCardText, splitIdentityDisplayLines } from '../plugins/guessing-challenge/identity-display';
import { detectWebGLSupport } from '../plugins/guessing-challenge/scene-props';
import {
  cameraPositionForSeat,
  mapRemoteLookPitch,
  mapRemoteLookYaw,
  teammateSeatPosition,
} from '../plugins/guessing-challenge/real3d/seat-layout';

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
    console.error(error instanceof Error ? error.message : error);
  }
}

function readPlugin(relativePath: string): string {
  return readFileSync(join(root, 'plugins/guessing-challenge', relativePath), 'utf8');
}

function readLobby(relativePath: string): string {
  return readFileSync(join(root, 'components/lobby', relativePath), 'utf8');
}

function readPkg(): string {
  return readFileSync(join(root, 'package.json'), 'utf8');
}

test('catalog card exists and marks 2 or 4 players', () => {
  const entry = getGameCatalogEntry('guessing-challenge');
  assert.equal(entry.availability, 'available');
  assert.equal(entry.playerRange, '٢ أو ٤ لاعبين');
  assert.equal(entry.featured, true);

  const lobby = mockLobbyGames.find((game) => game.id === 'guessing-challenge');
  assert.ok(lobby);
  assert.equal(lobby.title, 'تحدي التخمين');
  assert.equal(getHomeGameShowcase('guessing-challenge').availability, 'available');

  const settings = mockGameSettingsByGameId['guessing-challenge'];
  assert.ok(settings.some((item) => item.id === 'mode'));
  assert.ok(settings.some((item) => item.value.includes('1 ضد 1')));
});

test('round categories include random and football', () => {
  const config = getGameRoundCategories('guessing-challenge');
  assert.ok(config);
  assert.ok(config.categories.some((category) => category.id === 'random'));
  assert.ok(config.categories.some((category) => category.id === 'football'));
});

test('A/B identity helper: own hidden, opponent visible text', () => {
  assert.equal(resolveIdentityCardText(null, true), '؟؟؟');
  assert.equal(
    resolveIdentityCardText({ type: 'text', value: 'بطريق', imageUrl: null }, false),
    'بطريق',
  );
  assert.deepEqual(splitIdentityDisplayLines('كريستيانو رونالدو'), [
    'كريستيانو',
    'رونالدو',
  ]);
  assert.deepEqual(splitIdentityDisplayLines('صراع العروش'), ['صراع', 'العروش']);
  assert.deepEqual(splitIdentityDisplayLines('برج إيفل'), ['برج', 'إيفل']);
  assert.deepEqual(splitIdentityDisplayLines('ميسي'), ['ميسي']);
});

test('A lazy Real3D loader + CSS fallback exist', () => {
  const gameplay = readPlugin('gameplay-scene.tsx');
  const real3d = readPlugin('real3d/real3d-scene.tsx');
  const pkg = readPkg();

  assert.match(gameplay, /next\/dynamic/);
  assert.match(gameplay, /ssr:\s*false/);
  assert.match(gameplay, /real3d\/real3d-scene/);
  assert.match(gameplay, /detectWebGLSupport/);
  assert.match(gameplay, /FirstPersonGameScene/);
  assert.match(gameplay, /gc-css-fallback-scene/);
  assert.match(real3d, /Real3DErrorBoundary/);
  assert.match(real3d, /FirstPersonGameScene/);
  assert.match(pkg, /"three"/);
  assert.match(pkg, /"@react-three\/fiber"/);
  assert.match(pkg, /"@react-three\/drei"/);
});

test('detectWebGLSupport is safe without browser GL', () => {
  assert.equal(typeof detectWebGLSupport(), 'boolean');
});

test('C/D/E/F/G playing screen wires GameplayScene + side special cards + matchMode', () => {
  const playing = readPlugin('playing-screen.tsx');
  const scene = readPlugin('first-person-game-scene.tsx');
  const special = readPlugin('special-card-button.tsx');
  const specialPanel = readPlugin('special-cards-panel.tsx');
  const realInner = readPlugin('real3d/real3d-scene-inner.tsx');
  const table = readPlugin('real3d/table-and-cards.tsx');

  assert.match(playing, /GameplayScene/);
  assert.match(playing, /selfHidden/);
  assert.match(playing, /opponentIdentity=\{view\.opponent\.visibleIdentity\}/);
  assert.match(playing, /opponentName=\{view\.opponent\.name\}/);
  assert.match(playing, /selfIdentity=\{null\}/);
  assert.match(playing, /turnTitle/);
  assert.match(playing, /gc-end-question/);
  assert.match(playing, /gc-open-guess/);
  assert.match(playing, /gc-final-guess-panel/);
  assert.match(playing, /onSubmit=/);
  assert.match(playing, /type="submit"/);
  assert.match(playing, /isComposing/);
  assert.match(playing, /composingGuessRef/);
  assert.match(playing, /submitCurrentGuess/);
  assert.match(playing, /showSpecialCards=\{false\}/);
  assert.match(playing, /matchMode=\{view\.mode\}/);
  assert.match(playing, /onLookChange=\{onLookChange\}/);
  assert.match(playing, /GuessingChallengeSpecialCardsPanel/);
  assert.match(playing, /ما هي هوية فريقكم؟/);
  assert.match(playing, /تم تغيير هويتكم بواسطة البطاقة الحمراء/);
  assert.doesNotMatch(playing, /secretIdentity/);
  assert.doesNotMatch(playing, /confirmCard/);

  assert.match(specialPanel, /gc-yellow-card/);
  assert.match(specialPanel, /gc-red-card/);
  assert.match(specialPanel, /gc-card-detail/);
  assert.match(specialPanel, /gc-confirm-card-use/);
  assert.match(specialPanel, /استخدام واحد فقط في المباراة/);
  assert.match(specialPanel, /تم الاستخدام/);
  assert.match(specialPanel, /البطاقة الصفراء/);
  assert.match(specialPanel, /تمنح فريقك 3 أسئلة متتالية/);
  assert.match(specialPanel, /تغيّر هوية الخصم إلى هوية جديدة من نفس الفئة/);
  assert.match(specialPanel, /بانتظار موافقة شريكك/);
  assert.match(specialPanel, /استخدام البطاقة/);
  assert.match(specialPanel, /data-compact="true"/);
  assert.match(specialPanel, /gc-teammate-card-request/);
  assert.match(specialPanel, /تحتاج موافقتك/);
  assert.match(specialPanel, /playSoftCardRequestPing/);
  assert.match(specialPanel, /gc-once-per-match-warning/);
  assert.match(specialPanel, /عرض البطاقة/);
  assert.match(specialPanel, /يريد استخدام/);
  assert.match(specialPanel, /موافقة/);
  assert.match(specialPanel, /رفض/);
  assert.match(specialPanel, /gc-reject-card-use/);
  assert.doesNotMatch(specialPanel, /بدلاً من سؤال واحد/);
  assert.doesNotMatch(specialPanel, /عشوائية/);

  assert.match(scene, /gc-first-person-scene/);
  assert.match(scene, /gc-opponent-identity/);
  assert.match(scene, /gc-self-identity/);
  assert.match(special, /gc-yellow-card/);
  assert.match(special, /gc-red-card/);

  assert.match(realInner, /gc-real3d-scene/);
  assert.match(realInner, /gc-recenter-camera/);
  assert.match(realInner, /Canvas/);
  assert.match(realInner, /LoungeRoom/);
  assert.match(realInner, /FirstPersonHands/);
  assert.match(realInner, /matchMode/);
  // Special cards moved off the 3D table into side DOM UI
  assert.doesNotMatch(table, /gc-yellow-card/);
  assert.doesNotMatch(table, /gc-red-card/);
  assert.doesNotMatch(realInner, /gc-yellow-card/);
  assert.doesNotMatch(realInner, /gc-red-card/);
  assert.match(table, /LoungeRoom/);
  assert.doesNotMatch(playing, /VS/);
  assert.doesNotMatch(playing, /CharacterFigure name=\{view\.self\.name\}/);
});

test('look emit is fire-and-forget and patches look updates', () => {
  const hook = readPlugin('use-player-view.ts');
  assert.match(hook, /GUESSING_CHALLENGE_LOOK_EVENT/);
  assert.match(hook, /GUESSING_CHALLENGE_LOOK_UPDATE_EVENT/);
  assert.match(hook, /emitLook/);
  assert.match(hook, /\.emit\(GUESSING_CHALLENGE_LOOK_EVENT/);
  assert.doesNotMatch(hook, /emitPluginWithAck\(GUESSING_CHALLENGE_LOOK_EVENT/);
  assert.match(hook, /lookYaw/);
  assert.match(hook, /lookPitch/);
});

test('game screen passes emitLook to playing screen', () => {
  const gameScreen = readPlugin('game-screen.tsx');
  assert.match(gameScreen, /emitLook/);
  assert.match(gameScreen, /onLookChange=\{emitLook\}/);
});

test('lobby mode settings panel + start emit wiring', () => {
  const settingsPanel = readLobby('guessing-challenge-settings-panel.tsx');
  const gameSettings = readLobby('game-settings-panel.tsx');
  const startPanel = readLobby('lobby-start-game-panel.tsx');
  const roomContext = readFileSync(join(root, 'contexts/room-context.tsx'), 'utf8');

  assert.match(settingsPanel, /1 ضد 1/);
  assert.match(settingsPanel, /2 ضد 2/);
  assert.match(settingsPanel, /يلزم لاعبان/);
  assert.match(settingsPanel, /يلزم 4 لاعبين/);
  assert.match(gameSettings, /GuessingChallengeSettingsPanel/);
  assert.match(startPanel, /guessingChallengeMode/);
  assert.match(roomContext, /guessingChallengeMode/);
  assert.match(roomContext, /guessingChallenge:\s*\{\s*mode:\s*guessingChallengeMode\s*\}/);
});

test('start validation enforces exact 2 / 4 by mode', () => {
  const validation = readFileSync(join(root, 'lib/game-shell/start-validation.ts'), 'utf8');
  assert.match(validation, /mode\?: GuessingChallengeMode/);
  assert.match(validation, /resolvedMode === '2v2'/);
  assert.match(validation, /activeParticipantCount !== 4/);
  assert.match(validation, /activeParticipantCount !== 2/);
  assert.match(validation, /1 ضد 1/);
  assert.match(validation, /2 ضد 2/);
});

test('plugin registry maxPlayers is 4', () => {
  const index = readPlugin('index.tsx');
  assert.match(index, /minPlayers:\s*2/);
  assert.match(index, /maxPlayers:\s*4/);
});

test('H reveal screen feeds revealed identity + 2v2 composition props', () => {
  const results = readPlugin('round-results-screen.tsx');
  assert.match(results, /GameplayScene/);
  assert.match(results, /mode="reveal"/);
  assert.match(results, /selfIdentity=\{selfReveal\?\.identity/);
  assert.match(results, /matchMode=\{view\.mode\}/);
  assert.match(results, /teammate=\{mappedTeammate\}/);
  assert.match(results, /opponents=\{mappedOpponents\}/);
  assert.match(results, /view\.opponent\.visibleIdentity/);
  assert.match(results, /showSpecialCards=\{false\}/);
  assert.doesNotMatch(results, /secretIdentity/);
  assert.doesNotMatch(results, />\s*VS\s*</);
});

test('camera look limits + no pointer lock / locomotion', () => {
  const look = readPlugin('real3d/look-controls.tsx');
  assert.match(look, /DEFAULT_YAW_LIMIT|yawLimit/);
  assert.match(look, /DEFAULT_PITCH_LIMIT|pitchLimit/);
  assert.match(look, /onLookChange/);
  assert.match(look, /pointerdown/);
  assert.doesNotMatch(look, /requestPointerLock/);
  assert.doesNotMatch(look, /WASD|keydown|velocity/);
});

test('plugin registry does not eagerly import three', () => {
  const index = readPlugin('index.tsx');
  const gameScreen = readPlugin('game-screen.tsx');
  const gameplay = readPlugin('gameplay-scene.tsx');
  assert.doesNotMatch(index, /three|@react-three/);
  assert.doesNotMatch(gameScreen, /three|@react-three/);
  assert.doesNotMatch(gameplay, /from ['"]three['"]/);
  assert.doesNotMatch(gameplay, /from ['"]@react-three/);
});

test('turn indicator is not clipped by the scene wrapper', () => {
  const playing = readPlugin('playing-screen.tsx');
  const inner = readPlugin('real3d/real3d-scene-inner.tsx');
  assert.doesNotMatch(playing, /relative overflow-hidden rounded-\[1\.5rem\]/);
  assert.match(inner, /gc-turn-indicator/);
  assert.match(inner, /overflow-visible/);
  assert.match(inner, /break-words/);
});

test('I primary actions remain DOM outside canvas', () => {
  const playing = readPlugin('playing-screen.tsx');
  assert.match(playing, /gc-primary-actions/);
  assert.match(playing, /GameplayScene/);
});

test('2v2 seating faces opponents; shared card + name anchors', () => {
  const inner = readPlugin('real3d/real3d-scene-inner.tsx');
  const opponent = readPlugin('real3d/low-poly-opponent.tsx');
  const bean = readPlugin('real3d/bean-character.tsx');
  const hands = readPlugin('real3d/first-person-hands.tsx');
  const layout = readPlugin('real3d/seat-layout.ts');

  assert.match(inner, /userData=\{\{ testId: 'gc-teammate-seat'/);
  assert.match(inner, /userData=\{\{ testId: 'gc-opponent-pair' \}\}/);
  assert.match(inner, /teammateSeatPosition/);
  assert.match(inner, /cameraPositionForSeat/);
  assert.match(inner, /mapRemoteLookYaw/);
  assert.match(inner, /same-as-local/);
  assert.match(inner, /toward-camera/);
  assert.match(layout, /TEAMMATE_Z/);
  assert.match(layout, /SEAT_CAMERA_X/);
  assert.doesNotMatch(inner, /position=\{\[x, 0, 1\.4\]\}/);
  assert.doesNotMatch(inner, /selfSeat === 0 \? 1\.1 : -1\.1/);
  assert.match(inner, /Math\.PI/);
  assert.match(inner, /-2\.15/);
  assert.match(bean, /lookYaw \* 0\.62/);
  assert.match(bean, /headPitch = lookPitch \* 0\.45/);
  assert.match(hands, /blank/);
  assert.doesNotMatch(hands, /blank=\{!revealed\}/);
  assert.doesNotMatch(hands, /resolveIdentityCardText/);
  assert.match(inner, /sharedCard: true/);
  assert.match(inner, /holdHand="right"/);
  assert.match(inner, /holdHand="left"/);
  assert.match(opponent, /data-name-anchor="above-head"/);
  assert.match(inner, /data-name-anchor="above-head"/);
  assert.match(bean, /nameBadge/);
  const lounge = readPlugin('real3d/lounge-room.tsx');
  assert.match(lounge, /position=\{\[-3\.25, 2\.95, -4\.28\]\}/);
  const cardMesh = readPlugin('real3d/identity-card-mesh.tsx');
  assert.match(cardMesh, /CanvasTexture|createTexture/);
  assert.match(cardMesh, /meshBasicMaterial/);
  assert.match(cardMesh, /paintCard/);
  assert.match(cardMesh, /blank/);
  assert.match(cardMesh, /splitIdentityDisplayLines/);
  assert.match(cardMesh, /wrapIdentityLines/);
  assert.match(cardMesh, /widest/);
  assert.doesNotMatch(cardMesh, /fitFontSize/);
  assert.doesNotMatch(cardMesh, /from '@react-three\/drei'/);
  const specialPanel = readPlugin('special-cards-panel.tsx');
  assert.match(specialPanel, /createPortal/);
  assert.match(specialPanel, /gc-reject-card-use/);
  assert.match(specialPanel, /top-\[18%\]/);
  assert.doesNotMatch(specialPanel, /bottom-3/);
  assert.doesNotMatch(opponent, /data-seat-facing=/);
  assert.doesNotMatch(inner, /data-facing=/);
  assert.doesNotMatch(inner, /data-shared-card=/);
  assert.match(bean, /holdHand/);
  assert.match(bean, /lookYaw \* 0\.05/);
  assert.match(hands, /FirstPersonHands|gc-self-identity/);
  assert.doesNotMatch(inner, /selfAvatar|LocalAvatar/);
  assert.match(inner, /no local third-person body/);
});

test('card request sound helper exists once-per-request', () => {
  const sounds = readFileSync(join(root, 'lib/game/sounds.ts'), 'utf8');
  const panel = readPlugin('special-cards-panel.tsx');
  assert.match(sounds, /playSoftCardRequestPing/);
  assert.match(panel, /lastPingKey/);
  assert.match(panel, /playSoftCardRequestPing\(\)/);
});

test('authoritative generations are sent with every gameplay mutation', () => {
  const hook = readPlugin('use-player-view.ts');
  assert.match(hook, /roundId:\s*view\.roundId/);
  assert.match(hook, /turnId:\s*view\.turnId/);
  assert.match(hook, /requestId:\s*view\.cardConfirmStatus\.requestId/);
  assert.match(hook, /deadlineAtMs/);
  assert.match(hook, /remainingSeconds/);
  assert.doesNotMatch(hook, /GUESSING_CHALLENGE_SET_CATEGORY_EVENT/);
});

test('minimal spectator screen replaces participant controls', () => {
  const game = readPlugin('game-screen.tsx');
  assert.match(game, /view\.isMatchSpectator && view\.gamePhase === 'playing'/);
  assert.match(game, /أنت مشاهد حالياً/);
  assert.match(game, /remainingSeconds/);
  assert.match(game, /MATCH_FINAL_RESULTS_AUTO_LOBBY_SECONDS/);
});

test('round results use authoritative team winner and no category control', () => {
  const results = readPlugin('round-results-screen.tsx');
  assert.match(results, /view\.winningTeamId === view\.selfTeam/);
  assert.match(results, /opponentHighlight=\{opponentWon\}/);
  assert.match(results, /remainingSeconds/);
  assert.doesNotMatch(results, /RoundCategoryPanel/);
  assert.doesNotMatch(results, /nextCategoryId/);
});

test('lobby category is locked for the whole guessing-challenge match', () => {
  const panel = readFileSync(join(root, 'components/lobby/round-category-panel.tsx'), 'utf8');
  assert.match(panel, /GUESSING_CHALLENGE_GAME_ID/);
  assert.match(panel, /تُقفل الفئة عند بدء المباراة وتستخدم لكل الجولات الأربع/);
});

test('2v2 seats are mirrored and teammate is not in the camera near field', () => {
  const blue0Cam = cameraPositionForSeat('2v2', 0);
  const blue1Cam = cameraPositionForSeat('2v2', 1);
  const red0Cam = cameraPositionForSeat('2v2', 0);
  const red1Cam = cameraPositionForSeat('2v2', 1);
  const tm0 = teammateSeatPosition(0);
  const tm1 = teammateSeatPosition(1);

  assert.equal(blue0Cam[0], -blue1Cam[0]);
  assert.equal(blue0Cam[0], red0Cam[0]);
  assert.equal(blue1Cam[0], red1Cam[0]);
  assert.equal(tm0[0], -tm1[0]);
  assert.ok(tm0[0] > 0, 'seat 0 teammate sits to the right');
  assert.ok(tm1[0] < 0, 'seat 1 teammate sits to the left');
  assert.equal(cameraPositionForSeat('1v1', 0)[0], 0);
  assert.equal(cameraPositionForSeat('1v1', 1)[0], 0);

  for (const seat of [0, 1] as const) {
    const cam = cameraPositionForSeat('2v2', seat);
    const tm = teammateSeatPosition(seat);
    const depth = cam[2] - tm[2];
    const side = Math.abs(tm[0] - cam[0]);
    assert.ok(depth > 1.7, `seat ${seat} teammate must sit well in front of camera`);
    assert.ok(side > 1.5, `seat ${seat} teammate must sit beside, not in the aisle`);
    assert.ok(Math.abs(tm[0]) > Math.abs(cam[0]), 'teammate is outward of the local seat');
    const head = new THREE.Vector3(tm[0], 1.05, tm[2]);
    const camPos = new THREE.Vector3(cam[0], cam[1], cam[2]);
    const headDist = head.distanceTo(camPos);
    assert.ok(headDist > 2.45, `seat ${seat} must stay farther than the giant near-camera layout`);
    assert.ok(headDist < 2.85, `seat ${seat} must stay closer than the disconnected far layout`);

    const camera = new THREE.PerspectiveCamera(55, 1.8, 0.15, 40);
    camera.position.copy(camPos);
    camera.quaternion.setFromEuler(new THREE.Euler(0, 0, 0, 'YXZ'));
    camera.updateMatrixWorld();
    const tmNdc = head.clone().project(camera);
    const oppNdc = new THREE.Vector3(0, 1.05, -2.2).project(camera);
    assert.ok(Math.abs(tmNdc.x) > 0.7, `seat ${seat} teammate stays on the side`);
    assert.ok(Math.abs(tmNdc.x) < 1.2, `seat ${seat} teammate remains a side presence`);
    assert.ok(Math.abs(oppNdc.x) < 0.35, `seat ${seat} opponents stay in view`);
  }
});

test('remote look yaw maps look-left to world left for every 2v2 facing', () => {
  const lookLeft = 0.6;
  const lookRight = -0.6;
  assert.equal(mapRemoteLookYaw(lookLeft, 'same-as-local'), lookLeft);
  assert.equal(mapRemoteLookYaw(lookLeft, 'toward-camera'), -lookLeft);
  assert.equal(mapRemoteLookYaw(lookRight, 'toward-camera'), -lookRight);
  assert.equal(mapRemoteLookPitch(0.4), 0.4);
  assert.equal(mapRemoteLookPitch(-0.3), -0.3);

  function beanFaceWorldX(parentYaw: number, mappedLookYaw: number): number {
    const parent = new THREE.Group();
    parent.rotation.y = parentYaw;
    const head = new THREE.Group();
    head.rotation.y = mappedLookYaw * 0.62;
    parent.add(head);
    parent.updateMatrixWorld(true);
    return new THREE.Vector3(0, 0, 1).applyQuaternion(
      head.getWorldQuaternion(new THREE.Quaternion()),
    ).x;
  }

  assert.ok(beanFaceWorldX(Math.PI, mapRemoteLookYaw(lookLeft, 'same-as-local')) < 0);
  assert.ok(beanFaceWorldX(0, mapRemoteLookYaw(lookLeft, 'toward-camera')) < 0);
  assert.ok(beanFaceWorldX(Math.PI, mapRemoteLookYaw(lookRight, 'same-as-local')) > 0);
  assert.ok(beanFaceWorldX(0, mapRemoteLookYaw(lookRight, 'toward-camera')) > 0);

  function beanFaceWorldY(parentYaw: number, mappedLookPitch: number): number {
    const parent = new THREE.Group();
    parent.rotation.y = parentYaw;
    const head = new THREE.Group();
    head.rotation.x = mappedLookPitch * 0.45;
    parent.add(head);
    parent.updateMatrixWorld(true);
    return new THREE.Vector3(0, 0, 1).applyQuaternion(
      head.getWorldQuaternion(new THREE.Quaternion()),
    ).y;
  }

  const lookUp = 0.5;
  const teammatePitchY = beanFaceWorldY(Math.PI, mapRemoteLookPitch(lookUp));
  const opponentPitchY = beanFaceWorldY(0, mapRemoteLookPitch(lookUp));
  assert.equal(Math.sign(teammatePitchY), Math.sign(opponentPitchY));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
