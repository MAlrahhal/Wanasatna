/**
 * Controlled local workflow for enrolling an existing ADMIN in TOTP MFA.
 *
 * Start:
 *   pnpm --filter @wanasatna/server admin-mfa -- start <exact-email-or-id>
 * Confirm:
 *   pnpm --filter @wanasatna/server admin-mfa -- confirm <exact-email-or-id>
 */
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import {
  confirmAdminMfaEnrollment,
  startAdminMfaEnrollment,
} from '../src/modules/auth/admin-mfa-enrollment.service.js';

function readArguments(argv: string[]): { command: string; identifier: string } {
  const args = argv.filter((value) => value !== '--');
  return {
    command: args[0] ?? '',
    identifier: args[1] ?? '',
  };
}

async function main(): Promise<void> {
  const { command, identifier } = readArguments(process.argv.slice(2));
  if (!identifier || (command !== 'start' && command !== 'confirm')) {
    console.error(
      'Usage: pnpm --filter @wanasatna/server admin-mfa -- <start|confirm> <exact-admin-email-or-id>',
    );
    process.exitCode = 1;
    return;
  }

  if (command === 'start') {
    const enrollment = await startAdminMfaEnrollment(identifier);
    console.log('TOTP enrollment created but not enabled.');
    console.log(`ADMIN id: ${enrollment.userId}`);
    console.log(`ADMIN email: ${enrollment.email}`);
    console.log('Add this secret or URI to the authenticator now. It will not be shown again.');
    console.log(`Manual secret: ${enrollment.secret}`);
    console.log(`otpauth URI: ${enrollment.otpauthUri}`);
    console.log('Run the confirm command next.');
    return;
  }

  const readline = createInterface({ input, output });
  try {
    const token = await readline.question('Current 6-digit TOTP code: ');
    const confirmation = await confirmAdminMfaEnrollment(identifier, token);
    console.log(`MFA enabled for ADMIN ${confirmation.userId}. Existing sessions were revoked.`);
    console.log('Wait for the authenticator code to change before the first MFA login.');
    console.log('Store these single-use recovery codes securely. They will not be shown again:');
    for (const code of confirmation.recoveryCodes) {
      console.log(code);
    }
  } finally {
    readline.close();
  }
}

void main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'MFA enrollment aborted.';
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
