/**
 * P15-C — final public SEO closure.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYABLE_GAME_IDS } from '@wanasatna/shared';
import { faqItems } from '../lib/public/faq-data';
import { getGameSeoPage, listGameSeoPages } from '../lib/public/game-seo-content';
import { getHomeRoomActionsHref } from '../lib/public/scroll-to-room-actions';
import {
  CONTACT_PAGE_DESCRIPTION,
  CONTACT_PAGE_TITLE,
  FAQ_PAGE_DESCRIPTION,
  FAQ_PAGE_TITLE,
  GAME_INFORMATION_PATHS,
  GAMES_PAGE_DESCRIPTION,
  GAMES_PAGE_TITLE,
  HOME_DESCRIPTION,
  HOME_TITLE,
  INDEXABLE_PUBLIC_PATHS,
  SITE_ORIGIN,
  websiteJsonLd,
} from '../lib/public/seo';

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

const INTENDED_INDEXABLE_PATHS = [
  '/',
  '/games',
  '/faq',
  '/contact',
  '/games/bara-al-salafa',
  '/games/draw-guess',
  '/games/imposter-draw',
  '/games/timing-challenge',
  '/games/fast-answer',
  '/games/who-wrote-it',
  '/games/judge',
  '/games/guessing-challenge',
] as const;

const seoSurfaceFiles = [
  'lib/public/seo.ts',
  'lib/public/game-seo-content.ts',
  'lib/public/faq-data.ts',
  'app/robots.ts',
  'app/sitemap.ts',
  'app/layout.tsx',
  'app/not-found.tsx',
  'app/(public)/page.tsx',
  'app/(public)/games/page.tsx',
  'app/(public)/faq/page.tsx',
  'app/(public)/contact/page.tsx',
  'app/(public)/games/[gameId]/page.tsx',
];

test('indexable routes are exactly the intended 12 production URLs', () => {
  const paths = [...INDEXABLE_PUBLIC_PATHS, ...GAME_INFORMATION_PATHS];
  assert.deepEqual([...paths].sort(), [...INTENDED_INDEXABLE_PATHS].sort());
  assert.equal(new Set(paths).size, 12);
  assert.equal(PLAYABLE_GAME_IDS.length, 8);

  const urls = paths.map((path) =>
    path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`,
  );
  assert.equal(new Set(urls).size, 12);
  for (const url of urls) {
    assert.match(url, /^https:\/\/wanasatna\.com\//);
    assert.doesNotMatch(url, /localhost|railway|127\.0\.0\.1|\?|#/i);
  }
});

test('robots allow public catalog while excluding private/runtime', () => {
  const robots = read('app/robots.ts');
  assert.match(robots, /allow: \['\/', '\/games'\]/);
  assert.match(robots, /SITE_ORIGIN/);
  assert.match(robots, /sitemap\.xml/);
  assert.doesNotMatch(robots, /disallow: '\/'/);
  for (const blocked of ['/admin', '/login', '/lobby', '/game', '/dev', '/api', '/health']) {
    assert.match(robots, new RegExp(`'${blocked}'`));
  }
});

test('private/runtime routes stay noindex; 404 is noindex', () => {
  assert.match(read('app/admin/layout.tsx'), /index: false/);
  assert.match(read('app/admin/login/page.tsx'), /index: false/);
  assert.match(read('app/(public)/login/page.tsx'), /index: false/);
  assert.match(read('app/(room)/lobby/page.tsx'), /index: false/);
  assert.match(read('app/(room)/game/layout.tsx'), /index: false/);
  assert.match(read('app/dev/layout.tsx'), /index: false/);
  assert.match(read('app/not-found.tsx'), /index: false/);
});

test('metadata uniqueness, canonicals, OG, and Twitter', () => {
  const publicTitles = [HOME_TITLE, `${GAMES_PAGE_TITLE} | وناستنا`, `${FAQ_PAGE_TITLE} | وناستنا`, `${CONTACT_PAGE_TITLE} | وناستنا`];
  assert.equal(new Set(publicTitles).size, 4);

  const descriptions = [
    HOME_DESCRIPTION,
    GAMES_PAGE_DESCRIPTION,
    FAQ_PAGE_DESCRIPTION,
    CONTACT_PAGE_DESCRIPTION,
    ...listGameSeoPages().map((page) => page.metaDescription),
  ];
  assert.equal(new Set(descriptions).size, 12);

  const titles = [HOME_TITLE, ...listGameSeoPages().map((page) => `${page.title} | وناستنا`)];
  assert.equal(new Set(titles).size, 9);

  assert.match(read('app/(public)/page.tsx'), /canonical: '\/'/);
  assert.match(read('app/(public)/games/page.tsx'), /canonical: '\/games'/);
  assert.match(read('app/(public)/faq/page.tsx'), /canonical: '\/faq'/);
  assert.match(read('app/(public)/contact/page.tsx'), /canonical: '\/contact'/);
  assert.match(read('app/(public)/games/[gameId]/page.tsx'), /canonical: path/);
  assert.doesNotMatch(read('app/(public)/games/[gameId]/page.tsx'), /canonical: '\/'/);

  for (const file of [
    'app/(public)/page.tsx',
    'app/(public)/games/page.tsx',
    'app/(public)/faq/page.tsx',
    'app/(public)/contact/page.tsx',
    'app/(public)/games/[gameId]/page.tsx',
  ]) {
    const source = read(file);
    assert.match(source, /openGraph:/);
    assert.match(source, /twitter:/);
    assert.doesNotMatch(source, /images:\s*\[/);
  }
});

test('game copy stays game-specific; GC remains 2/4; no Admin 20-player leak', () => {
  const pages = listGameSeoPages();
  const intros = pages.map((page) => page.intro);
  assert.equal(new Set(intros).size, 8);

  const gc = getGameSeoPage('guessing-challenge');
  assert.ok(gc);
  assert.match(gc.playerNeed, /٢ أو ٤/);
  assert.match(gc.playerNeed, /1 ضد 1/);
  assert.match(gc.playerNeed, /2 ضد 2/);
  assert.match(gc.playerNeed, /أزرق/);
  assert.match(gc.playerNeed, /أحمر/);

  const blob = pages.map((page) => `${page.intro}${page.idea}${page.playerNeed}${page.steps.join('')}`).join('\n');
  assert.doesNotMatch(blob, /20 لاعب|٢٠ لاعب|عشرين|Admin|أدمن|تجريبي/);
  assert.doesNotMatch(read('lib/public/game-seo-content.ts'), /اكتب أو اختر/);
});

test('internal links, FAQ/contact truth, structured data, 404', () => {
  assert.match(read('components/public/game-cards.tsx'), /اعرف أكثر/);
  assert.match(read('components/public/game-information-page.tsx'), /PUBLIC_ROUTES\.games/);
  assert.equal(getHomeRoomActionsHref(), '/#start-play');

  const account = faqItems.find((item) => item.id === 'account-required');
  assert.ok(account);
  assert.match(account.answer, /لا تحتاج حسابًا للعب/);
  assert.equal(
    faqItems.some((item) => /سجّل دخولك|فائدة تسجيل الدخول|بريميوم/.test(`${item.question}${item.answer}`)),
    false,
  );

  const contact = read('app/(public)/contact/contact-page-client.tsx');
  assert.doesNotMatch(contact, /support@|@wanasatna\.com|\+966|Instagram/);
  assert.match(contact, /انضم إلى ديسكورد وناستنا/);

  const json = `${JSON.stringify(websiteJsonLd)}${read('lib/public/game-seo-content.ts')}`;
  assert.match(json, /WebSite/);
  assert.doesNotMatch(json, /AggregateRating|ratingValue|"Offer"|reviewRating/i);

  assert.equal(getGameSeoPage('unknown-game'), null);
  assert.match(read('app/(public)/games/[gameId]/page.tsx'), /notFound\(\)/);
  assert.equal(existsSync(join(root, 'app/(public)/[...slug]')), false);
});

test('SEO surfaces stay on wanasatna.com and do not leak private data', () => {
  assert.equal(SITE_ORIGIN, 'https://wanasatna.com');
  for (const file of seoSurfaceFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /localhost|127\.0\.0\.1|railway\.app|wanasatna\.up\.railway/i, file);
    assert.doesNotMatch(
      source,
      /passwordHash|ADMIN_EMAIL|DATABASE_URL|reconnectToken|userId|playerId|matchId|roomCode/,
      file,
    );
  }

  assert.match(read('app/(public)/home-page-client.tsx'), /<h1/);
  assert.match(read('app/(public)/home-page-client.tsx'), /onCreateRoom=\{room\.handleCreateRoom\}/);
  assert.match(read('app/(public)/home-page-client.tsx'), /onJoinRoom=\{room\.handleJoinRoom\}/);
  assert.match(read('app/layout.tsx'), /lang="ar"/);
  assert.match(read('app/layout.tsx'), /dir="rtl"/);
  assert.equal(existsSync(join(root, 'app/(public)/login/page.tsx')), true);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
