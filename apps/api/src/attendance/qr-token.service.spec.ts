import {
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { EnvelopeEncryptionService } from './encryption/envelope-encryption.service';
import { PhysicalPasscodeService } from './physical-passcode.service';
import { QrTokenService } from './qr-token.service';
import { RedisService } from '../common/redis/redis.service';

describe('Stage 2.7 Step 3: Cryptographic QR Token & Security Services', () => {
  const masterKey = 'test-attendance-master-key-at-least-32-chars-long!';
  let configService: ConfigService;
  let encryptionService: EnvelopeEncryptionService;
  let passcodeService: PhysicalPasscodeService;
  let redisService: jest.Mocked<RedisService>;
  let qrTokenService: QrTokenService;

  const orgId = '11111111-1111-4111-8111-111111111111';
  const otherOrgId = '99999999-9999-4999-8999-999999999999';
  const memberId = '22222222-2222-4222-8222-222222222222';
  const passId = '33333333-3333-4333-8333-333333333333';
  const rawSecret = crypto.randomBytes(32).toString('hex');

  beforeEach(() => {
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'attendance.secretMasterKey') return masterKey;
        return undefined;
      }),
    } as unknown as ConfigService;

    encryptionService = new EnvelopeEncryptionService(configService);

    // In-memory nonce store for RedisService mock
    const nonceStore = new Set<string>();
    const rateLimitStore = new Map<string, number>();

    redisService = {
      consumeNonce: jest.fn().mockImplementation(async (oid: string, nce: string) => {
        const key = `${oid}:${nce}`;
        if (nonceStore.has(key)) {
          return 'REPLAY_DETECTED';
        }
        nonceStore.add(key);
        return 'ACQUIRED';
      }),
      deleteNonce: jest.fn().mockImplementation(async (oid: string, nce: string) => {
        nonceStore.delete(`${oid}:${nce}`);
      }),
      incrementRateLimit: jest.fn().mockImplementation(async (key: string, _ttl: number) => {
        const count = (rateLimitStore.get(key) || 0) + 1;
        rateLimitStore.set(key, count);
        return count;
      }),
      resetRateLimit: jest.fn().mockImplementation(async (key: string) => {
        rateLimitStore.delete(key);
      }),
    } as unknown as jest.Mocked<RedisService>;

    passcodeService = new PhysicalPasscodeService(redisService);

    qrTokenService = new QrTokenService(
      redisService,
      encryptionService,
      passcodeService,
    );
  });

  describe('EnvelopeEncryptionService (AES-256-GCM)', () => {
    it('should encrypt and decrypt a plaintext secret successfully', () => {
      const plaintext = 'secret-hmac-key-value-123456';
      const envelope = encryptionService.encrypt(plaintext);

      expect(envelope.startsWith('enc:v1:')).toBe(true);
      const decrypted = encryptionService.decrypt(envelope);
      expect(decrypted).toBe(plaintext);
    });

    it('should generate a unique IV for every encryption call', () => {
      const plaintext = 'identical-secret';
      const envelope1 = encryptionService.encrypt(plaintext);
      const envelope2 = encryptionService.encrypt(plaintext);

      expect(envelope1).not.toBe(envelope2);

      const iv1 = envelope1.split(':')[2];
      const iv2 = envelope2.split(':')[2];
      expect(iv1).not.toBe(iv2);

      expect(encryptionService.decrypt(envelope1)).toBe(plaintext);
      expect(encryptionService.decrypt(envelope2)).toBe(plaintext);
    });

    it('should reject tampered ciphertext with an authentication error', () => {
      const envelope = encryptionService.encrypt('sensitive-data');
      const parts = envelope.split(':');
      // Tamper with the last character of the ciphertext
      const ciphertext = parts[4] || '';
      const lastChar = ciphertext.slice(-1);
      const flipped = lastChar === 'a' ? 'b' : 'a';
      parts[4] = ciphertext.slice(0, -1) + flipped;
      const tampered = parts.join(':');

      expect(() => encryptionService.decrypt(tampered)).toThrow(
        /DECRYPTION_AUTHENTICATION_FAILED/,
      );
    });

    it('should reject tampered authentication tag', () => {
      const envelope = encryptionService.encrypt('sensitive-data');
      const parts = envelope.split(':');
      // Tamper with the auth tag
      const authTag = parts[3] || '';
      const lastChar = authTag.slice(-1);
      const flipped = lastChar === '0' ? '1' : '0';
      parts[3] = authTag.slice(0, -1) + flipped;
      const tampered = parts.join(':');

      expect(() => encryptionService.decrypt(tampered)).toThrow(
        /DECRYPTION_AUTHENTICATION_FAILED/,
      );
    });

    it('should reject envelope encrypted with a different master key', () => {
      const envelope = encryptionService.encrypt('sensitive-data');

      const otherConfig = {
        get: jest.fn().mockReturnValue('different-master-key-at-least-32-chars!'),
      } as unknown as ConfigService;
      const otherEncryptionService = new EnvelopeEncryptionService(otherConfig);

      expect(() => otherEncryptionService.decrypt(envelope)).toThrow(
        /DECRYPTION_AUTHENTICATION_FAILED/,
      );
    });

    it('should fail closed if master key is missing or shorter than 32 characters', () => {
      const shortConfig = {
        get: jest.fn().mockReturnValue('too-short'),
      } as unknown as ConfigService;

      expect(() => new EnvelopeEncryptionService(shortConfig)).toThrow(
        /CRITICAL_SECURITY_ERROR/,
      );
    });
  });

  describe('PhysicalPasscodeService', () => {
    it('should strictly exclude 0, 1, I, L, O and have exactly 31 characters in alphabet', () => {
      const alphabet = passcodeService.getAlphabet();
      expect(alphabet).toHaveLength(31);
      expect(alphabet).toBe('23456789ABCDEFGHJKMNPQRSTUVWXYZ');

      // Specifically check that forbidden characters are absent
      const forbidden = ['0', '1', 'I', 'L', 'O', 'i', 'l', 'o'];
      for (const char of forbidden) {
        expect(alphabet.includes(char)).toBe(false);
      }
    });

    it('should generate a 16-character passcode using unambiguous alphabet', () => {
      const passcode = passcodeService.generatePasscode();
      // Format: XXXX-XXXX-XXXX-XXXX
      expect(passcode).toMatch(/^[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}-[2-9A-HJ-KM-NP-Z]{4}$/);
      expect(passcode).not.toMatch(/[01OILoil]/); // Never contains 0, 1, O, I, L
    });

    it('should verify matching passcode using Argon2id hash', async () => {
      const passcode = passcodeService.generatePasscode();
      const salt = passcodeService.generateSalt();
      const hash = await passcodeService.hashPasscode(passcode, salt, orgId);

      expect(hash.startsWith('$argon2id$')).toBe(true);
      expect(hash.length).toBeLessThanOrEqual(128);

      const isValid = await passcodeService.verifyPasscode(passcode, hash, salt, orgId);
      expect(isValid).toBe(true);

      const isInvalid = await passcodeService.verifyPasscode('WRONG-CODE-1234', hash, salt, orgId);
      expect(isInvalid).toBe(false);
    });

    it('should support legacy SHA-256 hashes for backward compatibility', async () => {
      const passcode = passcodeService.generatePasscode();
      const salt = passcodeService.generateSalt();
      const legacyHash = passcodeService.hashPasscodeSha256(passcode, salt, orgId);

      expect(legacyHash).toHaveLength(64); // 64 hex characters

      const isValid = await passcodeService.verifyPasscode(passcode, legacyHash, salt, orgId);
      expect(isValid).toBe(true);

      const isInvalid = await passcodeService.verifyPasscode('WRONG-CODE-1234', legacyHash, salt, orgId);
      expect(isInvalid).toBe(false);
    });

    it('should be tenant-bound: same passcode and salt in different org produces different verification', async () => {
      const passcode = passcodeService.generatePasscode();
      const salt = passcodeService.generateSalt();

      const hashOrgAlpha = await passcodeService.hashPasscode(passcode, salt, orgId);
      const hashOrgBeta = await passcodeService.hashPasscode(passcode, salt, otherOrgId);

      expect(hashOrgAlpha).not.toBe(hashOrgBeta);
      expect(await passcodeService.verifyPasscode(passcode, hashOrgAlpha, salt, otherOrgId)).toBe(false);
    });

    it('should correctly mask a physical passcode for UI display', () => {
      const masked = passcodeService.maskPasscode('A7K9-W3M2-X8P1-Q4V6');
      expect(masked).toBe('A7K9-****-****-Q4V6');
    });

    describe('Rate-Limit Security & Privacy', () => {
      const testCode = 'B2C3-D4E5-F6G7-H8J9';

      it('should compute HMAC-SHA256 derived identifier without exposing raw passcode', () => {
        const derivedId = passcodeService.getDerivedBadgeRateLimitId(orgId, testCode);
        expect(derivedId).toHaveLength(32); // 32 hex chars (128 bits)
        expect(/^[0-9a-f]{32}$/.test(derivedId)).toBe(true);

        // Crucial verification: raw code is NOT present in derived identifier
        expect(derivedId.includes(testCode)).toBe(false);
        expect(derivedId.includes('B2C3')).toBe(false);
      });

      it('should enforce badge-specific rate limiting on repeated failed attempts (max 5)', async () => {
        // Attempts 1 to 5 should succeed without error
        for (let i = 1; i <= 5; i++) {
          await expect(passcodeService.checkBadgeRateLimit(orgId, testCode)).resolves.not.toThrow();
        }

        // 6th attempt should throw 429 PASSCODE_RATE_LIMITED
        await expect(passcodeService.checkBadgeRateLimit(orgId, testCode)).rejects.toMatchObject({
          status: 429,
          response: expect.objectContaining({
            code: 'PASSCODE_RATE_LIMITED',
          }),
        });

        // Verify Redis was called with derived identifier and 900s TTL (never raw passcode)
        const calls = (redisService.incrementRateLimit as jest.Mock).mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall[0]).toMatch(/^passcode:badge:/);
        expect(lastCall[0].includes(testCode)).toBe(false);
        expect(lastCall[1]).toBe(900); // 15-minute lockout duration
      });

      it('should reset badge rate limit on successful verification reset', async () => {
        await passcodeService.resetBadgeRateLimit(orgId, testCode);

        expect(redisService.resetRateLimit).toHaveBeenCalledWith(
          expect.stringMatching(/^passcode:badge:/),
        );
        // Ensure reset key does not embed raw passcode
        const resetKey = (redisService.resetRateLimit as jest.Mock).mock.calls[0][0];
        expect(resetKey.includes(testCode)).toBe(false);

        // After reset, checking rate limit succeeds again
        await expect(passcodeService.checkBadgeRateLimit(orgId, testCode)).resolves.not.toThrow();
      });

      it('should isolate rate limiting across tenants (cross-tenant isolation)', async () => {
        const idAlpha = passcodeService.getDerivedBadgeRateLimitId(orgId, testCode);
        const idBeta = passcodeService.getDerivedBadgeRateLimitId(otherOrgId, testCode);

        // Same badge code across different orgs produces completely different derived IDs
        expect(idAlpha).not.toBe(idBeta);
      });

      it('should enforce terminal-level rate limiting (max 25 attempts)', async () => {
        const branchId = '44444444-4444-4444-4444-444444444444';

        for (let i = 1; i <= 25; i++) {
          await expect(passcodeService.checkTerminalRateLimit(orgId, branchId)).resolves.not.toThrow();
        }

        await expect(passcodeService.checkTerminalRateLimit(orgId, branchId)).rejects.toMatchObject({
          status: 429,
          response: expect.objectContaining({
            code: 'TERMINAL_RATE_LIMITED',
          }),
        });
      });
    });
  });

  describe('QrTokenService: Token Lifecycle & Cryptography', () => {
    it('should generate a valid dynamic QR token with 90s TTL and GYMOS:V1 prefix', () => {
      const result = qrTokenService.generateDynamicToken(
        memberId,
        orgId,
        passId,
        rawSecret,
      );

      expect(result.token.startsWith('GYMOS:V1:')).toBe(true);
      expect(result.refreshIntervalSeconds).toBe(45);

      const payload = qrTokenService.parseAndVerifyDynamicToken(
        result.token,
        rawSecret,
        orgId,
      );

      expect(payload.sub).toBe(memberId);
      expect(payload.org).toBe(orgId);
      expect(payload.pid).toBe(passId);
      expect(payload.exp - payload.iat).toBe(90);
      expect(payload.nce).toHaveLength(24); // 12 bytes = 24 hex chars
    });

    it('should reject token if signature does not match (wrong secret)', () => {
      const result = qrTokenService.generateDynamicToken(
        memberId,
        orgId,
        passId,
        rawSecret,
      );

      const wrongSecret = crypto.randomBytes(32).toString('hex');
      expect(() =>
        qrTokenService.parseAndVerifyDynamicToken(result.token, wrongSecret, orgId),
      ).toThrow(UnauthorizedException);
    });

    it('should reject tampered payload or signature', () => {
      const result = qrTokenService.generateDynamicToken(
        memberId,
        orgId,
        passId,
        rawSecret,
      );

      const parts = result.token.split('.');
      const now = Math.floor(Date.now() / 1000);
      // Tamper with memberId in payload
      const tamperedPayload = Buffer.from(
        JSON.stringify({
          sub: 'attacker-member-id',
          org: orgId,
          pid: passId,
          iat: now,
          exp: now + 90,
          nce: crypto.randomBytes(12).toString('hex'),
        }),
      ).toString('base64url');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      expect(() =>
        qrTokenService.parseAndVerifyDynamicToken(tamperedToken, rawSecret, orgId),
      ).toThrow(UnauthorizedException);
    });

    it('should reject malformed payload with missing claims', () => {
      const result = qrTokenService.generateDynamicToken(
        memberId,
        orgId,
        passId,
        rawSecret,
      );

      const parts = result.token.split('.');
      // Malformed payload missing pid, iat, exp, nce
      const malformedPayload = Buffer.from(
        JSON.stringify({ sub: 'attacker-id', org: orgId }),
      ).toString('base64url');
      const malformedToken = `${parts[0]}.${malformedPayload}.${parts[2]}`;

      expect(() =>
        qrTokenService.parseAndVerifyDynamicToken(malformedToken, rawSecret, orgId),
      ).toThrow(BadRequestException);
    });

    it('should reject expired dynamic tokens', () => {
      // Craft a token that expired 10 seconds ago
      const now = Math.floor(Date.now() / 1000);
      const expiredPayload = {
        sub: memberId,
        org: orgId,
        pid: passId,
        iat: now - 100,
        exp: now - 10,
        nce: crypto.randomBytes(12).toString('hex'),
      };
      const header = { alg: 'HS256', typ: 'GYMOS-DYN-V1' };
      const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
      const payloadB64 = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
      const sig = crypto
        .createHmac('sha256', rawSecret)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');
      const token = `GYMOS:V1:${headerB64}.${payloadB64}.${sig}`;

      expect(() =>
        qrTokenService.parseAndVerifyDynamicToken(token, rawSecret, orgId),
      ).toThrow(UnauthorizedException);
    });

    it('should reject tokens issued in the future beyond allowed skew', () => {
      const now = Math.floor(Date.now() / 1000);
      const futurePayload = {
        sub: memberId,
        org: orgId,
        pid: passId,
        iat: now + 60, // 60s in the future (skew tolerance is 5s)
        exp: now + 150,
        nce: crypto.randomBytes(12).toString('hex'),
      };
      const header = { alg: 'HS256', typ: 'GYMOS-DYN-V1' };
      const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
      const payloadB64 = Buffer.from(JSON.stringify(futurePayload)).toString('base64url');
      const sig = crypto
        .createHmac('sha256', rawSecret)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');
      const token = `GYMOS:V1:${headerB64}.${payloadB64}.${sig}`;

      expect(() =>
        qrTokenService.parseAndVerifyDynamicToken(token, rawSecret, orgId),
      ).toThrow(UnauthorizedException);
    });

    it('should reject token presented to a different organization', () => {
      const result = qrTokenService.generateDynamicToken(
        memberId,
        orgId,
        passId,
        rawSecret,
      );

      expect(() =>
        qrTokenService.parseAndVerifyDynamicToken(result.token, rawSecret, otherOrgId),
      ).toThrow(UnauthorizedException);
    });

    it('should reject algorithm substitution attacks (e.g. alg: none)', () => {
      const now = Math.floor(Date.now() / 1000);
      const fakeHeader = { alg: 'none', typ: 'GYMOS-DYN-V1' };
      const fakePayload = {
        sub: memberId,
        org: orgId,
        pid: passId,
        iat: now,
        exp: now + 90,
        nce: '123456789012',
      };
      const headerB64 = Buffer.from(JSON.stringify(fakeHeader)).toString('base64url');
      const payloadB64 = Buffer.from(JSON.stringify(fakePayload)).toString('base64url');
      const token = `GYMOS:V1:${headerB64}.${payloadB64}.fakesig`;

      expect(() =>
        qrTokenService.parseAndVerifyDynamicToken(token, rawSecret, orgId),
      ).toThrow(UnauthorizedException);
    });

    it('should reject tokens missing the GYMOS:V1 prefix', () => {
      expect(() =>
        qrTokenService.parseAndVerifyDynamicToken('header.payload.signature', rawSecret),
      ).toThrow(BadRequestException);
    });
  });

  describe('QrTokenService: Atomic Nonce Replay Prevention', () => {
    it('should consume nonce on first presentation and reject replay on second presentation', async () => {
      const nonce = crypto.randomBytes(12).toString('hex');

      // First presentation: succeeds
      await expect(qrTokenService.verifyAndConsumeNonce(orgId, nonce)).resolves.not.toThrow();

      // Second presentation: fails with ConflictException
      await expect(qrTokenService.verifyAndConsumeNonce(orgId, nonce)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should fail closed when Redis connection is down or throws an error', async () => {
      redisService.consumeNonce.mockRejectedValueOnce(
        new Error('ECONNREFUSED: Connection to Redis failed'),
      );

      const nonce = crypto.randomBytes(12).toString('hex');

      // Must fail closed with ServiceUnavailableException
      await expect(qrTokenService.verifyAndConsumeNonce(orgId, nonce)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('QrTokenService: Pass Credentials & Secret Rotation', () => {
    it('should generate encrypted pass credentials with optional physical badge', async () => {
      const creds = await qrTokenService.generatePassCredentials(orgId, true);

      expect(creds.hmacSecretEncrypted.startsWith('enc:v1:')).toBe(true);
      expect(creds.passCodeHash).toBeDefined();
      expect(creds.passCodeSalt).toBeDefined();
      expect(creds.passCodeMasked).toMatch(/^[2-9A-HJ-KM-NP-Z]{4}-\*\*\*\*-\*\*\*\*-[2-9A-HJ-KM-NP-Z]{4}$/);
      expect(creds.rawPhysicalPasscode).toBeDefined();

      const decrypted = qrTokenService.decryptSigningSecret(creds.hmacSecretEncrypted);
      expect(decrypted).toHaveLength(64); // 32 bytes hex = 64 chars
    });

    it('should invalidate existing tokens when secret is rotated', () => {
      const oldSecret = crypto.randomBytes(32).toString('hex');
      const result = qrTokenService.generateDynamicToken(
        memberId,
        orgId,
        passId,
        oldSecret,
      );

      // Verify token with old secret passes
      expect(() =>
        qrTokenService.parseAndVerifyDynamicToken(result.token, oldSecret, orgId),
      ).not.toThrow();

      // Rotate secret
      const newEncryptedSecret = qrTokenService.rotateSigningSecret();
      const newSecret = qrTokenService.decryptSigningSecret(newEncryptedSecret);

      // Verify old token fails with rotated new secret
      expect(() =>
        qrTokenService.parseAndVerifyDynamicToken(result.token, newSecret, orgId),
      ).toThrow(UnauthorizedException);
    });
  });
});
