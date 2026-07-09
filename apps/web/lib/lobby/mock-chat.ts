import type { LobbyChatMessage } from './types';

export const mockLobbyChatMessages: LobbyChatMessage[] = [
  {
    id: '1',
    playerName: 'النظام',
    message: 'مرحباً في الغرفة! اختاروا لعبة للبدء.',
    createdAt: '20:01',
    isSystem: true,
  },
  {
    id: '2',
    playerName: 'سارة',
    message: 'أهلاً بالجميع 👋',
    createdAt: '20:02',
  },
  {
    id: '3',
    playerName: 'أحمد',
    message: 'اقترح برا السالفة!',
    createdAt: '20:03',
  },
];
