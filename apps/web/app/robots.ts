import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/lib/public/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/games'],
      disallow: ['/admin', '/login', '/lobby', '/game', '/dev', '/api', '/health'],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
