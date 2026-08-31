/**
 * P17.5 — guest-only public surface + lobby settings invariant.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

test('public nav has no login/register/account controls', () => {
  const navbar = read('components/public/public-navbar.tsx');
  const mobile = read('components/public/mobile-navigation.tsx');
  const footer = read('components/public/public-footer.tsx');
  const home = read('app/(public)/home-page-client.tsx');
  for (const source of [navbar, mobile, footer, home]) {
    assert.doesNotMatch(source, /PublicAuthNavControl|AUTH_COPY\.loginTitle|AUTH_COPY\.registerTitle/);
    assert.doesNotMatch(source, /href=\{PUBLIC_ROUTES\.login\}|href=['"]\/login['"]/);
  }
});

test('Home hero uses official logo, no lock icon, no hero divider', () => {
  const home = read('app/(public)/home-page-client.tsx');
  const logo = read('components/public/public-brand-logo.tsx');
  const navbar = read('components/public/public-navbar.tsx');
  assert.match(home, /PublicBrandLogo/);
  assert.match(logo, /\/brand\/wanasatna-logo\.png/);
  assert.equal(existsSync(join(root, 'public/brand/wanasatna-logo.png')), true);
  assert.doesNotMatch(logo, />و</);
  assert.match(navbar, /PublicBrandLogo/);
  assert.match(home, /لأن الوناسة ما تحلى إلا مع أصحابك/);
  assert.match(home, /بدون تسجيل/);
  assert.doesNotMatch(home, /<svg[\s\S]*lock|M12 15v2|lock icon/i);
  assert.doesNotMatch(home, /section className="relative overflow-hidden border-b/);
});

test('Home Create and Join names stay independent and room icons share the accent treatment', () => {
  const actions = read('lib/public/use-room-actions.ts');
  const cards = read('components/public/room-action-cards.tsx');
  assert.match(actions, /\[createPlayerName, setCreatePlayerName\] = useState\(''\)/);
  assert.match(actions, /\[joinPlayerName, setJoinPlayerName\] = useState\(''\)/);
  assert.match(actions, /const trimmedName = createPlayerName\.trim\(\)[\s\S]*manager\.create\(trimmedName\)/);
  assert.match(actions, /const trimmedName = joinPlayerName\.trim\(\)[\s\S]*manager\.enterFromJoinForm\(trimmedCode, trimmedName\)/);
  assert.match(cards, /id="create-name"[\s\S]*?value=\{createPlayerName\}[\s\S]*?onChange=\{onCreatePlayerNameChange\}/);
  assert.match(cards, /id="join-name"[\s\S]*?value=\{joinPlayerName\}[\s\S]*?onChange=\{onJoinPlayerNameChange\}/);
  assert.equal((cards.match(/bg-wanas-accent font-bold text-white shadow-/g) ?? []).length, 2);
});

test('/login redirects home and stays noindex', () => {
  const page = read('app/(public)/login/page.tsx');
  assert.match(page, /redirect\('\/'\)/);
  assert.match(page, /index: false/);
});

test('lobby settings bind to selected game only', () => {
  const settings = read('components/lobby/game-settings-panel.tsx');
  const lobby = read('components/lobby/lobby-screen.tsx');
  const setup = read('components/lobby/lobby-selected-game-setup.tsx');
  const room = read('contexts/room-context.tsx');
  assert.match(settings, /teamSnapshot\?\.gameId === selectedGame\.id/);
  assert.match(lobby, /isWaitingForNextMatch=\{isWaitingForNextMatch\}/);
  assert.match(lobby, /<LobbySelectedGameSetup/);
  assert.match(lobby, /key=\{selectedGameId \?\? 'none'\}/);
  assert.equal((lobby.match(/<LobbySelectedGameSetup/g) ?? []).length, 1);
  assert.equal((setup.match(/<RoundCategoryPanel/g) ?? []).length, 1);
  assert.equal((setup.match(/<GameSettingsPanel/g) ?? []).length, 1);
  assert.match(room, /payload\.gameId !== selectedId/);
  assert.doesNotMatch(lobby, /isActiveMatch=\{activeMatchParticipantIds !== null\}/);
});

test('FAQ and contact stay guest-truthful', () => {
  const faq = read('lib/public/faq-data.ts');
  const contact = read('app/(public)/contact/contact-page-client.tsx');
  assert.match(faq, /لا تحتاج حسابًا للعب/);
  assert.doesNotMatch(faq, /سجّل دخولك|أنشئ حساب|فائدة تسجيل الدخول/);
  assert.match(contact, /انضم إلى ديسكورد وناستنا/);
  assert.match(contact, /PUBLIC_EXTERNAL_LINKS\.discordInvite/);
  assert.doesNotMatch(contact, /onSubmit|fetch\(|mailto:/);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
