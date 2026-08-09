import assert from 'node:assert/strict';
import type { BaraAlSalafaPlayerView } from '@wanasatna/shared';
import {
  BARA_AL_SALAFA_ADVANCE_DIRECTED_QUESTION_EVENT,
  BARA_AL_SALAFA_CHOOSE_FREE_QUESTION_PLAYER_EVENT,
  BARA_AL_SALAFA_CONTINUE_ROUND_RESULTS_EVENT,
  BARA_AL_SALAFA_GAME_ID,
  BARA_AL_SALAFA_SKIP_FREE_QUESTION_TURN_EVENT,
  BARA_AL_SALAFA_SUBMIT_IMPOSTOR_GUESS_EVENT,
  BARA_AL_SALAFA_SUBMIT_ROLE_UNDERSTOOD_EVENT,
  BARA_AL_SALAFA_SUBMIT_VOTE_EVENT,
} from '@wanasatna/shared';
import {
  IMPOSTOR_TEXT,
  PLAYER_NAMES,
  ack,
  connectClient,
  sleep,
  syncView,
  trackClientEvents,
  waitFor,
  type TestClient,
} from './socket-utils.js';

type MatchFlowResult = {
  playerCount: number;
  roomCode: string;
  finalTotals: Record<string, number>;
};

function log(step: string, detail: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ suite: 'multiplayer', step, playerCount: detail.playerCount, ...detail }));
}

function assertDirectedPairs(
  pairsByTurn: Map<number, { asker: string; target: string }>,
  playerCount: number,
  playerIds: string[],
): void {
  assert.equal(pairsByTurn.size, playerCount, 'observed all directed turns');
  const askers = new Set([...pairsByTurn.values()].map((p) => p.asker));
  const targets = new Set([...pairsByTurn.values()].map((p) => p.target));
  assert.equal(askers.size, playerCount, 'each player asks exactly once');
  assert.equal(targets.size, playerCount, 'each player targeted exactly once');
  for (const pair of pairsByTurn.values()) {
    assert.notEqual(pair.asker, pair.target, 'no self-pair');
    assert.ok(playerIds.includes(pair.asker), 'asker is participant');
    assert.ok(playerIds.includes(pair.target), 'target is participant');
  }
}

function assertRolePrivacy(views: Record<string, BaraAlSalafaPlayerView>, clients: TestClient[]): void {
  const impostors = clients.filter((c) => views[c.id].role === 'impostor');
  assert.equal(impostors.length, 1, 'exactly one impostor');
  const impostor = impostors[0]!;
  const normals = clients.filter((c) => c !== impostor);
  const word = views[normals[0]!.id].displayText;
  assert.ok(word && word !== IMPOSTOR_TEXT, 'normal players see a word');
  for (const normal of normals) {
    assert.equal(views[normal.id].displayText, word, 'all normals see same word');
  }
  assert.equal(views[impostor.id].displayText, IMPOSTOR_TEXT, 'impostor sees impostor text');
  for (const client of clients) {
    assert.equal(views[client.id].revealedImpostorPlayerId, null, 'impostor identity hidden before reveal');
  }
  return;
}

export async function runFullMatchFlow(playerCount: number): Promise<MatchFlowResult> {
  assert.ok(playerCount >= 3 && playerCount <= 8, 'player count must be 3–8');

  const names = PLAYER_NAMES.slice(0, playerCount);
  const clients: TestClient[] = [];

  const hostSocket = await connectClient();
  const host: TestClient = {
    name: names[0]!,
    socket: hostSocket,
    id: '',
    roomId: '',
    roomCode: '',
    reconnectToken: '',
    shellEvents: [],
    roster: [],
    rosterPlayers: [],
    navigations: [],
    recoveryEvents: [],
  };
  trackClientEvents(host);
  clients.push(host);

  const createRes = await ack<{ success: boolean; data: { room: { code: string; id: string }; player: { id: string }; reconnectToken?: string } }>(
    host.socket,
    'create-room',
    { playerName: host.name },
  );
  assert.ok(createRes.success, 'create-room succeeds');
  host.id = createRes.data.player.id;
  host.roomId = createRes.data.room.id;
  host.roomCode = createRes.data.room.code;
  host.reconnectToken = createRes.data.reconnectToken ?? '';
  assert.ok(host.reconnectToken, 'create-room returns reconnect token');
  const roomCode = createRes.data.room.code;

  for (const name of names.slice(1)) {
    const socket = await connectClient();
    const client: TestClient = {
      name,
      socket,
      id: '',
      roomId: '',
      roomCode,
      reconnectToken: '',
      shellEvents: [],
      roster: [],
      rosterPlayers: [],
      navigations: [],
      recoveryEvents: [],
    };
    trackClientEvents(client);
    const joinRes = await ack<{ success: boolean; data: { player: { id: string }; room: { id: string }; reconnectToken?: string } }>(
      client.socket,
      'join-room',
      { roomCode, playerName: name },
    );
    assert.ok(joinRes.success, `${name} joins`);
    client.id = joinRes.data.player.id;
    client.roomId = joinRes.data.room.id;
    client.reconnectToken = joinRes.data.reconnectToken ?? '';
    assert.ok(client.reconnectToken, `${name} receives reconnect token`);
    clients.push(client);
  }

  await waitFor(
    async () =>
      clients.every((c) => c.roster.length === playerCount) &&
      clients.every((c) => JSON.stringify(c.roster) === JSON.stringify(host.roster))
        ? true
        : null,
    10000,
    'roster sync',
    300,
  );
  log('roster-synced', { playerCount, roster: host.roster });

  const startRes = await ack<{ success: boolean; data: { state: { phase: string; shellId: string } } }>(
    host.socket,
    'game-shell-start-from-lobby',
    { gameId: BARA_AL_SALAFA_GAME_ID },
  );
  assert.ok(startRes.success, 'start-from-lobby succeeds');
  assert.equal(startRes.data.state.phase, 'WAITING');

  await waitFor(
    async () =>
      clients.every(
        (c) =>
          c.shellEvents.some((e) => e.phase === 'COUNTDOWN') &&
          c.shellEvents.some((e) => e.phase === 'PLAYING'),
      )
        ? true
        : null,
    15000,
    'shell COUNTDOWN and PLAYING',
    200,
  );
  log('shell-phases-verified', { playerCount });

  const pluginView = await syncView(host.socket);
  assert.ok(pluginView.gamePhase, 'plugin initialized');
  log('plugin-initialized', { playerCount, phase: pluginView.gamePhase });

  const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));
  const expectedScores = Object.fromEntries(clients.map((c) => [c.id, 0]));
  const totalRounds = pluginView.totalRounds;

  for (let round = 1; round <= totalRounds; round += 1) {
    await waitFor(async () => {
      const v = await syncView(host.socket);
      return v.gamePhase === 'description' && v.currentRound === round ? v : null;
    }, 20000, `round ${round} description`);

    const views: Record<string, BaraAlSalafaPlayerView> = {};
    for (const c of clients) {
      views[c.id] = await syncView(c.socket);
    }
    assertRolePrivacy(views, clients);

    const impostor = clients.find((c) => views[c.id].role === 'impostor')!;
    const normals = clients.filter((c) => c !== impostor);
    const word = views[normals[0]!.id].displayText;

    if (round === 1) {
      const duplicateAck = await ack<{ success: boolean; error?: { code: string } }>(
        host.socket,
        BARA_AL_SALAFA_SUBMIT_ROLE_UNDERSTOOD_EVENT,
      );
      assert.ok(duplicateAck.success);
      const duplicateAgain = await ack<{ success: boolean; error?: { code: string } }>(
        host.socket,
        BARA_AL_SALAFA_SUBMIT_ROLE_UNDERSTOOD_EVENT,
      );
      assert.equal(duplicateAgain.error?.code, 'ALREADY_SUBMITTED');
    }

    for (const client of clients) {
      if (round === 1 && client.id === host.id) {
        continue;
      }
      const ackRes = await ack<{ success: boolean }>(client.socket, BARA_AL_SALAFA_SUBMIT_ROLE_UNDERSTOOD_EVENT);
      assert.ok(ackRes.success, `${client.name} acknowledges role`);
    }

    await waitFor(async () => {
      const v = await syncView(host.socket);
      return v.gamePhase === 'directed-questions' ? v : null;
    }, 10000, `round ${round} directed questions start`, 200);

    if (round === 1 && playerCount >= 3) {
      const reconnectClient = clients[clients.length - 1]!;
      const preRole = (await syncView(reconnectClient.socket)).role;
      const pairsBefore = (await syncView(reconnectClient.socket)).directedQuestionAskerPlayerId;
      reconnectClient.socket.disconnect();
      await sleep(300);
      reconnectClient.socket = await connectClient();
      reconnectClient.shellEvents.length = 0;
      trackClientEvents(reconnectClient);
      const reconRes = await ack<{ success: boolean; data: { players: unknown[] } }>(
        reconnectClient.socket,
        'reconnect',
        {
          playerId: reconnectClient.id,
          roomId: reconnectClient.roomId,
          roomCode: reconnectClient.roomCode,
          reconnectToken: reconnectClient.reconnectToken,
        },
      );
      assert.ok(reconRes.success, 'reconnect succeeds');
      assert.equal(reconRes.data.players.length, playerCount, 'reconnect roster complete');
      const reconView = await syncView(reconnectClient.socket);
      assert.equal(reconView.role, preRole, 'same role after reconnect');
      assert.equal(reconView.currentRound, round, 'same round after reconnect');
      if (reconView.gamePhase === 'directed-questions' && pairsBefore) {
        assert.equal(reconView.directedQuestionAskerPlayerId, pairsBefore, 'directed pair stable through reconnect');
      }
      clientById[reconnectClient.id] = reconnectClient;
    }

    const pairsByTurn = new Map<number, { asker: string; target: string }>();
    for (let turn = 0; turn < playerCount; turn += 1) {
      const v = await syncView(host.socket);
      assert.equal(v.gamePhase, 'directed-questions');
      pairsByTurn.set(v.directedQuestionCurrentTurn, {
        asker: v.directedQuestionAskerPlayerId!,
        target: v.directedQuestionTargetPlayerId!,
      });

      if (round === 1 && turn === 0) {
        const nonAsker = clients.find((c) => c.id !== v.directedQuestionAskerPlayerId)!;
        const wrongAdvance = await ack<{ success: boolean; error?: { code: string } }>(
          nonAsker.socket,
          BARA_AL_SALAFA_ADVANCE_DIRECTED_QUESTION_EVENT,
        );
        assert.equal(wrongAdvance.error?.code, 'NOT_ACTIVE_ASKER');
      }

      const askerClient = clientById[v.directedQuestionAskerPlayerId!]!;
      const advanceRes = await ack<{ success: boolean }>(
        askerClient.socket,
        BARA_AL_SALAFA_ADVANCE_DIRECTED_QUESTION_EVENT,
      );
      assert.ok(advanceRes.success, `directed turn ${turn + 1} advance`);
    }

    assertDirectedPairs(
      pairsByTurn,
      playerCount,
      clients.map((c) => c.id),
    );

    let negativeChecksDone = round !== 1;
    for (let safety = 0; safety < playerCount * 3; safety += 1) {
      const v = await syncView(host.socket);
      if (v.gamePhase === 'voting') {
        break;
      }
      assert.equal(v.gamePhase, 'free-questions');

      const activeClient = clientById[v.activeFreeQuestionPlayerId!];
      assert.ok(activeClient, 'active player known');
      const activeView = await syncView(activeClient.socket);
      if (!activeView.isFreeQuestionActivePlayer) {
        continue;
      }

      if (!negativeChecksDone) {
        const nonActive = clients.find((c) => c !== activeClient)!;
        const wrongTurn = await ack<{ success: boolean; error?: { code: string } }>(
          nonActive.socket,
          BARA_AL_SALAFA_CHOOSE_FREE_QUESTION_PLAYER_EVENT,
          { targetPlayerId: activeClient.id },
        );
        assert.equal(wrongTurn.error?.code, 'NOT_ACTIVE_PLAYER');
        const selfTarget = await ack<{ success: boolean; error?: { code: string } }>(
          activeClient.socket,
          BARA_AL_SALAFA_CHOOSE_FREE_QUESTION_PLAYER_EVENT,
          { targetPlayerId: activeClient.id },
        );
        assert.equal(selfTarget.error?.code, 'INVALID_TARGET');
        negativeChecksDone = true;
      }

      const skipRes = await ack<{ success: boolean }>(
        activeClient.socket,
        BARA_AL_SALAFA_SKIP_FREE_QUESTION_TURN_EVENT,
      );
      assert.ok(skipRes.success, 'skip free question turn');
    }

    const votingView = await syncView(host.socket);
    assert.equal(votingView.gamePhase, 'voting');

    if (round === 1) {
      const selfVote = await ack<{ success: boolean; error?: { code: string } }>(
        host.socket,
        BARA_AL_SALAFA_SUBMIT_VOTE_EVENT,
        { targetPlayerId: host.id },
      );
      assert.equal(selfVote.error?.code, 'INVALID_TARGET');

      const firstVote = await ack<{ success: boolean }>(normals[0]!.socket, BARA_AL_SALAFA_SUBMIT_VOTE_EVENT, {
        targetPlayerId: impostor.id,
      });
      assert.ok(firstVote.success);
      expectedScores[normals[0]!.id]! += 100;

      const doubleVote = await ack<{ success: boolean; error?: { code: string } }>(
        normals[0]!.socket,
        BARA_AL_SALAFA_SUBMIT_VOTE_EVENT,
        { targetPlayerId: normals[1]!.id },
      );
      assert.equal(doubleVote.error?.code, 'ALREADY_SUBMITTED');

      const observerBeforeOwnVote = await syncView(normals[1]!.socket);
      assert.equal(observerBeforeOwnVote.confirmedVoteTargetPlayerId, null, 'other votes private before own vote');
      assert.equal(observerBeforeOwnVote.submittedVotesCount, 1, 'aggregate count only');
    }

    for (let index = round === 1 ? 1 : 0; index < normals.length; index += 1) {
      const normal = normals[index]!;
      const voteRes = await ack<{ success: boolean }>(normal.socket, BARA_AL_SALAFA_SUBMIT_VOTE_EVENT, {
        targetPlayerId: impostor.id,
      });
      assert.ok(voteRes.success, `${normal.name} votes impostor`);
      expectedScores[normal.id]! += 100;
    }

    await ack(impostor.socket, BARA_AL_SALAFA_SUBMIT_VOTE_EVENT, {
      targetPlayerId: normals[0]!.id,
    });

    const revealView = await waitFor(async () => {
      const v = await syncView(host.socket);
      return v.gamePhase === 'reveal-impostor' ? v : null;
    }, 10000, 'reveal-impostor', 300);
    assert.equal(revealView.revealedImpostorPlayerId, impostor.id);
    assert.equal(revealView.revealedWord, null);

    const guessViewImpostor = await waitFor(async () => {
      const v = await syncView(impostor.socket);
      return v.gamePhase === 'impostor-guess' ? v : null;
    }, 10000, 'impostor-guess', 300);
    assert.ok(guessViewImpostor.impostorGuessOptions.length >= 2);
    assert.ok(guessViewImpostor.impostorGuessOptions.includes(word));
    const normalGuessView = await syncView(normals[0]!.socket);
    assert.deepEqual(normalGuessView.impostorGuessOptions, []);

    if (round === 1) {
      const notImpostor = await ack<{ success: boolean; error?: { code: string } }>(
        normals[0]!.socket,
        BARA_AL_SALAFA_SUBMIT_IMPOSTOR_GUESS_EVENT,
        { selectedWord: word },
      );
      assert.equal(notImpostor.error?.code, 'NOT_IMPOSTOR');
    }

    const guessCorrectly = round !== 2;
    const guessWord = guessCorrectly
      ? word
      : guessViewImpostor.impostorGuessOptions.find((o) => o !== word)!;
    const guessRes = await ack<{ success: boolean }>(impostor.socket, BARA_AL_SALAFA_SUBMIT_IMPOSTOR_GUESS_EVENT, {
      selectedWord: guessWord,
    });
    assert.ok(guessRes.success);
    if (guessCorrectly) {
      expectedScores[impostor.id]! += 100;
    }

    const postGuessView = await syncView(impostor.socket);
    if (postGuessView.gamePhase === 'impostor-guess' && postGuessView.hasSubmittedImpostorGuess) {
      const duplicateGuess = await ack<{ success: boolean; error?: { code: string } }>(
        impostor.socket,
        BARA_AL_SALAFA_SUBMIT_IMPOSTOR_GUESS_EVENT,
        { selectedWord: guessWord },
      );
      assert.equal(duplicateGuess.error?.code, 'ALREADY_SUBMITTED');
    }

    const resultsView = await waitFor(async () => {
      const v = await syncView(host.socket);
      return v.gamePhase === 'round-results' ? v : null;
    }, 10000, 'round-results', 300);

    assert.equal(resultsView.revealedWord, word);
    const totals = Object.fromEntries(
      resultsView.roundResults.map((entry) => [entry.playerId, entry.totalPoints]),
    );
    assert.deepEqual(totals, expectedScores, `round ${round} scores applied once`);
    log('round-complete', { playerCount, round, totals });

    if (round < totalRounds) {
      const nonHostContinue = await ack<{ success: boolean; error?: { code: string } }>(
        normals[0]!.socket,
        BARA_AL_SALAFA_CONTINUE_ROUND_RESULTS_EVENT,
      );
      assert.equal(nonHostContinue.error?.code, 'NOT_HOST');

      const hostContinue = await ack<{ success: boolean }>(host.socket, BARA_AL_SALAFA_CONTINUE_ROUND_RESULTS_EVENT);
      assert.ok(hostContinue.success, 'host continues to next round');
    }
  }

  const resultsView = await waitFor(async () => {
    const v = await syncView(host.socket);
    return v.gamePhase === 'round-results' ? v : null;
  }, 10000, 'final round-results', 300);

  const hostFinalContinue = await ack<{ success: boolean }>(
    host.socket,
    BARA_AL_SALAFA_CONTINUE_ROUND_RESULTS_EVENT,
  );
  assert.ok(hostFinalContinue.success, 'host continues to match results');

  const finalView = await waitFor(async () => {
    const v = await syncView(host.socket);
    return v.gamePhase === 'match-completed' ? v : null;
  }, 15000, 'match-completed', 300);

  const finalTotals = Object.fromEntries(
    finalView.resultsLeaderboard.map((entry) => [entry.playerId, entry.totalPoints]),
  );
  assert.deepEqual(finalTotals, expectedScores);

  await waitFor(
    async () => (clients.every((c) => c.shellEvents.some((e) => e.phase === 'FINISHED')) ? true : null),
    15000,
    'shell FINISHED',
    300,
  );

  const returnRes = await ack<{ success: boolean }>(host.socket, 'game-shell-return-to-lobby');
  assert.ok(returnRes.success);

  await waitFor(
    async () =>
      clients.every((c) => c.navigations.includes('/lobby')) ? true : null,
    5000,
    'return to lobby navigation',
    200,
  );

  for (const c of clients) {
    c.socket.disconnect();
  }

  log('match-complete', { playerCount, roomCode, finalTotals });
  return { playerCount, roomCode, finalTotals };
}

export async function assertStartBlocked(playerCount: number): Promise<void> {
  const names = PLAYER_NAMES.slice(0, playerCount);
  const sockets = [];
  const ids: string[] = [];

  const hostSocket = await connectClient();
  const createRes = await ack<{ success: boolean; data: { room: { code: string }; player: { id: string } } }>(
    hostSocket,
    'create-room',
    { playerName: names[0] },
  );
  assert.ok(createRes.success);
  ids.push(createRes.data.player.id);
  sockets.push(hostSocket);
  const roomCode = createRes.data.room.code;

  for (const name of names.slice(1)) {
    const s = await connectClient();
    const joinRes = await ack<{ success: boolean; data: { player: { id: string } } }>(s, 'join-room', {
      roomCode,
      playerName: name,
    });
    assert.ok(joinRes.success);
    ids.push(joinRes.data.player.id);
    sockets.push(s);
  }

  const startRes = await ack<{ success: boolean; error?: { code: string; message: string } }>(
    hostSocket,
    'game-shell-start-from-lobby',
    { gameId: BARA_AL_SALAFA_GAME_ID },
  );
  assert.equal(startRes.success, false, `start should fail with ${playerCount} players`);
  assert.equal(startRes.error?.code, 'VALIDATION_ERROR');

  for (const s of sockets) {
    s.disconnect();
  }
}
