/**
 * Full end-to-end multi-client integration test for the Wanasatna flow:
 * create/join/roster sync -> start -> WAITING/COUNTDOWN/PLAYING ->
 * full Bara AlSalafa match (3 rounds) -> FINISHED -> return to lobby.
 *
 * Requires the server running on localhost:4000 with a reachable database.
 * Run from apps/web: node tests/integration-full-match.mjs
 * Expected runtime: ~9 minutes (server-owned phase timers run in real time).
 */
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import {
  BARA_AL_SALAFA_ADVANCE_FREE_QUESTION_EVENT,
  BARA_AL_SALAFA_CHOOSE_FREE_QUESTION_PLAYER_EVENT,
  BARA_AL_SALAFA_GAME_ID,
  BARA_AL_SALAFA_SKIP_FREE_QUESTION_TURN_EVENT,
  BARA_AL_SALAFA_SUBMIT_IMPOSTOR_GUESS_EVENT,
  BARA_AL_SALAFA_SUBMIT_VOTE_EVENT,
  BARA_AL_SALAFA_SYNC_EVENT,
} from '@wanasatna/shared';

const SERVER = 'http://localhost:4000';
const IMPOSTOR_TEXT = 'أنت برا السالفة';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(step, detail = {}) {
  console.log(JSON.stringify({ step, ...detail }));
}

function ack(socket, event, payload = {}) {
  return new Promise((resolve, reject) => {
    socket.timeout(15000).emit(event, payload, (err, res) => (err ? reject(err) : resolve(res)));
  });
}

async function connect() {
  const socket = ioClient(SERVER, { autoConnect: true });
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}

async function syncView(socket) {
  const res = await ack(socket, BARA_AL_SALAFA_SYNC_EVENT, {});
  if (!res.success) throw new Error(`plugin sync failed: ${res.error?.code} ${res.error?.message}`);
  return res.data.view;
}

async function waitFor(fn, timeoutMs, label, intervalMs = 1500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await fn();
    if (result) return result;
    await sleep(intervalMs);
  }
  throw new Error(`Timeout (${timeoutMs}ms) waiting for: ${label}`);
}

function trackShellStates(socket, sink) {
  socket.on('game-shell-state', (payload) => {
    sink.push({ phase: payload.state.phase, countdown: payload.state.countdownRemainingSeconds });
  });
}

function trackSnapshots(socket, sink) {
  socket.on('room-players-snapshot', (payload) => {
    sink.length = 0;
    sink.push(...payload.players.map((p) => p.name).sort());
  });
}

async function main() {
  const players = [
    { name: 'محمد', socket: null, id: null, shellEvents: [], roster: [] },
    { name: 'خالد', socket: null, id: null, shellEvents: [], roster: [] },
    { name: 'علي', socket: null, id: null, shellEvents: [], roster: [] },
  ];
  const [host, p2, p3] = players;

  // --- 1. Create room + join 3 players, verify roster sync ---
  host.socket = await connect();
  trackShellStates(host.socket, host.shellEvents);
  trackSnapshots(host.socket, host.roster);

  const createRes = await ack(host.socket, 'create-room', { playerName: host.name });
  assert.ok(createRes.success, 'create-room succeeds');
  host.id = createRes.data.player.id;
  const roomCode = createRes.data.room.code;
  assert.equal(createRes.data.players.length, 1, 'create ack contains full roster');
  log('room-created', { roomCode });

  for (const joiner of [p2, p3]) {
    joiner.socket = await connect();
    trackShellStates(joiner.socket, joiner.shellEvents);
    trackSnapshots(joiner.socket, joiner.roster);
    const joinRes = await ack(joiner.socket, 'join-room', { roomCode, playerName: joiner.name });
    assert.ok(joinRes.success, `${joiner.name} joins`);
    joiner.id = joinRes.data.player.id;
    assert.ok(joinRes.data.players.length >= 2, 'join ack contains full roster');
  }

  await waitFor(
    async () =>
      players.every((p) => p.roster.length === 3) &&
      players.every((p) => JSON.stringify(p.roster) === JSON.stringify(host.roster))
        ? true
        : null,
    10000,
    'all clients see identical 3-player roster',
    500,
  );
  log('roster-synced', { roster: host.roster });

  const clientById = Object.fromEntries(players.map((p) => [p.id, p]));

  // --- 2. Start game: WAITING -> COUNTDOWN -> PLAYING on every client ---
  const startRes = await ack(host.socket, 'game-shell-start-from-lobby', {
    gameId: BARA_AL_SALAFA_GAME_ID,
  });
  assert.ok(startRes.success, 'start-from-lobby succeeds');
  assert.equal(startRes.data.state.phase, 'WAITING');
  log('game-started', { shellId: startRes.data.state.shellId });

  await waitFor(
    async () =>
      players.every(
        (p) =>
          p.shellEvents.some((e) => e.phase === 'COUNTDOWN') &&
          p.shellEvents.some((e) => e.phase === 'PLAYING'),
      )
        ? true
        : null,
    15000,
    'every client receives COUNTDOWN and PLAYING',
    500,
  );

  for (const p of players) {
    const countdownValues = p.shellEvents
      .filter((e) => e.phase === 'COUNTDOWN')
      .map((e) => e.countdown);
    assert.ok(
      countdownValues.some((v) => v !== null && v >= 1 && v <= 3),
      `${p.name} saw a valid countdown value (got ${countdownValues.join(',')})`,
    );
  }
  log('countdown-and-playing-verified');

  // --- 3. Full match: 3 rounds ---
  const expectedScores = Object.fromEntries(players.map((p) => [p.id, 0]));

  for (let round = 1; round <= 3; round += 1) {
    // Role reveal (description phase)
    await waitFor(async () => {
      const v = await syncView(host.socket);
      return v.gamePhase === 'description' && v.currentRound === round ? v : null;
    }, 30000, `round ${round} description phase`);

    const views = {};
    for (const p of players) views[p.id] = await syncView(p.socket);

    const impostors = players.filter((p) => views[p.id].role === 'impostor');
    assert.equal(impostors.length, 1, 'exactly one impostor');
    const impostor = impostors[0];
    const normals = players.filter((p) => p !== impostor);
    const word = views[normals[0].id].displayText;
    assert.ok(word && word !== IMPOSTOR_TEXT, 'normal players see a word');
    assert.equal(views[normals[1].id].displayText, word, 'both normals see the same word');
    assert.equal(views[impostor.id].displayText, IMPOSTOR_TEXT, 'impostor sees impostor text');
    for (const p of players) {
      assert.equal(views[p.id].revealedImpostorPlayerId, null, 'impostor identity hidden');
    }
    log('role-privacy-verified', { round, impostor: impostor.name });

    // Reconnect test during round 1 description
    if (round === 1) {
      const preRole = views[p3.id].role;
      p3.socket.disconnect();
      await sleep(1500);
      p3.socket = await connect();
      p3.shellEvents.length = 0;
      trackShellStates(p3.socket, p3.shellEvents);
      trackSnapshots(p3.socket, p3.roster);
      const reconRes = await ack(p3.socket, 'reconnect', { playerId: p3.id });
      assert.ok(reconRes.success, 'reconnect succeeds');
      assert.equal(reconRes.data.players.length, 3, 'reconnect ack contains full roster');
      await waitFor(
        async () => (p3.shellEvents.some((e) => e.phase === 'PLAYING') ? true : null),
        5000,
        'reconnecting client receives pushed shell state',
        250,
      );
      const reconView = await syncView(p3.socket);
      assert.equal(reconView.role, preRole, 'same role after reconnect');
      assert.equal(reconView.currentRound, round, 'same round after reconnect');
      log('reconnect-verified', { player: p3.name });
    }

    // Directed questions: record pairs across turns
    const pairsByTurn = new Map();
    await waitFor(async () => {
      const v = await syncView(host.socket);
      if (v.gamePhase === 'description') return null;
      if (v.gamePhase === 'directed-questions') {
        if (v.directedQuestionCurrentTurn > 0) {
          pairsByTurn.set(v.directedQuestionCurrentTurn, {
            asker: v.directedQuestionAskerPlayerId,
            target: v.directedQuestionTargetPlayerId,
          });
        }
        return null;
      }
      return v;
    }, 240000, `round ${round} directed questions completion`, 2000);

    assert.equal(pairsByTurn.size, 3, 'observed all 3 directed turns');
    const askers = new Set([...pairsByTurn.values()].map((p) => p.asker));
    const targets = new Set([...pairsByTurn.values()].map((p) => p.target));
    assert.equal(askers.size, 3, 'each player asked exactly once');
    assert.equal(targets.size, 3, 'each player targeted exactly once');
    for (const pair of pairsByTurn.values()) {
      assert.notEqual(pair.asker, pair.target, 'no self-pair');
    }
    log('directed-pairs-verified', { round, pairs: [...pairsByTurn.values()] });

    // Free questions: drive turns until voting
    let negativeChecksDone = round !== 1;
    for (let safety = 0; safety < 15; safety += 1) {
      const v = await syncView(host.socket);
      if (v.gamePhase === 'voting') break;
      assert.equal(v.gamePhase, 'free-questions', `unexpected phase ${v.gamePhase}`);

      const activeClient = clientById[v.activeFreeQuestionPlayerId];
      assert.ok(activeClient, 'active player is a known client');
      const activeView = await syncView(activeClient.socket);
      if (!activeView.isFreeQuestionActivePlayer) {
        await sleep(500);
        continue;
      }

      if (!negativeChecksDone) {
        const nonActive = players.find((p) => p !== activeClient);
        const wrongTurn = await ack(
          nonActive.socket,
          BARA_AL_SALAFA_CHOOSE_FREE_QUESTION_PLAYER_EVENT,
          { targetPlayerId: activeClient.id },
        );
        assert.equal(wrongTurn.error?.code, 'NOT_ACTIVE_PLAYER', 'non-active player rejected');
        const selfTarget = await ack(
          activeClient.socket,
          BARA_AL_SALAFA_CHOOSE_FREE_QUESTION_PLAYER_EVENT,
          { targetPlayerId: activeClient.id },
        );
        assert.equal(selfTarget.error?.code, 'INVALID_TARGET', 'self-target rejected');
        negativeChecksDone = true;
      }

      if (round === 2) {
        const skipRes = await ack(activeClient.socket, BARA_AL_SALAFA_SKIP_FREE_QUESTION_TURN_EVENT);
        assert.ok(skipRes.success, 'skip turn succeeds');
      } else {
        const target = activeView.selectablePlayers[0];
        assert.ok(target, 'active player has selectable targets');
        const chooseRes = await ack(
          activeClient.socket,
          BARA_AL_SALAFA_CHOOSE_FREE_QUESTION_PLAYER_EVENT,
          { targetPlayerId: target.id },
        );
        assert.ok(chooseRes.success, 'choose target succeeds');

        const afterChoose = await syncView(activeClient.socket);
        assert.equal(afterChoose.activeFreeQuestionTargetPlayerId, target.id, 'target pending after choose');
        assert.equal(afterChoose.activeFreeQuestionPlayerId, activeClient.id, 'asker unchanged after choose');

        const advanceRes = await ack(activeClient.socket, BARA_AL_SALAFA_ADVANCE_FREE_QUESTION_EVENT);
        assert.ok(advanceRes.success, 'advance free question succeeds');
      }
    }
    log('free-questions-verified', { round });

    // Voting
    const votingView = await syncView(host.socket);
    assert.equal(votingView.gamePhase, 'voting', 'voting phase reached');

    if (round === 1) {
      const selfVote = await ack(host.socket, BARA_AL_SALAFA_SUBMIT_VOTE_EVENT, {
        targetPlayerId: host.id,
      });
      assert.equal(selfVote.error?.code, 'INVALID_TARGET', 'self-vote rejected');
    }

    for (const normal of normals) {
      const voteRes = await ack(normal.socket, BARA_AL_SALAFA_SUBMIT_VOTE_EVENT, {
        targetPlayerId: impostor.id,
      });
      assert.ok(voteRes.success, `${normal.name} votes impostor`);
      expectedScores[normal.id] += 100;
    }

    if (round === 1) {
      const doubleVote = await ack(normals[0].socket, BARA_AL_SALAFA_SUBMIT_VOTE_EVENT, {
        targetPlayerId: normals[1].id,
      });
      assert.equal(doubleVote.error?.code, 'ALREADY_SUBMITTED', 'double vote rejected');

      const impostorPreVote = await syncView(impostor.socket);
      assert.equal(impostorPreVote.confirmedVoteTargetPlayerId, null, 'others votes stay private');
      assert.equal(impostorPreVote.submittedVotesCount, 2, 'only aggregate count exposed');
    }

    const impostorVote = await ack(impostor.socket, BARA_AL_SALAFA_SUBMIT_VOTE_EVENT, {
      targetPlayerId: normals[0].id,
    });
    assert.ok(impostorVote.success, 'impostor votes a normal player');
    log('voting-verified', { round });

    // Reveal impostor (identity only)
    const revealView = await waitFor(async () => {
      const v = await syncView(host.socket);
      return v.gamePhase === 'reveal-impostor' ? v : null;
    }, 10000, `round ${round} reveal-impostor`, 500);
    assert.equal(revealView.revealedImpostorPlayerId, impostor.id, 'impostor revealed');
    assert.equal(revealView.revealedWord, null, 'word still hidden at reveal');
    log('reveal-verified', { round });

    // Impostor guess
    const guessViewImpostor = await waitFor(async () => {
      const v = await syncView(impostor.socket);
      return v.gamePhase === 'impostor-guess' ? v : null;
    }, 15000, `round ${round} impostor-guess`, 500);
    assert.ok(guessViewImpostor.impostorGuessOptions.length >= 2, 'impostor receives options');
    assert.ok(guessViewImpostor.impostorGuessOptions.includes(word), 'options contain real word');
    assert.equal(
      guessViewImpostor.impostorGuessOptions.filter((o) => o === word).length,
      1,
      'exactly one correct option',
    );
    const normalGuessView = await syncView(normals[0].socket);
    assert.deepEqual(normalGuessView.impostorGuessOptions, [], 'options hidden from normals');

    if (round === 1) {
      const notImpostor = await ack(normals[0].socket, BARA_AL_SALAFA_SUBMIT_IMPOSTOR_GUESS_EVENT, {
        selectedWord: word,
      });
      assert.equal(notImpostor.error?.code, 'NOT_IMPOSTOR', 'non-impostor cannot guess');
    }

    const guessCorrectly = round !== 2;
    const guessWord = guessCorrectly
      ? word
      : guessViewImpostor.impostorGuessOptions.find((o) => o !== word);
    const guessRes = await ack(impostor.socket, BARA_AL_SALAFA_SUBMIT_IMPOSTOR_GUESS_EVENT, {
      selectedWord: guessWord,
    });
    assert.ok(guessRes.success, 'impostor guess submitted');
    if (guessCorrectly) expectedScores[impostor.id] += 100;
    log('impostor-guess-verified', { round, guessCorrectly });

    // Round results + scoring
    const resultsView = await waitFor(async () => {
      const v = await syncView(host.socket);
      return v.gamePhase === 'round-results' ? v : null;
    }, 10000, `round ${round} results`, 500);

    assert.equal(resultsView.revealedWord, word, 'word revealed in results');
    assert.equal(resultsView.revealedImpostorPlayerId, impostor.id);
    assert.equal(resultsView.impostorGuessedCorrectly, guessCorrectly);

    const totals = Object.fromEntries(
      resultsView.roundResults.map((entry) => [entry.playerId, entry.totalPoints]),
    );
    assert.deepEqual(totals, expectedScores, `round ${round} cumulative scores applied once`);
    log('scoring-verified', { round, totals });
  }

  // --- 4. Match results + FINISHED ---
  const finalView = await waitFor(async () => {
    const v = await syncView(host.socket);
    return v.gamePhase === 'match-completed' ? v : null;
  }, 20000, 'match-completed phase', 500);

  assert.equal(finalView.isFinalResults, true);
  const finalTotals = Object.fromEntries(
    finalView.resultsLeaderboard.map((entry) => [entry.playerId, entry.totalPoints]),
  );
  assert.deepEqual(finalTotals, expectedScores, 'final leaderboard totals correct');
  log('final-leaderboard-verified', { finalTotals });

  await waitFor(
    async () =>
      players.every((p) => p.shellEvents.some((e) => e.phase === 'FINISHED')) ? true : null,
    20000,
    'every client receives FINISHED shell state',
    500,
  );
  log('finished-verified');

  // --- 5. Host returns everyone to lobby ---
  const navigations = [];
  for (const p of players) {
    p.socket.on('game-shell-navigate', (payload) => {
      navigations.push({ player: p.name, path: payload.path });
    });
  }

  const returnRes = await ack(host.socket, 'game-shell-return-to-lobby');
  assert.ok(returnRes.success, 'host return-to-lobby succeeds');

  await waitFor(
    async () => (navigations.filter((n) => n.path === '/lobby').length === 3 ? true : null),
    5000,
    'all clients receive lobby navigation',
    250,
  );
  log('return-to-lobby-verified');

  for (const p of players) p.socket.disconnect();
  log('ALL-PASSED');
  process.exit(0);
}

main().catch((error) => {
  console.error('INTEGRATION TEST FAILED:', error.message);
  process.exit(1);
});
