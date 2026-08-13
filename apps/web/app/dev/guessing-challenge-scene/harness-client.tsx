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
  const [selfTeam, setSelfTeam] = useState<'blue' | 'red'>('blue');
  const [selfSeat, setSelfSeat] = useState<0 | 1>(0);
  const [demoLook, setDemoLook] = useState<{ yaw: number; pitch: number }>({
    yaw: 0,
    pitch: 0,
  });

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

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-4" dir="rtl">
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
        <button
          type="button"
          className="rounded-lg border px-3 py-2"
          onClick={() => setDemoLook({ yaw: 0, pitch: 0 })}
        >
          إعادة النظر
        </button>
      </div>
      <p data-testid="harness-mode">
        mode={mode} team={selfTeam} seat={selfSeat} look={demoLook.yaw.toFixed(2)},{demoLook.pitch.toFixed(2)}
      </p>
      <div className="relative overflow-hidden rounded-[1.5rem]" data-testid="harness-scene">
        <GameplayScene {...props} />
      </div>
    </main>
  );
}
