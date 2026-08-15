'use client';

import { useEffect, useMemo, useState } from 'react';
import type { GuessingChallengePlayerView } from '@wanasatna/shared';
import { MATCH_FINAL_RESULTS_AUTO_LOBBY_SECONDS } from '@wanasatna/shared';
import { SpectatorNotice } from '@/components/room/room-system-state';
import { GameplayScene } from '@/plugins/guessing-challenge/gameplay-scene';
import { GuessingChallengePlayingScreen } from '@/plugins/guessing-challenge/playing-screen';
import { GuessingChallengeRoundResultsScreen } from '@/plugins/guessing-challenge/round-results-screen';
import { GuessingChallengeSpecialCardsPanel } from '@/plugins/guessing-challenge/special-cards-panel';
import { MatchResultsScreen } from '@/plugins/bara-al-salafa/match-results-screen';
import type { GuessingChallengeSceneProps } from '@/plugins/guessing-challenge/scene-props';

const IDENTITY = { type: 'text' as const, value: 'برجر', imageUrl: null };
const SELF_ID = { type: 'text' as const, value: 'بيتزا', imageUrl: null };

type HarnessPanel = 'scene' | 'playing' | 'results' | 'final' | 'spectator';

function readHarnessQuery() {
  if (typeof window === 'undefined') {
    return {
      mode: '1v1' as const,
      team: 'blue' as const,
      seat: 0 as const,
      look: { yaw: 0, pitch: 0 },
      approval: false,
      panel: 'scene' as HarnessPanel,
    };
  }
  const query = new URLSearchParams(window.location.search);
  const lookKey = query.get('look');
  const look =
    lookKey === 'left'
      ? { yaw: 0.85, pitch: 0 }
      : lookKey === 'right'
        ? { yaw: -0.85, pitch: 0 }
        : lookKey === 'up'
          ? { yaw: 0, pitch: 0.8 }
          : lookKey === 'down'
            ? { yaw: 0, pitch: -0.8 }
            : { yaw: 0, pitch: 0 };
  const panel = query.get('panel');
  return {
    mode: query.get('mode') === '2v2' ? ('2v2' as const) : ('1v1' as const),
    team: query.get('team') === 'red' ? ('red' as const) : ('blue' as const),
    seat: query.get('seat') === '1' ? (1 as const) : (0 as const),
    look,
    approval: query.get('approval') === '1',
    panel:
      panel === 'playing' || panel === 'results' || panel === 'final' || panel === 'spectator'
        ? panel
        : ('scene' as HarnessPanel),
  };
}

function createMockView(
  mode: '1v1' | '2v2',
  team: 'blue' | 'red',
  seat: 0 | 1,
  phase: GuessingChallengePlayerView['gamePhase'],
): GuessingChallengePlayerView {
  const isResults = phase === 'round-results' || phase === 'match-completed';
  return {
    gamePhase: phase,
    phaseLabel: phase === 'playing' ? 'دورك' : phase === 'round-results' ? 'نتائج الجولة' : 'النتائج النهائية',
    phaseRemainingSeconds: phase === 'playing' ? 45 : phase === 'round-results' ? 10 : 30,
    deadlineAtMs: null,
    roundId: 'r1',
    turnId: 't1',
    categoryId: 'food',
    categoryLabel: 'أكل',
    currentRound: phase === 'match-completed' ? 4 : 1,
    totalRounds: 4,
    matchStatus: phase === 'match-completed' ? 'completed' : 'in-progress',
    mode,
    selfTeam: team,
    selfSeat: seat,
    currentTurnPlayerId: 'self',
    currentTurnTeamId: team,
    currentTurnPlayerName: 'سارة',
    isMyTurn: true,
    turnInstruction:
      mode === '2v2'
        ? 'اسأل الفريق الثاني سؤالاً إجابته نعم أو لا، وحاول تعرف شخصيتكم.'
        : 'اسأل خصمك سؤالاً إجابته نعم أو لا، وحاول تعرف شخصيتك.',
    self: {
      playerId: 'self',
      name: 'سارة',
      identityHidden: true,
      revealedIdentity: isResults ? SELF_ID : null,
      yellowCardAvailable: true,
      redCardAvailable: true,
    },
    teammate:
      mode === '2v2'
        ? {
            playerId: 'tm',
            name: 'محمد',
            seat: seat === 0 ? 1 : 0,
            lookYaw: 0,
            lookPitch: 0,
          }
        : null,
    opponent: { playerId: 'o0', name: 'علي', visibleIdentity: IDENTITY },
    opponents:
      mode === '2v2'
        ? [
            { playerId: 'o0', name: 'خالد', seat: 0, lookYaw: 0, lookPitch: 0, visibleIdentity: IDENTITY },
            { playerId: 'o1', name: 'علي', seat: 1, lookYaw: 0, lookPitch: 0, visibleIdentity: IDENTITY },
          ]
        : [{ playerId: 'o0', name: 'علي', seat: 0, lookYaw: 0, lookPitch: 0, visibleIdentity: IDENTITY }],
    yellowQuestionsRemaining: null,
    canEndQuestion: true,
    canGuess: true,
    canUseYellow: true,
    canUseRed: true,
    cardConfirmStatus: null,
    identityChangedNotice: false,
    revealEntries: [
      { playerId: 'self', name: 'سارة', identity: SELF_ID, isWinner: true },
      { playerId: 'o0', name: 'علي', identity: IDENTITY, isWinner: false },
    ],
    winnerName: 'سارة',
    winningTeamId: 'blue',
    winningGuess: 'بيتزا',
    roundResults: [
      { playerId: 'self', name: 'سارة', roundPoints: 100, totalPoints: 100, isWinner: true },
      { playerId: 'o0', name: 'علي', roundPoints: 0, totalPoints: 0, isWinner: false },
    ],
    leaderboard: [
      { playerId: 'self', name: 'سارة', score: 100 },
      { playerId: 'o0', name: 'علي', score: 0 },
    ],
    resultsLeaderboard: [
      { playerId: 'self', name: 'سارة', totalPoints: 200, rank: 1, isFirstPlace: true },
      { playerId: 'o0', name: 'علي', totalPoints: 100, rank: 2, isFirstPlace: false },
    ],
    isHost: true,
    canContinueFromRoundResults: true,
    roundResultsContinueLabel: 'التالي الآن',
    roundResultsWaitingMessage: null,
    isMatchSpectator: false,
  };
}

/** Client harness body — only mounted from the production-gated page. */
export function GuessingChallengeSceneHarness() {
  const [mode, setMode] = useState<'1v1' | '2v2'>('1v1');
  const [selfTeam, setSelfTeam] = useState<'blue' | 'red'>('blue');
  const [selfSeat, setSelfSeat] = useState<0 | 1>(0);
  const [demoLook, setDemoLook] = useState({ yaw: 0, pitch: 0 });
  const [showApproval, setShowApproval] = useState(false);
  const [panel, setPanel] = useState<HarnessPanel>('scene');

  useEffect(() => {
    const query = readHarnessQuery();
    setMode(query.mode);
    setSelfTeam(query.team);
    setSelfSeat(query.seat);
    setDemoLook(query.look);
    setShowApproval(query.approval);
    setPanel(query.panel);
  }, []);

  const props: GuessingChallengeSceneProps = useMemo(() => {
    if (mode === '2v2') {
      return {
        mode: 'playing',
        matchMode: '2v2',
        selfTeam,
        selfSeat,
        teammate: {
          playerId: 'tm',
          name: 'محمد',
          seat: selfSeat === 0 ? 1 : 0,
          lookYaw: demoLook.yaw,
          lookPitch: demoLook.pitch,
        },
        opponents: [
          { playerId: 'o0', name: 'خالد', seat: 0, lookYaw: demoLook.yaw, lookPitch: demoLook.pitch },
          { playerId: 'o1', name: 'علي', seat: 1, lookYaw: demoLook.yaw * 0.4, lookPitch: demoLook.pitch },
        ],
        opponentName: 'خالد',
        selfName: 'سارة',
        opponentIdentity: IDENTITY,
        selfIdentity: null,
        selfHidden: true,
        isMyTurn: true,
        turnTitle: 'دورك',
        turnInstruction: 'اسأل الفريق الثاني سؤالاً إجابته نعم أو لا، وحاول تعرف شخصيتكم.',
        showSpecialCards: false,
      };
    }

    return {
      mode: 'playing',
      matchMode: '1v1',
      selfTeam: 'blue',
      opponentName: 'علي',
      selfName: 'سارة',
      opponentIdentity: IDENTITY,
      selfIdentity: null,
      selfHidden: true,
      isMyTurn: true,
      turnTitle: 'دورك',
      turnInstruction: 'اسأل خصمك سؤالاً إجابته نعم أو لا، وحاول تعرف شخصيتك.',
      showSpecialCards: false,
      opponents: [
        { playerId: 'opponent', name: 'علي', seat: 0, lookYaw: demoLook.yaw, lookPitch: demoLook.pitch },
      ],
    };
  }, [mode, selfTeam, selfSeat, demoLook]);

  if (panel === 'playing') {
    return (
      <GuessingChallengePlayingScreen
        view={createMockView(mode, selfTeam, selfSeat, 'playing')}
        roomCode="123456"
        actionError={null}
        guessFeedback={null}
        isSubmittingAction={false}
        onEndQuestion={() => undefined}
        onSubmitGuess={() => undefined}
        onUseYellow={() => undefined}
        onUseRed={() => undefined}
      />
    );
  }

  if (panel === 'results') {
    return (
      <GuessingChallengeRoundResultsScreen
        view={createMockView(mode, selfTeam, selfSeat, 'round-results')}
        currentPlayerId="self"
        roomCode="123456"
        remainingSeconds={7}
        totalDurationSeconds={10}
        onContinue={() => undefined}
      />
    );
  }

  if (panel === 'final') {
    const view = createMockView(mode, selfTeam, selfSeat, 'match-completed');
    return (
      <MatchResultsScreen
        leaderboard={view.resultsLeaderboard.map((entry) => ({
          id: entry.playerId,
          name: entry.name,
          totalPoints: entry.totalPoints,
          rank: entry.rank,
          isFirstPlace: entry.isFirstPlace,
          isCurrentPlayer: entry.playerId === 'self',
        }))}
        currentPlayerId="self"
        totalRounds={4}
        playerCount={view.resultsLeaderboard.length}
        roomCode="123456"
        gameName="تحدي التخمين"
        autoReturnSeconds={24}
        autoReturnTotalSeconds={MATCH_FINAL_RESULTS_AUTO_LOBBY_SECONDS}
        onReturnToLobby={() => undefined}
      />
    );
  }

  if (panel === 'spectator') {
    return (
      <main className="mx-auto flex min-h-screen min-w-0 max-w-4xl flex-col gap-3 p-4" dir="rtl">
        <SpectatorNotice />
        <GameplayScene
          mode="playing"
          matchMode={mode}
          opponentName="علي"
          selfName="مشاهد"
          opponentIdentity={null}
          selfIdentity={null}
          selfHidden
          isMyTurn={false}
          turnTitle="دور علي"
          turnInstruction="راقب الدور الحالي. لا يمكنك التخمين أو استخدام البطاقات."
          showSpecialCards={false}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen min-w-0 max-w-4xl flex-col gap-4 overflow-x-hidden p-4" dir="rtl">
      <h1 className="text-xl font-bold">GC Real3D harness</h1>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="harness-1v1"
          className="rounded-lg border px-3 py-2"
          onClick={() => {
            setMode('1v1');
            window.history.replaceState(null, '', '?mode=1v1');
          }}
        >
          1v1
        </button>
        <button
          type="button"
          data-testid="harness-2v2"
          className="rounded-lg border px-3 py-2"
          onClick={() => {
            setMode('2v2');
            window.history.replaceState(null, '', '?mode=2v2');
          }}
        >
          2v2
        </button>
        <button type="button" className="rounded-lg border px-3 py-2" onClick={() => setSelfTeam('blue')}>
          أزرق
        </button>
        <button type="button" className="rounded-lg border px-3 py-2" onClick={() => setSelfTeam('red')}>
          أحمر
        </button>
        <button type="button" className="rounded-lg border px-3 py-2" onClick={() => setSelfSeat(0)}>
          مقعد 0
        </button>
        <button type="button" className="rounded-lg border px-3 py-2" onClick={() => setSelfSeat(1)}>
          مقعد 1
        </button>
        <button
          type="button"
          className="rounded-lg border px-3 py-2"
          onClick={() => setDemoLook({ yaw: 0.85, pitch: 0 })}
        >
          نظر يسار
        </button>
        <button
          type="button"
          className="rounded-lg border px-3 py-2"
          onClick={() => setDemoLook({ yaw: -0.85, pitch: 0 })}
        >
          نظر يمين
        </button>
        <button
          type="button"
          className="rounded-lg border px-3 py-2"
          onClick={() => setDemoLook({ yaw: 0, pitch: 0.8 })}
        >
          نظر أعلى
        </button>
        <button
          type="button"
          className="rounded-lg border px-3 py-2"
          onClick={() => setDemoLook({ yaw: 0, pitch: -0.8 })}
        >
          نظر أسفل
        </button>
        <button type="button" className="rounded-lg border px-3 py-2" onClick={() => setDemoLook({ yaw: 0, pitch: 0 })}>
          إعادة النظر
        </button>
        <button
          type="button"
          className="rounded-lg border px-3 py-2"
          data-testid="harness-approval"
          onClick={() => setShowApproval((open) => !open)}
        >
          موافقة الشريك
        </button>
      </div>
      <p data-testid="harness-mode">
        mode={mode} team={selfTeam} seat={selfSeat} look={demoLook.yaw.toFixed(2)},{demoLook.pitch.toFixed(2)}
      </p>
      <div className="relative min-w-0 overflow-x-hidden rounded-[1.5rem]" data-testid="harness-scene">
        <GameplayScene {...props} />
        <GuessingChallengeSpecialCardsPanel
          className="absolute inset-0 z-10"
          yellowAvailable
          redAvailable
          canUseYellow
          canUseRed
          cardConfirmStatus={
            showApproval
              ? {
                  card: 'yellow',
                  requestingPlayerId: 'tm',
                  requestingPlayerName: 'محمد',
                  selfConfirmed: false,
                  confirmedCount: 1,
                  requiredCount: 2,
                  requestId: 'harness-yellow',
                  message: 'محمد يريد استخدام البطاقة الصفراء',
                }
              : null
          }
          onUseYellow={() => undefined}
          onUseRed={() => undefined}
          onRejectCard={() => setShowApproval(false)}
        />
      </div>
    </main>
  );
}
