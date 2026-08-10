'use client';

import { useMemo, useState } from 'react';
import { GameplayScene } from '@/plugins/guessing-challenge/gameplay-scene';
import type { GuessingChallengeSceneProps } from '@/plugins/guessing-challenge/scene-props';

const IDENTITY = { type: 'text' as const, value: 'برجر', imageUrl: null };

/** Client harness body — only mounted from the production-gated page. */
export function GuessingChallengeSceneHarness() {
  const [mode, setMode] = useState<'1v1' | '2v2'>(() => {
    if (typeof window === 'undefined') return '1v1';
    return new URLSearchParams(window.location.search).get('mode') === '2v2' ? '2v2' : '1v1';
  });

  const props: GuessingChallengeSceneProps = useMemo(() => {
    if (mode === '2v2') {
      return {
        mode: 'playing',
        matchMode: '2v2',
        selfTeam: 'blue',
        selfSeat: 0,
        teammate: {
          playerId: 'tm',
          name: 'محمد',
          seat: 1,
          lookYaw: 0.35,
          lookPitch: 0.1,
        },
        opponents: [
          { playerId: 'o0', name: 'خالد', seat: 0, lookYaw: -0.25, lookPitch: -0.1 },
          { playerId: 'o1', name: 'علي', seat: 1, lookYaw: 0.2, lookPitch: 0.15 },
        ],
        opponentName: 'خالد',
        selfName: 'سارة',
        opponentIdentity: IDENTITY,
        selfIdentity: null,
        selfHidden: true,
        isMyTurn: true,
        turnTitle: 'دورك',
        turnInstruction: 'اسأل خصمك سؤالًا',
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
      turnInstruction: 'اسأل خصمك سؤالًا',
      showSpecialCards: false,
    };
  }, [mode]);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-4" dir="rtl">
      <h1 className="text-xl font-bold">GC Real3D harness</h1>
      <div className="flex gap-2">
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
      </div>
      <p data-testid="harness-mode">mode={mode}</p>
      <div className="relative overflow-hidden rounded-[1.5rem]" data-testid="harness-scene">
        <GameplayScene {...props} />
      </div>
    </main>
  );
}
