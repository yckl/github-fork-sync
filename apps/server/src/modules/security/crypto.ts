import crypto from 'crypto';
import fs from 'fs';
import { config } from '../../config.js';

let cachedMasterKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (cachedMasterKey) {
    return cachedMasterKey;
  }

  if (fs.existsSync(config.masterKeyPath)) {
    try {
      const keyHex = fs.readFileSync(config.masterKeyPath, 'utf8').trim();
      if (keyHex.length === 64) {
        cachedMasterKey = Buffer.from(keyHex, 'hex');
        return cachedMasterKey;
      }
    } catch {
      // Fallback to regenerate
    }
  }

  // Generate a cryptographically secure 256-bit key
  const newKey = crypto.randomBytes(32);
  try {
    fs.writeFileSync(config.masterKeyPath, newKey.toString('hex'), { mode: 0o600 });
  } catch (err) {
    // on Windows fs write with mode might not enforce posix permissions, which is fine
  }
  cachedMasterKey = newKey;
  return cachedMasterKey;
}

export function encryptSecret(plainText: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptSecret(encryptedPayload: string): string {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('无效的加密格式');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function maskToken(token: string): string {
  if (!token || token.length < 8) {
    return '***';
  }
  const prefix = token.slice(0, 4);
  const suffix = token.slice(-4);
  return `${prefix}...${suffix}`;
}
