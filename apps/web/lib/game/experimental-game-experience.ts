import type {
  EmojiLanguagePlayerView,
  EyewitnessPlayerView,
  MostLikelyToPlayerView,
  OneWordOnlyPlayerView,
  SecretAgentsPlayerView,
  TimelinePlacementPlayerView,
} from '@wanasatna/shared';
import type { GameExperienceMeta, GameExperienceTimer } from './shell-types';

function countdown(deadlineAtMs: number | null): GameExperienceTimer | undefined {
  return deadlineAtMs === null
    ? undefined
    : { deadlineAtMs, format: 'seconds', lowTimeThreshold: 10 };
}

export function secretAgentsExperienceMeta(view: SecretAgentsPlayerView): GameExperienceMeta {
  const activeTeam = view.activeTeam === 'red' ? 'الفريق الأحمر' : 'الفريق الأزرق';
  const phaseLabel =
    view.phase === 'clue'
      ? 'مرحلة التلميح'
      : view.phase === 'guessing'
        ? 'مرحلة التخمين'
        : view.phase === 'paused'
          ? 'متوقفة مؤقتًا'
          : 'النتيجة النهائية';

  return {
    gameName: 'العملاء السريون',
    gameIcon: '🕵️',
    layoutMode: view.phase === 'completed' ? 'final-results' : 'gameplay',
    phaseLabel,
    centerLabel: `${activeTeam} · الدور ${view.turnNumber}`,
    timer: countdown(view.phase === 'paused' ? view.recoveryDeadlineAtMs : view.deadlineAtMs),
    leaderboardEntries: [],
  };
}

export function mostLikelyToExperienceMeta(view: MostLikelyToPlayerView): GameExperienceMeta {
  const rows =
    view.phase === 'completed'
      ? (view.aggregate?.nominees ?? [])
      : view.phase === 'reveal'
        ? (view.result?.nominees ?? [])
        : [];

  return {
    gameName: 'مين أكثر واحد؟',
    gameIcon: '👑',
    layoutMode:
      view.phase === 'completed'
        ? 'final-results'
        : view.phase === 'reveal'
          ? 'round-results'
          : 'gameplay',
    phaseLabel:
      view.phase === 'voting'
        ? 'التصويت السري'
        : view.phase === 'reveal'
          ? 'كشف الأصوات'
          : 'النتائج النهائية',
    currentRound: view.questionNumber,
    totalRounds: view.totalQuestions,
    timer: view.phase === 'voting' ? countdown(view.deadlineAtMs) : undefined,
    leaderboardEntries: rows.map((entry) => ({
      playerId: entry.playerId,
      name: entry.name,
      score: entry.voteCount,
      isCurrentPlayer: entry.playerId === view.selfPlayerId,
    })),
  };
}

export function emojiLanguageExperienceMeta(view: EmojiLanguagePlayerView): GameExperienceMeta {
  return {
    gameName: 'لغة الإيموجي',
    gameIcon: '😀',
    layoutMode:
      view.phase === 'completed'
        ? 'final-results'
        : view.phase === 'round-results'
          ? 'round-results'
          : 'gameplay',
    phaseLabel:
      view.phase === 'preparation'
        ? 'تجهيز التلميح'
        : view.phase === 'guessing'
          ? 'فك الرموز'
          : view.phase === 'round-results'
            ? 'نتيجة الجولة'
            : 'النتائج النهائية',
    centerLabel: view.writerName ? `كاتب الجولة: ${view.writerName}` : undefined,
    currentRound: view.currentRound,
    totalRounds: view.totalRounds,
    timer: countdown(view.deadlineAtMs),
    leaderboardEntries: view.leaderboard.map((entry) => ({
      playerId: entry.playerId,
      name: entry.name,
      score: entry.score,
      isCurrentPlayer: entry.playerId === view.selfPlayerId,
    })),
  };
}

export function timelinePlacementExperienceMeta(
  view: TimelinePlacementPlayerView,
): GameExperienceMeta {
  return {
    gameName: 'زمانها وين؟',
    gameIcon: '🕰️',
    layoutMode:
      view.phase === 'completed'
        ? 'final-results'
        : view.phase === 'answer-reveal' || view.phase === 'placements-reveal'
          ? 'round-results'
          : 'gameplay',
    phaseLabel:
      view.phase === 'selecting'
        ? 'اختيار الموقع'
        : view.phase === 'placements-reveal'
          ? 'كشف الاختيارات'
          : view.phase === 'answer-reveal'
            ? 'الإجابة الصحيحة'
            : 'النتائج النهائية',
    currentRound: view.currentRound,
    totalRounds: view.totalRounds,
    timer: countdown(view.deadlineAtMs),
    leaderboardEntries: view.leaderboard.map((entry) => ({
      playerId: entry.playerId,
      name: entry.name,
      score: entry.score,
      isCurrentPlayer: entry.playerId === view.selfPlayerId,
    })),
  };
}

export function oneWordOnlyExperienceMeta(view: OneWordOnlyPlayerView): GameExperienceMeta {
  return {
    gameName: 'كلمة وحدة بس',
    gameIcon: '💡',
    layoutMode:
      view.phase === 'completed'
        ? 'final-results'
        : view.phase === 'round-reveal'
          ? 'round-results'
          : 'gameplay',
    phaseLabel:
      view.phase === 'clue-writing'
        ? 'كتابة التلميحات'
        : view.phase === 'guessing'
          ? 'اختيار الإجابة'
          : view.phase === 'round-reveal'
            ? 'نتيجة الجولة'
            : 'الملخص النهائي',
    centerLabel: `المخمّن: ${view.guesserName}`,
    currentRound: view.currentRound,
    totalRounds: view.totalRounds,
    timer: countdown(view.deadlineAtMs),
    leaderboardEntries: [],
  };
}

export function eyewitnessExperienceMeta(view: EyewitnessPlayerView): GameExperienceMeta {
  return {
    gameName: 'شاهد عيان',
    gameIcon: '👁️',
    layoutMode:
      view.phase === 'completed'
        ? 'final-results'
        : view.phase === 'round-results'
          ? 'round-results'
          : 'gameplay',
    phaseLabel:
      view.phase === 'witness'
        ? 'المشاهدة والوصف'
        : view.phase === 'drawing'
          ? 'مرحلة الرسم'
          : view.phase === 'voting'
            ? 'التصويت'
            : view.phase === 'round-results'
              ? 'نتيجة الجولة'
              : 'النتائج النهائية',
    centerLabel: `شاهد الجولة: ${view.witnessName}`,
    currentRound: view.currentRound,
    totalRounds: view.totalRounds,
    timer: countdown(view.deadlineAtMs),
    leaderboardEntries: view.leaderboard.map((entry) => ({
      playerId: entry.playerId,
      name: entry.playerName,
      score: entry.wins,
      isCurrentPlayer: entry.playerId === view.selfPlayerId,
    })),
  };
}
