/**
 * One-time owner bootstrap: promote an EXISTING User to ADMIN.
 * Not an HTTP endpoint. Does not create users.
 *
 * From the repository root:
 *   pnpm --filter @wanasatna/server promote-admin -- <exact-existing-email-or-id>
 */
import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { promoteExistingUserToAdmin } from '../src/modules/admin/promote-existing-user.js';

function readIdentifier(argv: string[]): string {
  const args = argv.filter((value) => value !== '--');

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (current === '--email' || current === '--id') {
      return args[index + 1] ?? '';
    }
  }

  const positional = args.find((value) => !value.startsWith('-'));
  return positional ?? '';
}

async function main(): Promise<void> {
  const identifier = readIdentifier(process.argv.slice(2));

  if (!identifier) {
    console.error(
      'Usage: pnpm --filter @wanasatna/server promote-admin -- <exact-existing-email-or-id>',
    );
    process.exitCode = 1;
    await prisma.$disconnect().catch(() => undefined);
    return;
  }

  try {
    const result = await promoteExistingUserToAdmin(identifier);
    console.log('Promoted existing User to ADMIN.');
    console.log(`id: ${result.id}`);
    console.log(`email: ${result.email}`);
    console.log(`role: ${result.role}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Promotion aborted.';
    console.error(message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

void main();
