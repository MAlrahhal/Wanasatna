import type { MetadataRoute } from 'next';
import { PUBLIC_ROUTES } from '@/lib/public/routes';
import { GAME_INFORMATION_PATHS, INDEXABLE_PUBLIC_PATHS, SITE_ORIGIN } from '@/lib/public/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [...INDEXABLE_PUBLIC_PATHS, ...GAME_INFORMATION_PATHS];

  return paths.map((path) => ({
    url: path === PUBLIC_ROUTES.home ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`,
    changeFrequency: path === PUBLIC_ROUTES.home ? 'weekly' : 'monthly',
    priority: path === PUBLIC_ROUTES.home ? 1 : path === PUBLIC_ROUTES.games ? 0.8 : 0.7,
  }));
}
