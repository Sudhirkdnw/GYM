import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EnvelopeEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12; // 96 bits recommended for GCM
  private readonly tagLength = 16; // 128 bits authentication tag
  private readonly masterKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const rawKey =
      this.configService.get<string>('attendance.secretMasterKey') ||
      process.env.ATTENDANCE_SECRET_MASTER_KEY;

    if (!rawKey || typeof rawKey !== 'string' || rawKey.length < 32) {
      throw new Error(
        'CRITICAL_SECURITY_ERROR: ATTENDANCE_SECRET_MASTER_KEY must be configured with at least 32 characters.',
      );
    }

    // Derive a uniform 256-bit (32 bytes) master key using SHA-256
    this.masterKey = crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypts plaintext signing secret using AES-256-GCM envelope encryption.
   * Format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
   *
   * @param plaintext - The secret string to encrypt
   * @returns Versioned ciphertext envelope
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      throw new Error('ENCRYPTION_ERROR: Plaintext cannot be empty');
    }

    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    const ivHex = iv.toString('hex');
    const tagHex = authTag.toString('hex');
    const ciphertextHex = encrypted.toString('hex');

    return `enc:v1:${ivHex}:${tagHex}:${ciphertextHex}`;
  }

  /**
   * Decrypts an AES-256-GCM versioned envelope and verifies the authentication tag.
   *
   * @param envelope - Versioned ciphertext string (enc:v1:...)
   * @returns Decrypted plaintext string
   * @throws Error if envelope is malformed, auth tag fails, or data was tampered
   */
  decrypt(envelope: string): string {
    if (!envelope || typeof envelope !== 'string') {
      throw new Error('DECRYPTION_ERROR: Invalid envelope input');
    }

    const parts = envelope.split(':');
    if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
      throw new Error(
        'DECRYPTION_ERROR: Unsupported or corrupted encryption envelope format',
      );
    }

    const ivHex = parts[2];
    const tagHex = parts[3];
    const ciphertextHex = parts[4];

    if (
      !ivHex ||
      !tagHex ||
      !ciphertextHex ||
      ivHex.length !== this.ivLength * 2 ||
      tagHex.length !== this.tagLength * 2
    ) {
      throw new Error(
        'DECRYPTION_ERROR: Invalid IV or AuthTag length in envelope',
      );
    }

    try {
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(tagHex, 'hex');
      const ciphertext = Buffer.from(ciphertextHex, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch {
      throw new Error(
        'DECRYPTION_AUTHENTICATION_FAILED: Secret ciphertext is corrupted, tampered, or key mismatch',
      );
    }
  }
}

