import type { GuessingChallengeVisibleIdentity } from '@wanasatna/shared';

/** Shared safe props for CSS fallback and Real3D scene — never includes own secret pre-reveal. */
export type GuessingChallengeSceneProps = {
  mode: 'playing' | 'reveal';
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
