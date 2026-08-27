/**
 * P15-B — public SEO content pages.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYABLE_GAME_IDS } from '@wanasatna/shared';
import { faqItems } from '../lib/public/faq-data';
import {
  buildGamePageJsonLd,
  getGameSeoPage,
  listGameSeoPages,
} from '../lib/public/game-seo-content';
import { getGameInformationPath } from '../lib/public/routes';
import { getHomeRoomActionsHref } from '../lib/public/scroll-to-room-actions';
import {
  CONTACT_PAGE_DESCRIPTION,
  CONTACT_PAGE_TITLE,
  FAQ_PAGE_DESCRIPTION,
  FAQ_PAGE_TITLE,
  GAMES_PAGE_DESCRIPTION,
  GAMES_PAGE_TITLE,
  GAME_INFORMATION_PATHS,
  HOME_DESCRIPTION,
  HOME_TITLE,
  SITE_ORIGIN,
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

const leakPattern = /Admin|أدمن|20 لاعب|٢٠ لاعب|عشرين لاعب|maxPlayers:\s*20/i;
const fakeContactPattern =
  /support@|info@wanasatna|@wanasatna\.com|رقم الجوال|رقم الهاتف|\+966|instagram\.com|twitter\.com|x\.com\/|الرياض،|ص\.ب/i;
const publicSeoFiles = [
  'lib/public/game-seo-content.ts',
  'lib/public/faq-data.ts',
  'lib/public/seo.ts',
  'components/public/game-information-page.tsx',
  'components/public/game-cards.tsx',
  'app/(public)/games/page.tsx',
  'app/(public)/games/games-page-client.tsx',
  'app/(public)/games/[gameId]/page.tsx',
  'app/(public)/faq/page.tsx',
  'app/(public)/contact/page.tsx',
  'app/(public)/contact/contact-page-client.tsx',
  'app/sitemap.ts',
];

test('1 /games has unique metadata', () => {
  const page = read('app/(public)/games/page.tsx');
  assert.match(page, /GAMES_PAGE_TITLE/);
  assert.match(page, /GAMES_PAGE_DESCRIPTION/);
  assert.match(page, /canonical: '\/games'/);
  assert.notEqual(GAMES_PAGE_TITLE, FAQ_PAGE_TITLE);
  assert.notEqual(GAMES_PAGE_TITLE, CONTACT_PAGE_TITLE);
  assert.notEqual(GAMES_PAGE_TITLE, HOME_TITLE);
  assert.notEqual(GAMES_PAGE_DESCRIPTION, FAQ_PAGE_DESCRIPTION);
  assert.notEqual(GAMES_PAGE_DESCRIPTION, CONTACT_PAGE_DESCRIPTION);
  assert.notEqual(GAMES_PAGE_DESCRIPTION, HOME_DESCRIPTION);
  assert.match(read('app/(public)/games/games-page-client.tsx'), /<PageHero/);
  assert.match(read('app/(public)/games/games-page-client.tsx'), /الألعاب الجماعية في وناستنا/);
});

test('2 /faq unique metadata', () => {
  const page = read('app/(public)/faq/page.tsx');
  assert.match(page, /FAQ_PAGE_TITLE/);
  assert.match(page, /FAQ_PAGE_DESCRIPTION/);
  assert.match(page, /canonical: '\/faq'/);
  assert.notEqual(FAQ_PAGE_DESCRIPTION, CONTACT_PAGE_DESCRIPTION);
});

test('3 /contact unique metadata', () => {
  const page = read('app/(public)/contact/page.tsx');
  assert.match(page, /CONTACT_PAGE_TITLE/);
  assert.match(page, /CONTACT_PAGE_DESCRIPTION/);
  assert.match(page, /canonical: '\/contact'/);
});

test('4-7 eight game pages resolve with unique title, description, canonical', () => {
  assert.equal(PLAYABLE_GAME_IDS.length, 8);
  assert.equal(listGameSeoPages().length, 8);
  assert.equal(GAME_INFORMATION_PATHS.length, 8);

  const route = read('app/(public)/games/[gameId]/page.tsx');
  assert.match(route, /generateStaticParams/);
  assert.match(route, /PLAYABLE_GAME_IDS/);
  assert.match(route, /notFound/);
  assert.match(route, /openGraph/);
  assert.equal(existsSync(join(root, 'app/(public)/games/[gameId]/page.tsx')), true);

  const titles = new Set<string>();
  const descriptions = new Set<string>();

  for (const gameId of PLAYABLE_GAME_IDS) {
    const page = getGameSeoPage(gameId);
    assert.ok(page, gameId);
    assert.equal(page.id, gameId);
    const path = getGameInformationPath(gameId);
    assert.equal(path, `/games/${gameId}`);
    assert.equal(`${SITE_ORIGIN}${path}`, `${SITE_ORIGIN}/games/${gameId}`);
    titles.add(page.title);
    descriptions.add(page.metaDescription);
    assert.match(route, /canonical: path/);
  }

  assert.equal(titles.size, 8);
  assert.equal(descriptions.size, 8);
  assert.ok(!titles.has(GAMES_PAGE_TITLE));
});

test('8 /games links to all 8', () => {
  const cards = read('components/public/game-cards.tsx');
  assert.match(cards, /اعرف أكثر/);
  assert.match(cards, /getGameInformationPath/);
  assert.match(cards, /isPlayableGameId/);
});

test('9 game page links back to /games', () => {
  const view = read('components/public/game-information-page.tsx');
  assert.match(view, /PUBLIC_ROUTES\.games/);
  assert.match(view, /كل الألعاب/);
  assert.match(view, /رجوع للألعاب/);
});

test('10 game CTA does not create invalid runtime URL', () => {
  const view = read('components/public/game-information-page.tsx');
  assert.match(view, /getHomeRoomActionsHref/);
  assert.equal(getHomeRoomActionsHref(), '/#start-play');
  assert.doesNotMatch(view, /href=\{`\/game/);
  assert.doesNotMatch(view, /\/lobby/);
  assert.doesNotMatch(view, /PUBLIC_ROUTES\.login/);
});

test('11-12 sitemap includes 8 game pages and still excludes Admin/Login/Lobby', () => {
  const sitemap = read('app/sitemap.ts');
  assert.match(sitemap, /GAME_INFORMATION_PATHS/);
  assert.match(sitemap, /INDEXABLE_PUBLIC_PATHS/);
  assert.doesNotMatch(sitemap, /\/admin|\/login|\/lobby|\/api|\/health/);

  for (const gameId of PLAYABLE_GAME_IDS) {
    assert.ok(GAME_INFORMATION_PATHS.includes(`/games/${gameId}`), gameId);
  }

  assert.ok(!GAME_INFORMATION_PATHS.some((path) => path.includes('/admin')));
  assert.ok(!GAME_INFORMATION_PATHS.some((path) => path.includes('/login')));
  assert.ok(!GAME_INFORMATION_PATHS.some((path) => path.includes('/lobby')));
});

test('13 no fake ratings', () => {
  const json = JSON.stringify(listGameSeoPages().map((page) => buildGamePageJsonLd(page)));
  assert.doesNotMatch(json, /AggregateRating|ratingValue|Offer|reviewRating/i);
  assert.match(json, /WebPage/);
  assert.match(json, /BreadcrumbList/);
  const route = read('app/(public)/games/[gameId]/page.tsx');
  assert.doesNotMatch(route, /AggregateRating/);
});

test('14 no fake contact/company details', () => {
  const contact = read('app/(public)/contact/contact-page-client.tsx');
  const contactPage = read('app/(public)/contact/page.tsx');
  assert.doesNotMatch(contact, fakeContactPattern);
  assert.doesNotMatch(contactPage, fakeContactPattern);
  assert.match(contact, /انضم إلى ديسكورد وناستنا/);
  assert.doesNotMatch(CONTACT_PAGE_DESCRIPTION, fakeContactPattern);
});

test('15 GC copy says exactly 2/4', () => {
  const gc = getGameSeoPage('guessing-challenge');
  assert.ok(gc);
  const blob = `${gc.intro}\n${gc.idea}\n${gc.playerNeed}\n${gc.steps.join('\n')}\n${gc.metaDescription}`;
  assert.match(blob, /٢ أو ٤/);
  assert.match(blob, /1 ضد 1/);
  assert.match(blob, /2 ضد 2/);
  assert.match(blob, /أزرق/);
  assert.match(blob, /أحمر/);
  assert.doesNotMatch(blob, /20|٢٠|ثمانية/);
});

test('16 no Admin/20-player capability exposed', () => {
  for (const file of publicSeoFiles) {
    const source = read(file);
    assert.doesNotMatch(source, leakPattern, file);
  }
});

test('17 FAQ says account not required', () => {
  const required = faqItems.find((item) => item.id === 'account-required');
  assert.ok(required);
  assert.equal(required.answer.includes('لا تحتاج حسابًا للعب'), true);
  assert.equal(
    faqItems.some((item) => /سجّل دخولك|أنشئ حساب|فائدة تسجيل الدخول/.test(item.answer)),
    false,
  );
  assert.equal(
    faqItems.some((item) => item.question.includes('هل أحتاج أسجل حساب')),
    true,
  );
});

test('18 headings semantic', () => {
  const games = read('app/(public)/games/games-page-client.tsx');
  const view = read('components/public/game-information-page.tsx');
  const faq = read('app/(public)/faq/page.tsx');
  const contact = read('app/(public)/contact/contact-page-client.tsx');
  assert.match(games, /PageHero/);
  assert.match(view, /<h1/);
  assert.match(view, /وش فكرة اللعبة؟/);
  assert.match(view, /كيف تلعب؟/);
  assert.match(view, /كم لاعب تحتاج؟/);
  assert.match(view, /متى تناسب؟/);
  assert.match(view, /ابدأ اللعب/);
  assert.match(view, /<h2/);
  assert.match(faq, /PageHero/);
  assert.match(contact, /PageHero/);
});

test('19 mobile usable', () => {
  const view = read('components/public/game-information-page.tsx');
  const games = read('app/(public)/games/games-page-client.tsx');
  assert.match(view, /px-4/);
  assert.match(view, /sm:px-6/);
  assert.match(view, /flex-wrap/);
  assert.match(games, /grid-cols-1/);
  assert.match(games, /sm:grid-cols-2/);
});

test('20 unknown game slug uses real 404', () => {
  assert.equal(getGameSeoPage('marathon'), null);
  assert.equal(getGameSeoPage('unknown-game'), null);
  assert.match(read('app/(public)/games/[gameId]/page.tsx'), /notFound\(\)/);
  assert.equal(existsSync(join(root, 'app/not-found.tsx')), true);
});

test('no SEO links to login and no CMS/blog', () => {
  for (const file of publicSeoFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /PUBLIC_ROUTES\.login|href=['"]\/login['"]/, file);
  }
  assert.equal(existsSync(join(root, 'app/(public)/blog')), false);
  assert.equal(existsSync(join(root, 'app/blog')), false);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
