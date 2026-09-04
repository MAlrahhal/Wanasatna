/**
 * P15-A — technical SEO foundation.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOME_DESCRIPTION, HOME_TITLE, SITE_ORIGIN, websiteJsonLd } from '../lib/public/seo';
import { PUBLIC_ROUTES } from '../lib/public/routes';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

test('1-5 Home title, description, metadataBase, canonical, lang/RTL', () => {
  assert.equal(SITE_ORIGIN, 'https://wanasatna.com');
  assert.equal(HOME_TITLE, 'وناستنا | ألعاب جماعية عربية للأصدقاء');
  assert.match(HOME_DESCRIPTION, /تجمعات|ديسكورد|أصدق/);
  assert.doesNotMatch(HOME_TITLE + HOME_DESCRIPTION, /الأفضل|رقم 1|ملايين/);

  const rootLayout = read('app/layout.tsx');
  assert.match(rootLayout, /metadataBase/);
  assert.match(rootLayout, /SITE_ORIGIN/);
  assert.match(rootLayout, /lang="ar"/);
  assert.match(rootLayout, /dir="rtl"/);
  assert.match(rootLayout, /applicationName: BRAND_NAME_AR/);

  const home = read('app/(public)/page.tsx');
  assert.match(home, /absolute: HOME_TITLE/);
  assert.match(home, /canonical: '\/'/);
  assert.match(home, /HOME_DESCRIPTION/);

  const homeClient = read('app/(public)/home-page-client.tsx');
  assert.match(homeClient, /<h1/);
  assert.match(homeClient, /لأن الوناسة ما تحلى إلا/);
  assert.match(homeClient, /text-wanas-accent/);
  assert.match(homeClient, /مع أصحابك/);
});

test('6-12 robots and sitemap allow public, exclude private/runtime', () => {
  assert.equal(existsSync(join(root, 'app/robots.ts')), true);
  assert.equal(existsSync(join(root, 'app/sitemap.ts')), true);

  const robots = read('app/robots.ts');
  assert.match(robots, /allow: \['\/', '\/games'\]/);
  assert.match(robots, /sitemap\.xml/);
  assert.doesNotMatch(robots, /disallow: '\/'/);
  assert.match(robots, /\/admin/);
  assert.match(robots, /\/login/);
  assert.match(robots, /\/lobby/);
  assert.match(robots, /\/game/);
  assert.match(robots, /\/api/);
  assert.match(robots, /\/health/);

  const sitemap = read('app/sitemap.ts');
  assert.match(sitemap, /SITE_ORIGIN/);
  assert.match(sitemap, /INDEXABLE_PUBLIC_PATHS/);
  assert.doesNotMatch(sitemap, /\/admin|\/login|\/lobby|\/game|\/api|\/health/);

  assert.equal(PUBLIC_ROUTES.home, '/');
  assert.ok(PUBLIC_ROUTES.games);
  assert.ok(PUBLIC_ROUTES.faq);
  assert.ok(PUBLIC_ROUTES.contact);
});

test('13-15 Admin, login, lobby/runtime are noindex', () => {
  assert.match(read('app/admin/layout.tsx'), /index: false/);
  assert.match(read('app/(public)/login/page.tsx'), /index: false/);
  assert.match(read('app/(room)/lobby/page.tsx'), /index: false/);
  assert.match(read('app/(room)/game/layout.tsx'), /index: false/);
  assert.match(read('app/dev/layout.tsx'), /index: false/);
});

test('16-17 OG and structured data are truthful', () => {
  const rootLayout = read('app/layout.tsx');
  assert.match(rootLayout, /openGraph/);
  assert.match(rootLayout, /twitter/);
  assert.match(rootLayout, /locale: "ar"/);
  assert.doesNotMatch(rootLayout, /openGraph:\s*\{[^}]*images/);

  assert.equal(websiteJsonLd['@type'], 'WebSite');
  const json = JSON.stringify(websiteJsonLd);
  assert.doesNotMatch(json, /AggregateRating|ratingValue|Offer|price|review/i);
  assert.match(read('app/(public)/page.tsx'), /ld\+json/);
  assert.match(read('app/(public)/page.tsx'), /websiteJsonLd/);
});

test('18 unknown routes stay 404; no catch-all SEO pages', () => {
  assert.equal(existsSync(join(root, 'app/not-found.tsx')), true);
  assert.match(read('app/not-found.tsx'), /الصفحة غير موجودة/);
  assert.equal(existsSync(join(root, 'app/[...slug]')), false);
  assert.equal(existsSync(join(root, 'app/(public)/[...slug]')), false);
});

test('19-20 Home Create/Join remain; no privacy leaks in SEO files', () => {
  const homeClient = read('app/(public)/home-page-client.tsx');
  assert.match(homeClient, /RoomActionCards/);
  assert.match(homeClient, /onCreateRoom=\{room\.handleCreateRoom\}/);
  assert.match(homeClient, /onJoinRoom=\{room\.handleJoinRoom\}/);

  const seoFiles = [
    'lib/public/seo.ts',
    'app/robots.ts',
    'app/sitemap.ts',
    'app/layout.tsx',
    'app/(public)/page.tsx',
  ];
  for (const file of seoFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /passwordHash|ADMIN_EMAIL|DATABASE_URL|reconnectToken/);
    assert.doesNotMatch(source, /\/api\/admin|MatchParticipant|userId/);
  }
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
