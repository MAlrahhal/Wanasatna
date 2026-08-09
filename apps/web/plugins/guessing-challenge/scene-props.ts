import type { GuessingChallengeVisibleIdentity } from '@wanasatna/shared';

export type GuessingChallengeTeamSeat = {
  playerId: string;
  name: string;
  seat: 0 | 1;
  lookYaw?: number;
  lookPitch?: number;
};

/** Shared safe props for CSS fallback and Real3D scene — never includes own secret pre-reveal. */
export type GuessingChallengeSceneProps = {
  mode: 'playing' | 'reveal';
  /** Match format. Existing `mode` stays playing/reveal; use this for 1v1 vs 2v2 layout. */
  matchMode?: '1v1' | '2v2';
  selfTeam?: 'blue' | 'red';
  selfSeat?: 0 | 1;
  teammate?: GuessingChallengeTeamSeat | null;
  opponents?: GuessingChallengeTeamSeat[];
  opponentName: string;
  selfName: string;
  opponentIdentity: GuessingChallengeVisibleIdentity | null;
  selfIdentity: GuessingChallengeVisibleIdentity | null;
  selfHidden: boolean;
  opponentHighlight?: boolean;
  selfHighlight?: boolean;
  isMyTurn?: boolean;
  turnTitle?: string | null;
  turnInstruction?: string | null;
  yellowQuestionsRemaining?: number | null;
  yellowAvailable?: boolean;
  redAvailable?: boolean;
  canUseYellow?: boolean;
  canUseRed?: boolean;
  yellowDisabled?: boolean;
  redDisabled?: boolean;
  onUseYellow?: () => void;
  onUseRed?: () => void;
  /** Normalized look yaw/pitch in -1..1. */
  onLookChange?: (yaw: number, pitch: number) => void;
  /**
   * Special yellow/red cards. Default false for Real3D (side DOM UI owns them).
   * CSS fallback still respects this flag.
   */
  showSpecialCards?: boolean;
  className?: string;
};

export function detectWebGLSupport(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: false });
    return Boolean(gl);
  } catch {
    return false;
  }
}
