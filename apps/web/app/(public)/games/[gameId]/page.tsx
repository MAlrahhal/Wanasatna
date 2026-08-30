import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PLAYABLE_GAME_IDS } from '@wanasatna/shared';
import { GameInformationPage } from '@/components/public/game-information-page';
import { BRAND_NAME_AR } from '@/lib/public/brand';
import { buildGamePageJsonLd, getGameSeoPage } from '@/lib/public/game-seo-content';
import { getGameInformationPath } from '@/lib/public/routes';
import { buildPublicSocialMetadata } from '@/lib/public/seo';

type GameInformationRouteProps = {
  params: Promise<{ gameId: string }>;
};

export function generateStaticParams() {
  return PLAYABLE_GAME_IDS.map((gameId) => ({ gameId }));
}

export async function generateMetadata({ params }: GameInformationRouteProps): Promise<Metadata> {
  const { gameId } = await params;
  const page = getGameSeoPage(gameId);

  if (!page) {
    return { robots: { index: false, follow: false } };
  }

  const path = getGameInformationPath(page.id);
  const titleWithBrand = `${page.title} | ${BRAND_NAME_AR}`;

  return {
    title: page.title,
    description: page.metaDescription,
    alternates: { canonical: path },
    ...buildPublicSocialMetadata({
      title: titleWithBrand,
      description: page.metaDescription,
      url: path,
    }),
  };
}

export default async function GameInformationRoute({ params }: GameInformationRouteProps) {
  const { gameId } = await params;
  const page = getGameSeoPage(gameId);

  if (!page) {
    notFound();
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildGamePageJsonLd(page)) }}
      />
      <GameInformationPage page={page} />
    </>
  );
}
