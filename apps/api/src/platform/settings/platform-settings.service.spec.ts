import { Test, TestingModule } from '@nestjs/testing';
import { PlatformSettingsService } from './platform-settings.service';
import { PlatformEncryptionService } from './platform-encryption.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

describe('Platform Settings & Security Center', () => {
  let encryptionService: PlatformEncryptionService;
  let settingsService: PlatformSettingsService;

  const mockPrismaService = {
    withSuperAdminContext: jest.fn().mockImplementation((cb) =>
      cb({
        platformSetting: {
          findUnique: jest.fn(),
          upsert: jest.fn(),
          update: jest.fn(),
          findMany: jest.fn(),
        },
        platformEmailTemplate: {
          count: jest.fn().mockResolvedValue(10),
          findMany: jest.fn().mockResolvedValue([]),
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        auditLog: {
          count: jest.fn().mockResolvedValue(1),
          findMany: jest.fn().mockResolvedValue([]),
        },
      }),
    ),
  };

  const mockAuditService = {
    recordInTransaction: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformSettingsService,
        PlatformEncryptionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    encryptionService = module.get<PlatformEncryptionService>(PlatformEncryptionService);
    settingsService = module.get<PlatformSettingsService>(PlatformSettingsService);
  });

  describe('PlatformEncryptionService (AES-256-GCM)', () => {
    it('should encrypt and decrypt plaintext accurately', () => {
      const secret = 'super-secret-smtp-password-12345';
      const encrypted = encryptionService.encrypt(secret);

      expect(encrypted).toBeDefined();
      expect(encrypted).toMatch(/^enc:v1:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
      expect(encrypted).not.toContain(secret);

      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(secret);
    });

    it('should return masked secret string for UI/API presentation', () => {
      expect(encryptionService.mask('mySecretPassword')).toBe('••••••••');
      expect(encryptionService.mask(null)).toBe('');
      expect(encryptionService.mask('')).toBe('');
    });

    it('should fail decryption if ciphertext or authentication tag is tampered with', () => {
      const secret = 'valid-token';
      const encrypted = encryptionService.encrypt(secret);
      const parts = encrypted.split(':');
      // Tamper with ciphertext
      parts[4] = 'ff' + parts[4]?.slice(2);
      const tampered = parts.join(':');

      expect(() => encryptionService.decrypt(tampered)).toThrow();
    });
  });

  describe('Website Branding', () => {
    it('should return robust defaults when branding is unconfigured', async () => {
      const branding = await settingsService.getBranding(false);
      expect(branding.platformName).toBe('GymOS Platform');
      expect(branding.primaryColor).toBe('#7c3aed');
      expect(branding.contactEmail).toBe('contact@gymos.com');
    });
  });

  describe('HTML Template Sanitization and Interpolation', () => {
    it('should strip script tags and event handlers from template HTML', () => {
      const unsafeHtml = '<div>Welcome <script>alert("hack")</script><img src="x" onerror="alert(1)"></div>';
      const sanitized = (settingsService as any).sanitizeHtml(unsafeHtml);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('onerror=');
      expect(sanitized).toContain('<div>Welcome ');
    });

    it('should safely interpolate template variable placeholders', () => {
      const template = 'Hello {{recipient_name}}, welcome to {{platform_name}}! Unused: {{unknown_key}}';
      const variables = {
        recipient_name: 'Vikram',
        platform_name: 'GymOS',
      };
      const rendered = (settingsService as any).interpolateVariables(template, variables);

      expect(rendered).toBe('Hello Vikram, welcome to GymOS! Unused: {{unknown_key}}');
    });
  });
});
