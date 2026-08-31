import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';

const KEY_VERSION = 1;
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const HEX_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

export class AdminTotpEncryptionError extends Error {
  constructor() {
    super('Admin TOTP encryption is unavailable.');
    this.name = 'AdminTotpEncryptionError';
  }
}

function encryptionKey(value: string | undefined): Buffer {
  if (!value || !HEX_KEY_PATTERN.test(value)) {
    throw new AdminTotpEncryptionError();
  }

  return Buffer.from(value, 'hex');
}

function additionalAuthenticatedData(userId: string): Buffer {
  return Buffer.from(`wanasatna:admin-totp:v${KEY_VERSION}:${userId}`, 'utf8');
}

export function assertAdminTotpEncryptionConfigured(keyValue = env.adminTotpEncryptionKey): void {
  encryptionKey(keyValue);
}

export function encryptAdminTotpSecret(
  userId: string,
  secret: string,
  keyValue = env.adminTotpEncryptionKey,
): string {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(keyValue), nonce, {
    authTagLength: AUTH_TAG_BYTES,
  });
  cipher.setAAD(additionalAuthenticatedData(userId));

  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    `v${KEY_VERSION}`,
    nonce.toString('base64url'),
    ciphertext.toString('base64url'),
    authTag.toString('base64url'),
  ].join('.');
}

export function decryptAdminTotpSecret(
  userId: string,
  encryptedSecret: string,
  keyValue = env.adminTotpEncryptionKey,
): string {
  try {
    const [version, nonceValue, ciphertextValue, authTagValue, extra] = encryptedSecret.split('.');
    if (
      version !== `v${KEY_VERSION}` ||
      !nonceValue ||
      !ciphertextValue ||
      !authTagValue ||
      extra !== undefined
    ) {
      throw new AdminTotpEncryptionError();
    }

    const nonce = Buffer.from(nonceValue, 'base64url');
    const ciphertext = Buffer.from(ciphertextValue, 'base64url');
    const authTag = Buffer.from(authTagValue, 'base64url');
    if (
      nonce.length !== NONCE_BYTES ||
      ciphertext.length === 0 ||
      authTag.length !== AUTH_TAG_BYTES
    ) {
      throw new AdminTotpEncryptionError();
    }

    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(keyValue), nonce, {
      authTagLength: AUTH_TAG_BYTES,
    });
    decipher.setAAD(additionalAuthenticatedData(userId));
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (error) {
    if (error instanceof AdminTotpEncryptionError) {
      throw error;
    }
    throw new AdminTotpEncryptionError();
  }
}

export const ADMIN_TOTP_KEY_VERSION = KEY_VERSION;
