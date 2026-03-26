import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const hex = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'YOUTUBE_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).',
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'YOUTUBE_TOKEN_ENCRYPTION_KEY must contain only hexadecimal characters (0-9, a-f).',
    );
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error(
      'YOUTUBE_TOKEN_ENCRYPTION_KEY must decode to 32 bytes. Check that it is a valid 64-character hex string.',
    );
  }
  return key;
}

export interface EncryptedToken {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptToken(plaintext: string): EncryptedToken {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');

  return {
    ciphertext: encrypted,
    iv: iv.toString('base64'),
    authTag,
  };
}

export function decryptToken(encrypted: EncryptedToken): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encrypted.iv, 'base64');
  const authTag = Buffer.from(encrypted.authTag, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted.ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
