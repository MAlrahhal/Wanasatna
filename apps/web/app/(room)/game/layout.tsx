import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-arabic',
});

export default function GameLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={`${ibmPlexSansArabic.variable} font-game wanas-game-play-bg flex min-h-dvh w-full flex-1 flex-col outline-none`}
    >
      {children}
    </main>
  );
}
