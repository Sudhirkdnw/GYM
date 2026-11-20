import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { RedisService } from '../common/redis/redis.service';
import { EnvelopeEncryptionService } from './encryption/envelope-encryption.service';
import { PhysicalPasscodeService } from './physical-passcode.service';

export interface QrTokenHeader {
  alg: 'HS256';
  typ: 'GYMOS-DYN-V1';
}

export interface QrTokenPayload {
  sub: string; // memberId (UUID)
  org: string; // organizationId (UUID)
  pid: string; // passId (UUID)
  iat: number; // Issued at (Unix epoch seconds)
  exp: number; // Expires at (Unix epoch seconds)
  nce: string; // Cryptographic nonce (24 hex characters / 12 bytes)
}

export interface DynamicTokenResult {
  token: string;
  expiresAt: string;
  refreshIntervalSeconds: number;
}

export interface GeneratedPassCredentials {
  hmacSecretEncrypted: string;
  passCodeHash?: string;
  passCodeSalt?: string;
  passCodeMasked?: string;
  rawPhysicalPasscode?: string;
}

@Injectable()
export class QrTokenService {
  private readonly logger = new Logger(QrTokenService.name);
  private readonly tokenPrefix = 'GYMOS:V1:';
  private readonly tokenTtlSeconds = 90;
  private readonly refreshIntervalSeconds = 45;
  private readonly clockSkewToleranceSeconds = 5;
  private readonly rawSecretBytes = 32;

  constructor(
    private readonly redisService: RedisService,
    private readonly envelopeEncryptionService: EnvelopeEncryptionService,
    private readonly physicalPasscodeService: PhysicalPasscodeService,
  ) {}

  /**
   * Generates new cryptographic credentials for a member access pass.
   */
  async generatePassCredentials(
    organizationId: string,
    generatePhysicalBadge = false,
  ): Promise<GeneratedPassCredentials> {
    // 1. Generate 32-byte CSPRNG secret for dynamic HMAC signing
    const rawHmacSecret = crypto.randomBytes(this.rawSecretBytes).toString('hex');
    const hmacSecretEncrypted = this.envelopeEncryptionService.encrypt(rawHmacSecret);

    const credentials: GeneratedPassCredentials = {
      hmacSecretEncrypted,
    };

    // 2. Generate persistent physical badge passcode if requested
    if (generatePhysicalBadge) {
      const rawPhysicalPasscode = this.physicalPasscodeService.generatePasscode();
      const passCodeSalt = this.physicalPasscodeService.generateSalt();
      const passCodeHash = await this.physicalPasscodeService.hashPasscode(
        rawPhysicalPasscode,
        passCodeSalt,
        organizationId,
      );
      const passCodeMasked = this.physicalPasscodeService.maskPasscode(rawPhysicalPasscode);

      credentials.passCodeHash = passCodeHash;
      credentials.passCodeSalt = passCodeSalt;
      credentials.passCodeMasked = passCodeMasked;
      credentials.rawPhysicalPasscode = rawPhysicalPasscode;
    }

    return credentials;
  }

  /**
   * Rotates the dynamic HMAC signing secret for a pass.
   * Immediately invalidates all outstanding dynamic tokens.
   */
  rotateSigningSecret(): string {
    const rawSecret = crypto.randomBytes(this.rawSecretBytes).toString('hex');
    return this.envelopeEncryptionService.encrypt(rawSecret);
  }

  /**
   * Decrypts the stored HMAC signing secret for a member pass.
   */
  decryptSigningSecret(encryptedSecret: string): string {
    return this.envelopeEncryptionService.decrypt(encryptedSecret);
  }

  /**
   * Generates a dynamic rolling signed QR token for member mobile web passes.
   * Format: GYMOS:V1:<header_b64url>.<payload_b64url>.<signature_b64url>
   *
   * @param memberId - Member UUID
   * @param organizationId - Organization UUID
   * @param passId - MemberAccessPass UUID
   * @param decryptedHmacSecret - Raw decrypted HMAC key
   * @returns Dynamic token string and expiry metadata
   */
  generateDynamicToken(
    memberId: string,
    organizationId: string,
    passId: string,
    decryptedHmacSecret: string,
  ): DynamicTokenResult {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.tokenTtlSeconds;
    const nonce = crypto.randomBytes(12).toString('hex');

    const header: QrTokenHeader = {
      alg: 'HS256',
      typ: 'GYMOS-DYN-V1',
    };

    const payload: QrTokenPayload = {
      sub: memberId,
      org: organizationId,
      pid: passId,
      iat: now,
      exp,
      nce: nonce,
    };

    const headerB64 = Buffer.from(JSON.stringify(header), 'utf8').toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const message = `${headerB64}.${payloadB64}`;

    const signature = crypto
      .createHmac('sha256', decryptedHmacSecret)
      .update(message)
      .digest('base64url');

    const token = `${this.tokenPrefix}${message}.${signature}`;
    const expiresAt = new Date(exp * 1000).toISOString();

    return {
      token,
      expiresAt,
      refreshIntervalSeconds: this.refreshIntervalSeconds,
    };
  }

  /**
   * Decodes an unverified dynamic token payload to identify the associated pass.
   * Does NOT verify the cryptographic signature. Signature verification MUST be performed
   * via parseAndVerifyDynamicToken once the pass secret has been resolved.
   */
  decodeTokenPayloadUnverified(token: string): QrTokenPayload {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('INVALID_TOKEN: Token must be a non-empty string');
    }

    if (!token.startsWith(this.tokenPrefix)) {
      throw new BadRequestException('INVALID_TOKEN_FORMAT: Missing GYMOS:V1 prefix');
    }

    const tokenBody = token.slice(this.tokenPrefix.length);
    const parts = tokenBody.split('.');

    if (parts.length !== 3) {
      throw new BadRequestException('INVALID_TOKEN_FORMAT: Expected 3 compact segments');
    }

    const payloadB64 = parts[1];
    if (!payloadB64) {
      throw new BadRequestException('INVALID_TOKEN_FORMAT: Malformed compact segments');
    }

    try {
      const payload: QrTokenPayload = JSON.parse(
        Buffer.from(payloadB64, 'base64url').toString('utf8'),
      );

      if (
        !payload.sub ||
        !payload.org ||
        !payload.pid ||
        !payload.iat ||
        !payload.exp ||
        !payload.nce
      ) {
        throw new BadRequestException('MALFORMED_TOKEN_PAYLOAD: Missing mandatory claims');
      }

      return payload;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('CORRUPTED_TOKEN_PAYLOAD: Unable to decode payload');
    }
  }

  /**
   * Parses and cryptographically verifies an incoming dynamic QR token.
   * Enforces algorithm, timing-safe HMAC signature, expiry, future skew, and organization binding.
   *
   * @param token - Incoming token string
   * @param decryptedHmacSecret - Raw decrypted HMAC key for pass
   * @param expectedOrgId - Optional organization UUID to enforce tenant binding
   * @returns Verified token payload
   */
  parseAndVerifyDynamicToken(
    token: string,
    decryptedHmacSecret: string,
    expectedOrgId?: string,
  ): QrTokenPayload {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('INVALID_TOKEN: Token must be a non-empty string');
    }

    if (!token.startsWith(this.tokenPrefix)) {
      throw new BadRequestException('INVALID_TOKEN_FORMAT: Missing GYMOS:V1 prefix');
    }

    const tokenBody = token.slice(this.tokenPrefix.length);
    const parts = tokenBody.split('.');

    if (parts.length !== 3) {
      throw new BadRequestException('INVALID_TOKEN_FORMAT: Expected 3 compact segments');
    }

    const headerB64 = parts[0];
    const payloadB64 = parts[1];
    const signatureB64 = parts[2];

    if (!headerB64 || !payloadB64 || !signatureB64) {
      throw new BadRequestException('INVALID_TOKEN_FORMAT: Malformed compact segments');
    }

    // 1. Decode & Validate Header
    let header: QrTokenHeader;
    try {
      header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('CORRUPTED_TOKEN_HEADER: Unable to decode header');
    }

    if (header.alg !== 'HS256' || header.typ !== 'GYMOS-DYN-V1') {
      throw new UnauthorizedException('UNSUPPORTED_TOKEN_ALGORITHM: Enforced HS256 / GYMOS-DYN-V1');
    }

    // 2. Decode & Validate Payload Structure
    let payload: QrTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('CORRUPTED_TOKEN_PAYLOAD: Unable to decode payload');
    }

    if (!payload.sub || !payload.org || !payload.pid || !payload.iat || !payload.exp || !payload.nce) {
      throw new BadRequestException('MALFORMED_TOKEN_PAYLOAD: Missing mandatory claims');
    }

    // 3. Organization Binding Check
    if (expectedOrgId && payload.org !== expectedOrgId) {
      throw new UnauthorizedException('ORGANIZATION_MISMATCH: Pass does not belong to this organization');
    }

    // 4. Validate Expiry & Clock Skew
    const now = Math.floor(Date.now() / 1000);

    if (payload.iat > now + this.clockSkewToleranceSeconds) {
      throw new UnauthorizedException('TOKEN_FUTURE_ISSUED: Token issued in the future');
    }

    if (now > payload.exp + this.clockSkewToleranceSeconds) {
      throw new UnauthorizedException('TOKEN_EXPIRED: Dynamic QR token has expired');
    }

    // 5. Verify HMAC-SHA256 Signature using Timing-Safe Comparison
    const message = `${headerB64}.${payloadB64}`;
    const expectedSignatureB64 = crypto
      .createHmac('sha256', decryptedHmacSecret)
      .update(message)
      .digest('base64url');

    const bufSignature = Buffer.from(signatureB64, 'utf8');
    const bufExpected = Buffer.from(expectedSignatureB64, 'utf8');

    if (bufSignature.length !== bufExpected.length || !crypto.timingSafeEqual(bufSignature, bufExpected)) {
      throw new UnauthorizedException('INVALID_SIGNATURE: Token HMAC-SHA256 signature mismatch');
    }

    return payload;
  }

  /**
   * Atomically verifies and consumes the nonce in Redis to prevent replay attacks.
   * Fail-Closed: If Redis is unavailable, check-in MUST be rejected to preserve security.
   *
   * @param organizationId - Organization UUID
   * @param nonce - Token cryptographic nonce
   */
  async verifyAndConsumeNonce(organizationId: string, nonce: string): Promise<void> {
    try {
      const consumptionResult = await this.redisService.consumeNonce(
        organizationId,
        nonce,
        this.tokenTtlSeconds * 2, // 180s = 2x token life
      );

      if (consumptionResult === 'REPLAY_DETECTED') {
        throw new ConflictException(
          'TOKEN_REPLAY_DETECTED: Dynamic QR token has already been presented',
        );
      }
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`Replay prevention Redis failure: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'REDIS_REPLAY_CHECK_UNAVAILABLE: Replay verification service is temporarily unavailable',
      );
    }
  }
}
