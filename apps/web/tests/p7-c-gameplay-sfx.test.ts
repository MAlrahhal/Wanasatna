/**
 * P7-C gameplay SFX: original assets, policy, wiring, mute/reconnect/privacy.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decideCountdownTick,
  decideFinalCue,
  decidePublicCorrect,
  decideRoundResult,
  decideTimeUp,
  decideYourTurn,
  localTeamWonMatch,
  localWonMatch,
} from '../lib/game/sfx-policy';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SFX_FILES = {
  'countdown-tick': 'countdown-tick.wav',
  go: 'go.wav',
  'your-turn': 'your-turn.wav',
  correct: 'correct.mp3',
  wrong: 'wrong.wav',
  'time-up': 'time-up.wav',
  'round-result': 'round-result.wav',
  'match-win': 'match-win.wav',
  notify: 'notify.wav',
  'timing-window': 'timing-window.wav',
  'imposter-reveal': 'imposter-reveal.wav',
} as const;

class MemoryStorage {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  clear(): void {
    this.data.clear();
  }
}

class FakeAudio {
  static instances: FakeAudio[] = [];
  src = '';
  volume = 1;
  muted = false;
  paused = true;
  currentTime = 0;
  preload = 'auto';
  playCalls = 0;
  rejectPlay = false;
  onended: (() => void) | null = null;

  constructor() {
    FakeAudio.instances.push(this);
  }

  play(): Promise<void> {
    this.playCalls += 1;
    if (this.rejectPlay) {
      return Promise.reject(new Error('blocked'));
    }
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }
}

const localStorage = new MemoryStorage();
let hidden = false;

Object.assign(globalThis, {
  window: globalThis,
  localStorage,
  document: {
    get hidden() {
      return hidden;
    },
    addEventListener(): void {},
    removeEventListener(): void {},
  },
  Audio: FakeAudio,
});

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

function playCount(): number {
  return FakeAudio.instances.reduce((sum, node) => sum + node.playCalls, 0);
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

void (async () => {
  const audio = await import('../lib/game/sounds');

  function setup(): void {
    FakeAudio.instances = [];
    hidden = false;
    localStorage.clear();
    audio.resetGameAudioForTests();
  }

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
    try {
      await fn();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${name}`);
      console.error(error instanceof Error ? error.message : error);
    }
  }

  await test('SFX files exist and registry paths match', () => {
    let total = 0;
    for (const [id, filename] of Object.entries(SFX_FILES)) {
      const path = join(root, 'public', 'audio', 'sfx', filename);
      assert.equal(existsSync(path), true, id);
      total += statSync(path).size;
    }
    assert.equal(existsSync(join(root, 'public', 'sounds', 'timer-start.wav')), false);
    assert.equal(existsSync(join(root, 'public', 'audio', 'sfx', 'correct.wav')), false);
    assert.ok(total <= 2 * 1024 * 1024, `total ${total}`);
  });

  await test('registry paths match files and no obsolete aliases', () => {
    const sounds = read('lib/game/sounds.ts');
    for (const filename of Object.values(SFX_FILES)) {
      assert.match(sounds, new RegExp(`/audio/sfx/${filename.replace('.', '\\.')}`));
    }
    assert.doesNotMatch(sounds, /timer-start|\/sounds\//);
    assert.doesNotMatch(sounds, /'card-request'|setGameAudioVolume/);
  });

  await test('countdown: remount silent; 3→2→1 three ticks; rerender no duplicate; no tick at 0', () => {
    let cursor = decideCountdownTick(null, true, 3);
    assert.equal(cursor.play, null);
    cursor = decideCountdownTick(cursor.next, true, 3);
    assert.equal(cursor.play, null);
    cursor = decideCountdownTick('idle', true, 3);
    assert.equal(cursor.play, 3);
    cursor = decideCountdownTick(cursor.next, true, 2);
    assert.equal(cursor.play, 2);
    cursor = decideCountdownTick(cursor.next, true, 2);
    assert.equal(cursor.play, null);
    cursor = decideCountdownTick(cursor.next, true, 1);
    assert.equal(cursor.play, 1);
    cursor = decideCountdownTick(cursor.next, true, 0);
    assert.equal(cursor.play, null);
  });

  await test('your-turn privacy and first-mount silence', () => {
    assert.equal(
      decideYourTurn({
        prevReady: false,
        prevTurnKey: null,
        acting: true,
        turnKey: 'draw:1',
        spectator: false,
      }),
      null,
    );
    assert.equal(
      decideYourTurn({
        prevReady: true,
        prevTurnKey: 'draw:1',
        acting: true,
        turnKey: 'draw:1',
        spectator: false,
      }),
      null,
    );
    assert.deepEqual(
      decideYourTurn({
        prevReady: true,
        prevTurnKey: null,
        acting: true,
        turnKey: 'draw:2',
        spectator: false,
      }),
      { id: 'your-turn', eventKey: 'turn:draw:2' },
    );
    assert.equal(
      decideYourTurn({
        prevReady: true,
        prevTurnKey: null,
        acting: true,
        turnKey: 'draw:2',
        spectator: true,
      }),
      null,
    );
    assert.equal(
      decideYourTurn({
        prevReady: true,
        prevTurnKey: null,
        acting: false,
        turnKey: 'draw:2',
        spectator: false,
      }),
      null,
    );
  });

  await test('correct once; no result-screen duplicate; wrong only when decided', () => {
    assert.deepEqual(
      decidePublicCorrect({
        prevReady: true,
        wasCorrect: false,
        isCorrect: true,
        eventKey: 'correct:draw:1',
      }),
      { id: 'correct', eventKey: 'correct:draw:1' },
    );
    assert.equal(
      decidePublicCorrect({
        prevReady: true,
        wasCorrect: true,
        isCorrect: true,
        eventKey: 'correct:draw:1',
      }),
      null,
    );
    assert.equal(
      decidePublicCorrect({
        prevReady: false,
        wasCorrect: false,
        isCorrect: true,
        eventKey: 'correct:draw:1',
      }),
      null,
    );
  });

  await test('time-up only on genuine remaining 0; suppress early resolve', () => {
    const timed = new Set(['question']);
    assert.deepEqual(
      decideTimeUp({
        prevReady: true,
        prevRemaining: 4,
        remaining: 0,
        phase: 'question',
        timedPhases: timed,
        eventKey: 'timeup:1',
      }),
      { id: 'time-up', eventKey: 'timeup:1' },
    );
    assert.equal(
      decideTimeUp({
        prevReady: true,
        prevRemaining: 4,
        remaining: 0,
        phase: 'question',
        timedPhases: timed,
        eventKey: 'timeup:1',
        suppress: true,
      }),
      null,
    );
    assert.equal(
      decideTimeUp({
        prevReady: false,
        prevRemaining: 4,
        remaining: 0,
        phase: 'question',
        timedPhases: timed,
        eventKey: 'timeup:1',
      }),
      null,
    );
    assert.equal(
      decideTimeUp({
        prevReady: true,
        prevRemaining: 0,
        remaining: 0,
        phase: 'question',
        timedPhases: timed,
        eventKey: 'timeup:1',
      }),
      null,
    );
  });

  await test('round-result once; match-win winner only; tie and spectator no match-win', () => {
    assert.deepEqual(
      decideRoundResult({
        prevReady: true,
        prevPhase: 'playing',
        phase: 'round-results',
        eventKey: 'result:1',
      }),
      { id: 'round-result', eventKey: 'result:1' },
    );
    assert.equal(
      decideRoundResult({
        prevReady: true,
        prevPhase: 'round-results',
        phase: 'round-results',
        eventKey: 'result:1',
      }),
      null,
    );
    const board = [
      { playerId: 'a', isFirstPlace: true, rank: 1 },
      { playerId: 'b', isFirstPlace: false, rank: 2 },
    ];
    assert.equal(localWonMatch(board, 'a'), true);
    assert.equal(localWonMatch(board, 'b'), false);
    const tie = [
      { playerId: 'a', isFirstPlace: true, rank: 1 },
      { playerId: 'b', isFirstPlace: true, rank: 1 },
    ];
    assert.equal(localWonMatch(tie, 'a'), false);
    const teamWin = [
      { playerId: 'a', isFirstPlace: true, rank: 1 },
      { playerId: 'b', isFirstPlace: true, rank: 1 },
      { playerId: 'c', isFirstPlace: false, rank: 3 },
      { playerId: 'd', isFirstPlace: false, rank: 4 },
    ];
    assert.equal(localTeamWonMatch(teamWin, ['a', 'b']), true);
    assert.equal(localTeamWonMatch(teamWin, ['c', 'd']), false);
    assert.deepEqual(
      decideFinalCue({
        prevReady: true,
        prevPhase: 'round-results',
        phase: 'match-completed',
        spectator: false,
        localWon: true,
        eventKey: 'final:1',
      }),
      { id: 'match-win', eventKey: 'final:1:win' },
    );
    assert.equal(
      decideFinalCue({
        prevReady: true,
        prevPhase: 'round-results',
        phase: 'match-completed',
        spectator: false,
        localWon: false,
        eventKey: 'final:1',
      }),
      null,
    );
    assert.equal(
      decideFinalCue({
        prevReady: true,
        prevPhase: 'round-results',
        phase: 'match-completed',
        spectator: true,
        localWon: true,
        eventKey: 'final:1',
      }),
      null,
    );
    assert.deepEqual(
      decideFinalCue({
        prevReady: true,
        prevPhase: 'playing',
        phase: 'match-completed',
        spectator: true,
        localWon: false,
        eventKey: 'final:1',
      }),
      { id: 'round-result', eventKey: 'final:1:end' },
    );
  });

  await test('mute consumes eventKey; unmute does not replay; hidden suppresses', async () => {
    setup();
    audio.unlockGameAudio();
    await flush();
    audio.setGameAudioMuted(true);
    const before = playCount();
    audio.playGameSound('correct', { eventKey: 'correct:x' });
    audio.setGameAudioMuted(false);
    audio.playGameSound('correct', { eventKey: 'correct:x' });
    assert.equal(playCount(), before);
    hidden = true;
    audio.playGameSound('go', { eventKey: 'go:hidden' });
    hidden = false;
    audio.playGameSound('go', { eventKey: 'go:hidden' });
    assert.equal(playCount(), before);
  });

  await test('match-win steals lower-priority node; round-result skipped after correct', async () => {
    setup();
    audio.unlockGameAudio();
    await flush();
    audio.playGameSound('notify', { eventKey: 'n1' });
    audio.playGameSound('countdown-tick', { eventKey: 't1' });
    const before = playCount();
    audio.playGameSound('match-win', { eventKey: 'w1' });
    assert.equal(playCount() - before, 1);
    audio.resetGameAudioForTests();
    FakeAudio.instances = [];
    audio.unlockGameAudio();
    await flush();
    audio.playGameSound('correct', { eventKey: 'c1' });
    const afterCorrect = playCount();
    audio.playGameSound('round-result', { eventKey: 'r1' });
    assert.equal(playCount(), afterCorrect);
  });

  await test('game screens observe via hooks; no spam sites', () => {
    const wiring: Array<[string, string]> = [
      ['plugins/draw-guess/game-screen.tsx', 'useDrawGuessSfx'],
      ['plugins/fast-answer/game-screen.tsx', 'useFastAnswerSfx'],
      ['plugins/judge/game-screen.tsx', 'useJudgeSfx'],
      ['plugins/who-wrote-it/game-screen.tsx', 'useWhoWroteItSfx'],
      ['plugins/imposter-draw/game-screen.tsx', 'useImposterDrawSfx'],
      ['plugins/bara-al-salafa/game-screen.tsx', 'useBaraAlSalafaSfx'],
      ['plugins/guessing-challenge/game-screen.tsx', 'useGuessingChallengeSfx'],
      ['plugins/timing-challenge/game-screen.tsx', 'useTimingChallengeSfx'],
    ];
    for (const [file, hook] of wiring) {
      assert.match(read(file), new RegExp(hook));
    }
    assert.match(read('components/game-plugins/game-plugin-layer.tsx'), /useSharedCountdownSfx/);
    assert.match(read('plugins/draw-guess/use-sfx.ts'), /role === 'drawer'/);
    assert.match(read('plugins/judge/use-sfx.ts'), /view\.isJudge/);
    assert.match(read('plugins/guessing-challenge/use-sfx.ts'), /view\.isMyTurn/);
    assert.match(read('plugins/guessing-challenge/use-sfx.ts'), /wrongCue/);
    assert.doesNotMatch(read('plugins/fast-answer/use-sfx.ts'), /'wrong'|your-turn/);
    assert.doesNotMatch(read('plugins/draw-guess/use-sfx.ts'), /'wrong'/);
    assert.doesNotMatch(read('plugins/timing-challenge/use-sfx.ts'), /time-up|countdown-tick|your-turn/);
    assert.doesNotMatch(read('plugins/timing-challenge/use-timing-start-sound.ts'), /countdown-tick/);
    assert.match(read('plugins/timing-challenge/use-timing-start-sound.ts'), /playTimingCue\('timing-window'/);
    assert.match(read('plugins/timing-challenge/use-timing-start-sound.ts'), /playGameSound\(id/);
    assert.match(read('plugins/timing-challenge/use-timing-start-sound.ts'), /if \(!prev\)/);
    assert.match(read('plugins/timing-challenge/use-timing-start-sound.ts'), /useLayoutEffect/);
    assert.match(read('plugins/timing-challenge/timing-window-sfx.ts'), /timeup:timing:/);
    assert.match(read('plugins/timing-challenge/stop-timer-screen.tsx'), /playGameSound\('timing-window'/);
    assert.match(
      read('plugins/timing-challenge/stop-timer-screen.tsx'),
      /timingStartEventKey\(roundId, 'stop-timer'\)/,
    );
    assert.match(read('plugins/imposter-draw/use-sfx.ts'), /imposter-reveal/);
    assert.match(read('plugins/imposter-draw/use-sfx.ts'), /reveal:imposter-draw:/);
    assert.match(read('plugins/bara-al-salafa/use-sfx.ts'), /imposter-reveal/);
    assert.match(read('plugins/bara-al-salafa/use-sfx.ts'), /reveal:bara:/);
    assert.match(read('plugins/fast-answer/use-sfx.ts'), /decidePublicCorrect/);
    assert.match(read('plugins/draw-guess/use-sfx.ts'), /decidePublicCorrect/);
    assert.match(read('plugins/guessing-challenge/use-sfx.ts'), /decidePublicCorrect/);
    assert.doesNotMatch(read('plugins/judge/use-sfx.ts'), /decidePublicCorrect|'correct'/);
    assert.doesNotMatch(read('plugins/who-wrote-it/use-sfx.ts'), /'correct'/);
    assert.doesNotMatch(read('plugins/bara-al-salafa/use-sfx.ts'), /'correct'/);
    assert.doesNotMatch(read('plugins/timing-challenge/use-sfx.ts'), /'correct'|imposter-reveal/);
    assert.match(read('lib/game/use-shared-countdown-sfx.ts'), /decided\.play === 3/);
    assert.doesNotMatch(read('plugins/imposter-draw/use-sfx.ts'), /RESULT_PHASES/);
    assert.doesNotMatch(read('plugins/guessing-challenge/playing-screen.tsx'), /playGameSound/);
    assert.doesNotMatch(read('plugins/bara-al-salafa/countdown-screen.tsx'), /playGameSound/);
    const panel = read('plugins/guessing-challenge/special-cards-panel.tsx');
    assert.match(panel, /playSoftCardRequestPing\(/);
    assert.match(panel, /lastPingKey/);
    assert.match(panel, /!cardConfirmStatus\.selfConfirmed/);
    assert.doesNotMatch(read('lib/game/sounds.ts'), /setGameAudioVolume/);
    assert.doesNotMatch(read('components/game/game-audio-control.tsx'), /setGameAudioVolume|مستوى الصوت/);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
