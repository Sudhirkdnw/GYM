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
    passcodeService = new PhysicalPasscodeService();

    // In-memory nonce store for RedisService mock
    const nonceStore = new Set<string>();

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
    } as unknown as jest.Mocked<RedisService>;

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
    it('should generate a 16-character passcode using unambiguous alphabet', () => {
      const passcode = passcodeService.generatePasscode();
      // Format: XXXX-XXXX-XXXX-XXXX
      expect(passcode).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
      expect(passcode).not.toMatch(/[01OIoi]/); // Never contains 0, 1, O, I
    });

    it('should verify matching passcode using constant-time hash comparison', () => {
      const passcode = passcodeService.generatePasscode();
      const salt = passcodeService.generateSalt();
      const hash = passcodeService.hashPasscode(passcode, salt, orgId);

      const isValid = passcodeService.verifyPasscode(passcode, hash, salt, orgId);
      expect(isValid).toBe(true);

      const isInvalid = passcodeService.verifyPasscode('WRONG-CODE-1234', hash, salt, orgId);
      expect(isInvalid).toBe(false);
    });

    it('should be tenant-bound: same passcode and salt in different org produces different hash', () => {
      const passcode = passcodeService.generatePasscode();
      const salt = passcodeService.generateSalt();

      const hashOrgAlpha = passcodeService.hashPasscode(passcode, salt, orgId);
      const hashOrgBeta = passcodeService.hashPasscode(passcode, salt, otherOrgId);

      expect(hashOrgAlpha).not.toBe(hashOrgBeta);
      expect(passcodeService.verifyPasscode(passcode, hashOrgAlpha, salt, otherOrgId)).toBe(false);
    });

    it('should correctly mask a physical passcode for UI display', () => {
      const masked = passcodeService.maskPasscode('A7K9-W3M2-X8P1-Q4V6');
      expect(masked).toBe('A7K9-****-****-Q4V6');
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
    it('should generate encrypted pass credentials with optional physical badge', () => {
      const creds = qrTokenService.generatePassCredentials(orgId, true);

      expect(creds.hmacSecretEncrypted.startsWith('enc:v1:')).toBe(true);
      expect(creds.passCodeHash).toBeDefined();
      expect(creds.passCodeSalt).toBeDefined();
      expect(creds.passCodeMasked).toMatch(/^[2-9A-HJ-NP-Z]{4}-\*\*\*\*-\*\*\*\*-[2-9A-HJ-NP-Z]{4}$/);
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
