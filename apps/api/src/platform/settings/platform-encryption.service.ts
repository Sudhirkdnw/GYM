import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class PlatformEncryptionService {
  private readonly logger = new Logger(PlatformEncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12; // 96-bit IV recommended for AES-GCM
  private readonly masterKey: Buffer;

  constructor() {
    const rawKey =
      process.env.PLATFORM_SECRET_MASTER_KEY ||
      process.env.ATTENDANCE_SECRET_MASTER_KEY ||
      'gymos-platform-enterprise-settings-master-key-32-bytes-secure!';

    // Derive deterministic 256-bit (32-byte) key using SHA-256
    this.masterKey = crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypts plaintext using AES-256-GCM authenticated envelope format.
   * Format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      return '';
    }

    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);

      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);

      const authTag = cipher.getAuthTag();

      return `enc:v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
    } catch (err) {
      this.logger.error('Failed to encrypt secret with AES-256-GCM', err);
      throw new Error('Cryptographic encryption failed');
    }
  }

  /**
   * Decrypts ciphertext from AES-256-GCM authenticated envelope.
   */
  decrypt(envelope: string): string {
    if (!envelope || !envelope.startsWith('enc:v1:')) {
      return envelope || '';
    }

    try {
      const parts = envelope.split(':');
      if (parts.length !== 5 || !parts[2] || !parts[3] || !parts[4]) {
        throw new Error('Invalid encryption envelope format');
      }

      const iv = Buffer.from(parts[2], 'hex');
      const authTag = Buffer.from(parts[3], 'hex');
      const ciphertext = Buffer.from(parts[4], 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (err) {
      this.logger.error('Failed to decrypt secret envelope with AES-256-GCM', err);
      throw new Error('Cryptographic decryption failed');
    }
  }

  /**
   * Helper to mask secrets for API responses.
   * e.g., "mySecretPassword123" -> "••••••••"
   */
  mask(secret?: string | null): string {
    if (!secret) return '';
    return '••••••••';
  }
}
