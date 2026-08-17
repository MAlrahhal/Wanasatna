import type { GamePluginDefinition, TimingChallengeMatchState } from '@wanasatna/shared';
import {
  TIMING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT,
  TIMING_CHALLENGE_GAME_ID,
  TIMING_CHALLENGE_PHASE_CHANGED_EVENT,
  TIMING_CHALLENGE_READY_EVENT,
  TIMING_CHALLENGE_START_TIMER_EVENT,
  TIMING_CHALLENGE_STATE_EVENT,
  TIMING_CHALLENGE_STOP_TIMER_EVENT,
  TIMING_CHALLENGE_SUBMIT_GUESS_EVENT,
  TIMING_CHALLENGE_SYNC_EVENT,
} from '@wanasatna/shared';
import { defaultTimingChallengeSettings } from './settings.js';
import { createMatchState } from './state.js';

const metadata = {
  id: TIMING_CHALLENGE_GAME_ID,
  title: 'تحدي التوقيت',
  description: 'اختبر إحساسك بالوقت — خمّن أو أوقف المؤقت في اللحظة المناسبة.',
  iconLabel: 'ت',
} satisfies Pick<GamePluginDefinition, 'id' | 'title' | 'description' | 'iconLabel'>;

export function buildTimingChallengePluginDefinition(): GamePluginDefinition {
  const defaults = defaultTimingChallengeSettings();

  return {
    ...metadata,
    minPlayers: 2,
    maxPlayers: 8,
    defaultSettings: {
      mode: defaults.mode,
      minSeconds: String(defaults.minSeconds),
      maxSeconds: String(defaults.maxSeconds),
    },
    settingsSchema: [
      {
        id: 'mode',
        label: 'وضع اللعب',
        type: 'select',
        defaultValue: defaults.mode,
        options: [
          { value: 'guess-time', label: 'تخمين الوقت' },
          { value: 'stop-timer', label: 'أوقف الوقت' },
        ],
      },
      {
        id: 'minSeconds',
        label: 'الحد الأدنى (ث)',
        type: 'number',
        defaultValue: String(defaults.minSeconds),
      },
      {
        id: 'maxSeconds',
        label: 'الحد الأقصى (ث)',
        type: 'number',
        defaultValue: String(defaults.maxSeconds),
      },
    ],
    validateStart: (_context) => {
      const connectedCount = _context.players.filter((player) => player.isConnected && !player.isSpectator).length;

      if (connectedCount < 2) {
        return {
          success: false,
          error: 'تحتاج لعبة تحدي التوقيت إلى لاعبين على الأقل.',
        };
      }

      return { success: true };
    },
    createInitialState: (context) => createMatchState(context.players, defaults),
    serializeState: (state) => state,
    deserializeState: (payload) => payload as TimingChallengeMatchState,
    lifecycle: {},
    socket: {
      events: {
        sync: TIMING_CHALLENGE_SYNC_EVENT,
        phaseChanged: TIMING_CHALLENGE_PHASE_CHANGED_EVENT,
        ready: TIMING_CHALLENGE_READY_EVENT,
        submitGuess: TIMING_CHALLENGE_SUBMIT_GUESS_EVENT,
        startTimer: TIMING_CHALLENGE_START_TIMER_EVENT,
        stopTimer: TIMING_CHALLENGE_STOP_TIMER_EVENT,
        continueRoundResults: TIMING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT,
        state: TIMING_CHALLENGE_STATE_EVENT,
      },
    },
  };
}
