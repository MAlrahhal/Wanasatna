import { IBM_Plex_Sans_Arabic } from 'next/font/google';

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-arabic',
});

export default function GameLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className={`${ibmPlexSansArabic.variable} font-game wanas-game-play-bg flex min-h-dvh w-full flex-1 flex-col`}
    >
      {children}
    </div>
  );
}
