import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret, maskToken } from '../src/modules/security/crypto.js';
import { sanitizeText } from '../src/modules/logging/logger.js';

describe('Security & Crypto Module', () => {
  it('should encrypt and decrypt secrets correctly with AES-256-GCM', () => {
    const originalToken = 'github_pat_11AB34567890abcdefghijklmnopqrstuvwxyz123456';
    const encrypted = encryptSecret(originalToken);

    expect(encrypted).not.toBe(originalToken);
    expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:ciphertext

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(originalToken);
  });

  it('should fail decryption if payload is corrupted', () => {
    expect(() => decryptSecret('invalid:payload')).toThrow();
  });

  it('should mask tokens correctly without leaking full secret', () => {
    const token = 'ghp_1234567890abcdefghijklmnopqrstuv';
    const masked = maskToken(token);
    expect(masked).toBe('ghp_...stuv');
    expect(masked).not.toContain('1234567890');
  });

  it('should sanitize sensitive tokens from text strings', () => {
    const rawLog = 'Connecting with token ghp_1234567890abcdefghijklmnopqrstuv to GitHub API';
    const cleanLog = sanitizeText(rawLog);

    expect(cleanLog).not.toContain('1234567890abcdefghijklmnopqrstuv');
    expect(cleanLog).toContain('[REDACTED]');
  });
});
