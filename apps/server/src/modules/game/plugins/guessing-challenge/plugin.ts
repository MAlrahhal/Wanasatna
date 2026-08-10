import type {
  GamePluginDefinition,
  GamePluginSettings,
  GuessingChallengeMatchState,
  LoadedGameContent,
} from '@wanasatna/shared';
import {
  GUESSING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT,
  GUESSING_CHALLENGE_END_QUESTION_EVENT,
  GUESSING_CHALLENGE_GAME_ID,
  GUESSING_CHALLENGE_LOOK_EVENT,
  GUESSING_CHALLENGE_LOOK_UPDATE_EVENT,
  GUESSING_CHALLENGE_PHASE_CHANGED_EVENT,
  GUESSING_CHALLENGE_SET_CATEGORY_EVENT,
  GUESSING_CHALLENGE_STATE_EVENT,
  GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT,
  GUESSING_CHALLENGE_SYNC_EVENT,
  GUESSING_CHALLENGE_REJECT_CARD_EVENT,
  GUESSING_CHALLENGE_USE_RED_CARD_EVENT,
  GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT,
  GUESSING_CHALLENGE_TEAM_CAPABILITY,
  contentValidationToPluginError,
  validateGameStartContent,
} from '@wanasatna/shared';
import { getGuessingChallengeRoomMode } from './mode-store.js';
import {
  createMatchState,
  requiredPlayerCountForMode,
  resolveGuessingChallengeMode,
} from './state.js';
import { getPregameTeams, toTeamMaps } from '../../runtime/pregame-teams-store.js';

const metadata = {
  id: GUESSING_CHALLENGE_GAME_ID,
  title: 'تحدي التخمين',
  description: 'اعرف هويتك قبل خصمك',
  iconLabel: 'ت',
  teamCapability: GUESSING_CHALLENGE_TEAM_CAPABILITY,
} satisfies Pick<
  GamePluginDefinition,
  'id' | 'title' | 'description' | 'iconLabel' | 'teamCapability'
>;

export function buildGuessingChallengePluginDefinition(
  content: LoadedGameContent,
): GamePluginDefinition {
  const { bundle, settings } = content;
  const defaultMode = resolveGuessingChallengeMode(settings);

  return {
    ...metadata,
    minPlayers: settings.minPlayers,
    maxPlayers: settings.maxPlayers,
    defaultSettings: {
      ...(settings as GamePluginSettings),
      mode: defaultMode,
    },
    settingsSchema: [
      {
        id: 'mode',
        label: 'وضع اللعب',
        type: 'select',
        defaultValue: defaultMode,
        options: [
          { value: '1v1', label: 'فردي (1 ضد 1)' },
          { value: '2v2', label: 'فرق (2 ضد 2)' },
        ],
      },
    ],
    validateStart: (context, pluginSettings) => {
      const roomMode = getGuessingChallengeRoomMode(context.roomId);
      const mode = resolveGuessingChallengeMode(settings, roomMode ?? pluginSettings?.mode);
      const required = requiredPlayerCountForMode(mode);
      const connectedCount = context.players.filter((player) => player.isConnected).length;

      if (connectedCount !== required) {
        return {
          success: false,
          error:
            mode === '2v2'
              ? 'تحدي التخمين ثنائي الفرق يحتاج أربعة لاعبين متصلين.'
              : 'تحدي التخمين الفردي يحتاج لاعبين متصلين.',
        };
      }

      const validation = validateGameStartContent(bundle, settings, connectedCount);
      const error = contentValidationToPluginError(validation);

      if (error) {
        return { success: false, error };
      }

      return { success: true };
    },
    createInitialState: (context, pluginSettings) => {
      const roomMode = getGuessingChallengeRoomMode(context.roomId);
      const mode = resolveGuessingChallengeMode(settings, roomMode ?? pluginSettings?.mode);
      const pregame = getPregameTeams(context.roomId);
      const teamAssignment = pregame ? toTeamMaps(pregame) : undefined;
      return createMatchState(context.roomId, context.players, settings, mode, teamAssignment);
    },
    serializeState: (state) => state,
    deserializeState: (payload) => payload as GuessingChallengeMatchState,
    lifecycle: {},
    socket: {
      events: {
        sync: GUESSING_CHALLENGE_SYNC_EVENT,
        phaseChanged: GUESSING_CHALLENGE_PHASE_CHANGED_EVENT,
        endQuestion: GUESSING_CHALLENGE_END_QUESTION_EVENT,
        submitFinalGuess: GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT,
        useYellowCard: GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT,
        useRedCard: GUESSING_CHALLENGE_USE_RED_CARD_EVENT,
        rejectCard: GUESSING_CHALLENGE_REJECT_CARD_EVENT,
        continueRoundResults: GUESSING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT,
        setCategory: GUESSING_CHALLENGE_SET_CATEGORY_EVENT,
        look: GUESSING_CHALLENGE_LOOK_EVENT,
        lookUpdate: GUESSING_CHALLENGE_LOOK_UPDATE_EVENT,
        state: GUESSING_CHALLENGE_STATE_EVENT,
      },
    },
  };
}
