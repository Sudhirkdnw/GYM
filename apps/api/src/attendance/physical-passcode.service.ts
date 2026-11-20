import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class PhysicalPasscodeService {
  // Unambiguous 32-character alphabet (excludes confusing characters: 0, O, 1, I)
  private readonly alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  private readonly passcodeLength = 16;
  private readonly saltBytes = 16;

  /**
   * Generates a high-entropy 16-character alphanumeric physical badge passcode.
   * Format: A7K9-W3M2-X8P1-Q4V6 (80 bits of cryptographic entropy)
   */
  generatePasscode(): string {
    const randomBytes = crypto.randomBytes(this.passcodeLength);
    let code = '';
    for (let i = 0; i < this.passcodeLength; i++) {
      const byte = randomBytes[i] ?? 0;
      code += this.alphabet[byte % this.alphabet.length];
    }
    return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`;
  }

  /**
   * Generates a cryptographically random salt for one-way passcode hashing.
   */
  generateSalt(): string {
    return crypto.randomBytes(this.saltBytes).toString('hex');
  }

  /**
   * Cleans a raw passcode string by removing hyphens and converting to uppercase.
   */
  normalizePasscode(passcode: string): string {
    return passcode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }

  /**
   * Computes a tenant-scoped SHA-256 hash of the physical passcode.
   * Plaintext passcodes are NEVER persisted.
   */
  hashPasscode(passcode: string, salt: string, organizationId: string): string {
    const normalized = this.normalizePasscode(passcode);
    return crypto
      .createHash('sha256')
      .update(`${organizationId}:${salt}:${normalized}`)
      .digest('hex');
  }

  /**
   * Constant-time verification of candidate passcode against stored salted hash.
   */
  verifyPasscode(
    candidatePasscode: string,
    storedHash: string,
    salt: string,
    organizationId: string,
  ): boolean {
    if (!candidatePasscode || !storedHash || !salt || !organizationId) {
      return false;
    }

    const candidateHash = this.hashPasscode(candidatePasscode, salt, organizationId);

    const bufCandidate = Buffer.from(candidateHash, 'hex');
    const bufStored = Buffer.from(storedHash, 'hex');

    if (bufCandidate.length !== bufStored.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufCandidate, bufStored);
  }

  /**
   * Masks a physical badge passcode for safe UI display and staff receipt.
   * e.g. "A7K9-W3M2-X8P1-Q4V6" -> "A7K9-****-****-Q4V6"
   */
  maskPasscode(passcode: string): string {
    const normalized = this.normalizePasscode(passcode);
    if (normalized.length !== 16) {
      return '****-****-****-****';
    }
    const prefix = normalized.slice(0, 4);
    const suffix = normalized.slice(12, 16);
    return `${prefix}-****-****-${suffix}`;
  }
}
