import { argon2id, hash, verify } from 'argon2';
import { env } from '../../config/env.js';

const PRODUCTION_OPTIONS = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const TEST_OPTIONS = {
  type: argon2id,
  memoryCost: 4_096,
  timeCost: 1,
  parallelism: 1,
} as const;

function hashOptions() {
  return env.testMode ? TEST_OPTIONS : PRODUCTION_OPTIONS;
}

let dummyHashPromise: Promise<string> | null = null;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, hashOptions());
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

async function dummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= hash('wanasatna-dummy-password-not-used', hashOptions());
  return dummyHashPromise;
}

/** Compare against a real hash, or a dummy hash when the account does not exist. */
export async function verifyPasswordOrDummy(
  passwordHash: string | null,
  password: string,
): Promise<boolean> {
  const hashToCheck = passwordHash ?? (await dummyPasswordHash());
  const matches = await verifyPassword(hashToCheck, password);
  return Boolean(passwordHash) && matches;
}
