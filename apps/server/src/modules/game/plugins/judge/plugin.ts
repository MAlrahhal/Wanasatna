import type { GamePluginDefinition } from '@wanasatna/shared';
import { pluginActionEvent, pluginStateEvent } from '@wanasatna/shared';

const metadata = {
  id: 'judge',
  title: 'القاضي',
  description: 'القاضي يحكم… والباقي يحاولون يقنعونه.',
  iconLabel: 'ق',
  minPlayers: 3,
  maxPlayers: 10,
} satisfies Pick<GamePluginDefinition, 'id' | 'title' | 'description' | 'iconLabel' | 'minPlayers' | 'maxPlayers'>;

export const judgePlugin: GamePluginDefinition = {
  ...metadata,
  defaultSettings: { rounds: '3', caseType: 'mixed' },
  settingsSchema: [
    { id: 'rounds', label: 'عدد الجولات', type: 'number', defaultValue: '3' },
    { id: 'caseType', label: 'نوع القضايا', type: 'select', defaultValue: 'mixed', options: [{ value: 'mixed', label: 'مختلط' }] },
  ],
  createInitialState: () => ({}),
  serializeState: (state) => state,
  deserializeState: (payload) => payload,
  lifecycle: {},
  socket: {
    events: {
      state: pluginStateEvent(metadata.id),
      action: pluginActionEvent(metadata.id, 'action'),
    },
  },
};
