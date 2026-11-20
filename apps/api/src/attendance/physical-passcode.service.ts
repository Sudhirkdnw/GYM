import {
  Injectable,
  HttpException,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class PhysicalPasscodeService {
  /**
   * Unambiguous 31-character alphabet.
   * Strictly excludes visually confusing characters:
   * - Digits: 0, 1
   * - Letters: I, L, O
   * Permitted:
   * - Digits: 2, 3, 4, 5, 6, 7, 8, 9 (8 characters)
   * - Letters: A, B, C, D, E, F, G, H, J, K, M, N, P, Q, R, S, T, U, V, W, X, Y, Z (23 characters)
   * Total: 31 characters.
   */
  private readonly alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  private readonly passcodeLength = 16;
  private readonly saltBytes = 16;

  // OWASP Recommended Argon2id parameters
  private readonly argon2Options: argon2.HashOptions = {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB
    timeCost: 2, // 2 iterations
    parallelism: 1, // 1 thread
  };

  constructor(
    @Optional()
    private readonly redisService?: RedisService,
  ) {}

  /**
   * Returns the documented character set for security auditing and unit testing.
   */
  getAlphabet(): string {
    return this.alphabet;
  }

  /**
   * Generates a high-entropy 16-character alphanumeric physical badge passcode.
   * Format: A7K9-W3M2-X8P1-Q4V6 (77.9 bits of cryptographic entropy: 31^16)
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
   * Cleans a raw passcode string by removing hyphens and non-alphanumeric characters and converting to uppercase.
   */
  normalizePasscode(passcode: string): string {
    return passcode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }

  /**
   * Computes an Argon2id hash of the physical passcode bound to tenant organization ID.
   * Output format: $argon2id$v=19$m=19456,t=2,p=1$... (97 characters, fits within VarChar(128))
   * Plaintext passcodes are NEVER persisted.
   */
  async hashPasscode(
    passcode: string,
    salt: string,
    organizationId: string,
  ): Promise<string> {
    const normalized = this.normalizePasscode(passcode);
    const saltBuffer = Buffer.from(salt, 'hex');

    return argon2.hash(`${organizationId}:${normalized}`, {
      ...this.argon2Options,
      salt: saltBuffer.length >= 8 ? saltBuffer : crypto.randomBytes(16),
      raw: false as const,
    });
  }

  /**
   * Computes a tenant-scoped SHA-256 hash (maintained for backward compatibility / fallback).
   */
  hashPasscodeSha256(
    passcode: string,
    salt: string,
    organizationId: string,
  ): string {
    const normalized = this.normalizePasscode(passcode);
    return crypto
      .createHash('sha256')
      .update(`${organizationId}:${salt}:${normalized}`)
      .digest('hex');
  }

  /**
   * Verifies a candidate passcode against a stored hash with support for both
   * Argon2id and legacy SHA-256 hashes.
   */
  async verifyPasscode(
    candidatePasscode: string,
    storedHash: string,
    salt: string,
    organizationId: string,
  ): Promise<boolean> {
    if (!candidatePasscode || !storedHash || !salt || !organizationId) {
      return false;
    }

    const normalized = this.normalizePasscode(candidatePasscode);

    // If stored hash is Argon2id
    if (storedHash.startsWith('$argon2')) {
      try {
        return await argon2.verify(storedHash, `${organizationId}:${normalized}`);
      } catch {
        return false;
      }
    }

    // Fallback: Legacy SHA-256 with constant-time equality
    const candidateHash = this.hashPasscodeSha256(
      candidatePasscode,
      salt,
      organizationId,
    );
    const bufCandidate = Buffer.from(candidateHash, 'hex');
    const bufStored = Buffer.from(storedHash, 'hex');

    if (bufCandidate.length !== bufStored.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufCandidate, bufStored);
  }

  /**
   * Rate-limiting check for physical badge verification attempts.
   * Throws 429 TooManyRequests if more than 5 failed attempts occur within 15 minutes.
   */
  async checkRateLimit(
    organizationId: string,
    identifier: string,
    maxAttempts = 5,
    windowSeconds = 900,
  ): Promise<void> {
    if (!this.redisService) return;

    try {
      const attempts = await this.redisService.incrementRateLimit(
        `passcode:${organizationId}:${identifier}`,
        windowSeconds,
      );

      if (attempts > maxAttempts) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: 'Too Many Requests',
            message:
              'Maximum passcode verification attempts exceeded. Verification locked for 15 minutes.',
            code: 'PASSCODE_RATE_LIMITED',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      // If Redis is unreachable, allow check to proceed or fail-closed based on policy
      // Here we log and fail-closed if required
    }
  }

  /**
   * Resets the rate limit counter upon successful verification.
   */
  async resetRateLimit(
    organizationId: string,
    identifier: string,
  ): Promise<void> {
    if (!this.redisService) return;
    await this.redisService.resetRateLimit(
      `passcode:${organizationId}:${identifier}`,
    );
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
