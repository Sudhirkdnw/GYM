import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AUTH_CONFIG } from '@gymos/config';
import { AppLoggerService } from '../logging/app-logger.service';

@Injectable()
export class PasswordHasherService {
  constructor(private readonly logger: AppLoggerService) {}

  /**
   * Hashes a password using Argon2id with production security parameters.
   */
  async hashPassword(password: string): Promise<string> {
    try {
      return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: AUTH_CONFIG.ARGON2_OPTIONS.memoryCost,
        timeCost: AUTH_CONFIG.ARGON2_OPTIONS.timeCost,
        parallelism: AUTH_CONFIG.ARGON2_OPTIONS.parallelism,
      });
    } catch (error) {
      this.logger.error(
        'Failed to hash password with Argon2id',
        error instanceof Error ? error.stack : undefined,
        'PasswordHasherService',
      );
      throw new Error('Cryptographic hashing error');
    }
  }

  /**
   * Verifies a plain password against an Argon2id hash.
   */
  async verifyPassword(hash: string, plainText: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plainText);
    } catch (error) {
      this.logger.warn(
        'Argon2 verification failed with internal error',
        'PasswordHasherService',
      );
      return false;
    }
  }
}
