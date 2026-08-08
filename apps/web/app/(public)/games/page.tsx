import type { Metadata } from 'next';
import { GamesPageClient } from './games-page-client';

export const metadata: Metadata = {
  title: 'الألعاب',
};

export default function GamesPage() {
  return <GamesPageClient />;
}
