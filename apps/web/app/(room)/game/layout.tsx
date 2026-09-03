import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function GameLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="font-game wanas-game-play-bg flex min-h-dvh w-full flex-1 flex-col outline-none"
    >
      {children}
    </main>
  );
}
