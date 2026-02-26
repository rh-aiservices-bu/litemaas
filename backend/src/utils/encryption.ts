import crypto from 'crypto';

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ALGORITHM = 'aes-256-gcm';

/**
 * Derive a 256-bit AES key from an encryption key string using SHA-256.
 */
function deriveKey(encryptionKey: string): Buffer {
  return crypto.createHash('sha256').update(encryptionKey).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64-encoded string containing: IV (12 bytes) + ciphertext + auth tag (16 bytes).
 */
export function encryptApiKey(plaintext: string, encryptionKey: string): string {
  const key = deriveKey(encryptionKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

/**
 * Decrypt a base64-encoded AES-256-GCM ciphertext.
 * Expects format: IV (12 bytes) + ciphertext + auth tag (16 bytes).
 */
export function decryptApiKey(ciphertext: string, encryptionKey: string): string {
  const key = deriveKey(encryptionKey);
  const data = Buffer.from(ciphertext, 'base64');

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH, data.length - AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted) + decipher.final('utf8');
}
