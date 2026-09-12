import type { PlayableGameId } from '@wanasatna/shared';

export type GameSelectionRow = {
  id: PlayableGameId;
  title: string;
  players: string;
  style: string;
  note: string;
};

export const GAME_SELECTION_GUIDE_ROWS: readonly GameSelectionRow[] = [
  {
    id: 'bara-al-salafa',
    title: 'برا السالفة',
    players: '٣–٨',
    style: 'نقاش وتخمين',
    note: 'أسئلة ثم تصويت. صوت القروب يفيد.',
  },
  {
    id: 'draw-guess',
    title: 'ارسم وخمّن',
    players: '٢–٨',
    style: 'رسم',
    note: 'واحد يرسم والباقي يخمنون. الرسام ما يخمن.',
  },
  {
    id: 'imposter-draw',
    title: 'الإمبوستر بالرسم',
    players: '٣–٨',
    style: 'رسم مشترك + تصويت',
    note: 'ترسمون بالدور على نفس اللوحة.',
  },
  {
    id: 'timing-challenge',
    title: 'تحدي التوقيت',
    players: '٢–٨',
    style: 'إحساس بالوقت',
    note: 'ما تعتمد على النقاش. وضعين يختارهما المضيف.',
  },
  {
    id: 'fast-answer',
    title: 'أسرع إجابة',
    players: '٢–٨',
    style: 'أسئلة وكتابة',
    note: 'كل إجابة صحيحة تكسب نقاطاً حسب ترتيبها.',
  },
  {
    id: 'who-wrote-it',
    title: 'من كتبها؟',
    players: '٣–٨',
    style: 'كتابة وتخمين',
    note: 'تخمّنون مين كتب كل جملة، ما عدا جملتكم.',
  },
  {
    id: 'judge',
    title: 'القاضي',
    players: '٣–٨',
    style: 'قاضي يختار',
    note: 'مو تصويت جماعي. القاضي يختار إجابة واحدة.',
  },
  {
    id: 'guessing-challenge',
    title: 'تحدي التخمين',
    players: '٢ أو ٤',
    style: 'فرق وأسئلة نعم/لا',
    note: '1 ضد 1 أو 2 ضد 2 بين الأزرق والأحمر.',
  },
];
