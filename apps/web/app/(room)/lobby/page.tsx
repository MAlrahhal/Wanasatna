import type { Metadata } from 'next';
import { LobbyPageClient } from '@/components/lobby/lobby-page-client';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LobbyPage() {
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-full flex-col text-wanas-text-primary outline-none">
      <LobbyPageClient />
    </main>
  );
}
