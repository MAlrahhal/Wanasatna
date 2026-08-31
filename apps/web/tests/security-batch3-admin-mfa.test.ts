/**
 * Batch 3 admin MFA web contracts.
 * Run: node ../server/node_modules/tsx/dist/cli.mjs tests/security-batch3-admin-mfa.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_COPY } from '../lib/admin/copy';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = join(root, '..', '..');

function readWeb(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

function readRepository(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

const sharedTypes = readRepository('packages/shared/src/auth/types.ts');
const api = readWeb('lib/auth/api.ts');
const authContext = readWeb('contexts/auth-context.tsx');
const adminLogin = readWeb('components/admin/admin-login-client.tsx');
const publicLogin = readWeb('app/(public)/login/login-page-client.tsx');

assert.match(sharedTypes, /AuthLoginData = AuthSessionData \| AdminMfaChallengeData/);
assert.match(sharedTypes, /mfaRequired: true/);
assert.match(sharedTypes, /challengeToken: string/);
assert.match(sharedTypes, /AdminMfaMethod = 'totp' \| 'recovery'/);
assert.doesNotMatch(sharedTypes, /totpSecret|recoveryCodes/);

assert.match(api, /authUrl\('\/mfa\/verify'\)/);
assert.match(api, /body: JSON\.stringify\(input\)/);
assert.match(api, /credentials: 'include'/);
assert.doesNotMatch(api, /localStorage|sessionStorage|URLSearchParams|console\./);

assert.match(authContext, /result\.success && 'user' in result\.data/);
assert.match(authContext, /verifyAdminMfa\(input\)/);
assert.match(authContext, /setUser\(result\.data\.user\)/);

assert.match(adminLogin, /useState<string \| null>\(null\)/);
assert.match(adminLogin, /'mfaRequired' in result\.data/);
assert.match(adminLogin, /verifyAdminMfa\(\{ challengeToken, method: mfaMethod, code \}\)/);
assert.match(adminLogin, /\^\\d\{6\}\$/);
assert.match(adminLogin, /'totp', 'recovery'/);
assert.match(adminLogin, /autoComplete=\{mfaMethod === 'totp' \? 'one-time-code' : 'off'\}/);
assert.match(adminLogin, /fetchAdminMe\(\)/);
assert.doesNotMatch(
  adminLogin,
  /localStorage|sessionStorage|URLSearchParams|router\.(?:push|replace)\([^)]*challenge|console\./,
);

assert.match(publicLogin, /'mfaRequired' in result\.data/);
assert.match(publicLogin, /AUTH_COPY\.adminMfaRequired/);
assert.doesNotMatch(publicLogin, /setChallengeToken|verifyAdminMfa/);

assert.equal(ADMIN_COPY.mfaTitle, 'التحقق بخطوتين');
assert.equal(ADMIN_COPY.mfaTotpOption, 'تطبيق المصادقة');
assert.equal(ADMIN_COPY.mfaRecoveryOption, 'رمز استرداد');

console.log('Batch 3 admin MFA web contracts passed');
