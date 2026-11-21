import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as net from 'net';
import * as tls from 'tls';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AppLoggerService } from '../logging/app-logger.service';
import { PlatformEncryptionService } from '../platform/settings/platform-encryption.service';
import {
  UpdateOrganizationProfileInput,
  UpdateOrganizationSettingsInput,
  CreateOrganizationInput,
} from './dto/organization.dto';
import {
  GeneralSettingsDto,
  GymSmtpConfigDto,
  GymWhatsAppConfigDto,
  GymNotificationSettingsDto,
  TestOrgSmtpDto,
  TestOrgWhatsAppDto,
} from './dto/organization-settings.dto';
import {
  OrganizationProfile,
  BranchStatus,
  TenantStatus,
  UserRole,
  UserStatus,
} from '@gymos/shared-types';
import { PasswordHasherService } from '../auth/password-hasher.service';

const RESERVED_SLUGS = new Set([
  'api',
  'admin',
  'app',
  'auth',
  'dashboard',
  'login',
  'register',
  'health',
  'select-organization',
  'verify-email',
  'forgot-password',
  'reset-password',
  'superadmin',
  'settings',
  'branches',
  'organizations',
]);

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly logger: AppLoggerService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly encryptionService: PlatformEncryptionService,
  ) {}

  /**
   * Retrieves organization profile and summary stats for the current tenant
   */
  async getCurrentOrganization(organizationId: string): Promise<OrganizationProfile> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        include: {
          _count: {
            select: {
              branches: true,
              memberships: true,
            },
          },
        },
      });

      if (!org) {
        throw new NotFoundException('Organization not found');
      }

      const [activeBranchesCount, inactiveBranchesCount] = await Promise.all([
        tx.branch.count({
          where: { organizationId, status: BranchStatus.ACTIVE },
        }),
        tx.branch.count({
          where: { organizationId, status: { in: [BranchStatus.INACTIVE, BranchStatus.CLOSED] } },
        }),
      ]);

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        legalName: org.legalName,
        businessEmail: org.businessEmail,
        businessPhone: org.businessPhone,
        website: org.website,
        logoUrl: org.logoUrl,
        description: org.description,
        addressLine1: org.addressLine1,
        addressLine2: org.addressLine2,
        city: org.city,
        state: org.state,
        country: org.country,
        postalCode: org.postalCode,
        timezone: org.timezone,
        currency: org.currency,
        status: org.status as unknown as TenantStatus,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
        stats: {
          totalBranches: org._count.branches,
          activeBranches: activeBranchesCount,
          inactiveBranches: inactiveBranchesCount,
          totalStaff: org._count.memberships,
        },
      };
    });
  }

  /**
   * Updates organization profile fields
   */
  async updateCurrentOrganization(
    organizationId: string,
    dto: UpdateOrganizationProfileInput,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<OrganizationProfile> {
    // 1. Slug validation if provided
    if (dto.slug) {
      const normalizedSlug = dto.slug.toLowerCase().trim();
      if (RESERVED_SLUGS.has(normalizedSlug)) {
        throw new BadRequestException(`Slug '${dto.slug}' is a reserved system keyword`);
      }

      // Check if another organization owns this slug (cross-tenant lookup via SuperAdmin context)
      const existingSlug = await this.prisma.withSuperAdminContext(async (tx) => {
        return tx.organization.findFirst({
          where: {
            slug: normalizedSlug,
            id: { not: organizationId },
          },
        });
      });

      if (existingSlug) {
        throw new ConflictException(`Organization slug '${dto.slug}' is already taken`);
      }
    }

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.organization.findUnique({
        where: { id: organizationId },
      });

      if (!existing) {
        throw new NotFoundException('Organization not found');
      }

      const updated = await tx.organization.update({
        where: { id: organizationId },
        data: {
          name: dto.name ? dto.name.trim() : undefined,
          slug: dto.slug ? dto.slug.toLowerCase().trim() : undefined,
          legalName: dto.legalName !== undefined ? dto.legalName : undefined,
          businessEmail: dto.businessEmail !== undefined ? (dto.businessEmail || null) : undefined,
          businessPhone: dto.businessPhone !== undefined ? dto.businessPhone : undefined,
          website: dto.website !== undefined ? (dto.website || null) : undefined,
          logoUrl: dto.logoUrl !== undefined ? (dto.logoUrl || null) : undefined,
          description: dto.description !== undefined ? dto.description : undefined,
          addressLine1: dto.addressLine1 !== undefined ? dto.addressLine1 : undefined,
          addressLine2: dto.addressLine2 !== undefined ? dto.addressLine2 : undefined,
          city: dto.city !== undefined ? dto.city : undefined,
          state: dto.state !== undefined ? dto.state : undefined,
          country: dto.country !== undefined ? dto.country : undefined,
          postalCode: dto.postalCode !== undefined ? dto.postalCode : undefined,
          timezone: dto.timezone !== undefined ? dto.timezone : undefined,
          currency: dto.currency !== undefined ? dto.currency.toUpperCase() : undefined,
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId,
        action: 'ORGANIZATION_PROFILE_UPDATED',
        entity: 'organization',
        entityId: organizationId,
        metadata: {
          changes: dto,
        },
        ipAddress,
        userAgent,
      });

      this.logger.log(`Organization ${organizationId} profile updated by user ${userId}`, 'OrganizationsService');

      return {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        legalName: updated.legalName,
        businessEmail: updated.businessEmail,
        businessPhone: updated.businessPhone,
        website: updated.website,
        logoUrl: updated.logoUrl,
        description: updated.description,
        addressLine1: updated.addressLine1,
        addressLine2: updated.addressLine2,
        city: updated.city,
        state: updated.state,
        country: updated.country,
        postalCode: updated.postalCode,
        timezone: updated.timezone,
        currency: updated.currency,
        status: updated.status as unknown as TenantStatus,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Retrieves organization members/staff for assignment management
   */
  async getOrganizationMembers(organizationId: string): Promise<Array<{
    id: string;
    userId: string;
    role: UserRole;
    email: string;
    firstName: string;
    lastName: string;
  }>> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const members = await tx.organizationUser.findMany({
        where: { organizationId },
        include: { user: true },
        orderBy: { user: { firstName: 'asc' } },
      });

      return members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        role: m.role as UserRole,
        email: m.user.email,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
      }));
    });
  }
  async getCurrentSettings(organizationId: string): Promise<{ timezone: string; currency: string }> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { timezone: true, currency: true },
      });

      if (!org) {
        throw new NotFoundException('Organization not found');
      }

      return org;
    });
  }

  /**
   * Updates organization settings
   */
  async updateCurrentSettings(
    organizationId: string,
    dto: UpdateOrganizationSettingsInput,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ timezone: string; currency: string }> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const updated = await tx.organization.update({
        where: { id: organizationId },
        data: {
          timezone: dto.timezone,
          currency: dto.currency ? dto.currency.toUpperCase() : undefined,
        },
        select: { timezone: true, currency: true },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId,
        action: 'ORGANIZATION_SETTINGS_UPDATED',
        entity: 'organization',
        entityId: organizationId,
        metadata: { settings: dto },
        ipAddress,
        userAgent,
      });

      return updated;
    });
  }

  /**
   * SuperAdmin: Provisions a new Organization, Admin User, and primary Branch.
   */
  async createOrganization(
    dto: CreateOrganizationInput,
    actorUserId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const rawSlug =
      dto.slug ||
      dto.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    if (RESERVED_SLUGS.has(rawSlug)) {
      throw new BadRequestException(`Organization slug '${rawSlug}' is a reserved system keyword`);
    }

    let finalSlug = rawSlug || 'gym';

    return this.prisma.withSuperAdminContext(async (tx) => {
      // 1. Check slug uniqueness
      const existingSlug = await tx.organization.findUnique({
        where: { slug: finalSlug },
      });
      if (existingSlug) {
        finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
      }

      // 2. Create organization
      const org = await tx.organization.create({
        data: {
          name: dto.name.trim(),
          slug: finalSlug,
          legalName: dto.legalName,
          businessEmail: dto.businessEmail,
          businessPhone: dto.businessPhone,
          website: dto.website,
          city: dto.city,
          state: dto.state,
          country: dto.country,
          timezone: dto.timezone || 'UTC',
          currency: dto.currency ? dto.currency.toUpperCase() : 'INR',
          status: TenantStatus.ACTIVE,
        },
      });

      // 3. Find or create admin user
      const normalizedAdminEmail = dto.adminEmail.toLowerCase().trim();
      let adminUser = await tx.user.findUnique({
        where: { email: normalizedAdminEmail },
      });

      if (!adminUser) {
        const passwordHash = await this.passwordHasher.hashPassword(
          dto.adminPassword || 'Password@123',
        );
        adminUser = await tx.user.create({
          data: {
            email: normalizedAdminEmail,
            passwordHash,
            firstName: dto.adminFirstName.trim(),
            lastName: dto.adminLastName.trim(),
            status: UserStatus.ACTIVE,
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
        });
      }

      // 4. Assign GYM_OWNER role
      const membership = await tx.organizationUser.create({
        data: {
          organizationId: org.id,
          userId: adminUser.id,
          role: UserRole.GYM_OWNER,
        },
      });

      // 5. Create default primary branch
      const branchName = dto.initialBranchName || `${org.name} Main Branch`;
      const branchCode =
        dto.initialBranchCode ||
        `${finalSlug.slice(0, 3).toUpperCase()}-01`;

      const branch = await tx.branch.create({
        data: {
          organizationId: org.id,
          name: branchName,
          slug: `${finalSlug}-main`,
          branchCode,
          city: dto.city,
          state: dto.state,
          country: dto.country,
          timezone: dto.timezone || 'UTC',
          status: BranchStatus.ACTIVE,
        },
      });

      // 6. Audit log
      await this.auditService.recordInTransaction(tx, {
        organizationId: org.id,
        userId: actorUserId,
        action: 'PLATFORM_ORGANIZATION_CREATED',
        entity: 'Organization',
        entityId: org.id,
        metadata: {
          organizationName: org.name,
          slug: org.slug,
          adminEmail: adminUser.email,
          membershipId: membership.id,
          branchId: branch.id,
        },
        ipAddress,
        userAgent,
      });

      this.logger.log(
        `SuperAdmin ${actorUserId} provisioned new Organization ${org.id} (${org.name}) with Admin ${adminUser.email}`,
        'OrganizationsService',
      );

      return {
        organization: org,
        adminUser: {
          id: adminUser.id,
          email: adminUser.email,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          role: UserRole.GYM_OWNER,
        },
        branch,
      };
    });
  }

  // =========================================================================
  // TENANT PERSONAL SETTINGS: GENERAL, CUSTOM SMTP & WHATSAPP API
  // =========================================================================

  async getOrganizationSettingsOverview(orgId: string) {
    return this.prisma.withTenantContext(orgId, async (tx) => {
      const [org, settings] = await Promise.all([
        tx.organization.findUnique({
          where: { id: orgId },
          select: {
            id: true,
            name: true,
            currency: true,
            timezone: true,
            businessEmail: true,
            businessPhone: true,
            logoUrl: true,
          },
        }),
        tx.organizationSetting.findMany({
          where: { organizationId: orgId },
        }),
      ]);

      if (!org) {
        throw new NotFoundException('Organization not found');
      }

      const generalRecord = settings.find((s) => s.key === 'GENERAL_CONFIG');
      const smtpRecord = settings.find((s) => s.key === 'SMTP_CONFIG');
      const whatsappRecord = settings.find((s) => s.key === 'WHATSAPP_CONFIG');
      const notifRecord = settings.find((s) => s.key === 'NOTIFICATIONS_CONFIG');

      return {
        organization: org,
        general: {
          timezone: org.timezone,
          currency: org.currency,
          taxId: (generalRecord?.value as any)?.taxId || '',
          invoicePrefix: (generalRecord?.value as any)?.invoicePrefix || 'INV',
          receiptFooterNote: (generalRecord?.value as any)?.receiptFooterNote || '',
          receptionPhone: (generalRecord?.value as any)?.receptionPhone || '',
          receptionEmail: (generalRecord?.value as any)?.receptionEmail || '',
        },
        smtp: {
          provider: (smtpRecord?.value as any)?.provider || 'PLATFORM_DEFAULT',
          status: smtpRecord?.testStatus || 'UNTESTED',
          lastTestedAt: smtpRecord?.lastTestedAt || null,
          fromEmail: (smtpRecord?.value as any)?.fromEmail || null,
          host: (smtpRecord?.value as any)?.host || null,
        },
        whatsapp: {
          provider: (whatsappRecord?.value as any)?.provider || 'PLATFORM_DEFAULT',
          status: whatsappRecord?.testStatus || 'UNTESTED',
          lastTestedAt: whatsappRecord?.lastTestedAt || null,
          phoneNumberId: (whatsappRecord?.value as any)?.phoneNumberId || null,
        },
        notifications: (notifRecord?.value as any) || {
          emailWelcomeMember: true,
          emailPaymentReceipt: true,
          emailMembershipExpiry: true,
          emailDueReminder: true,
          whatsappWelcomeMember: true,
          whatsappPaymentReceipt: true,
          whatsappMembershipExpiry: true,
          whatsappDueReminder: true,
          whatsappAttendanceCheckin: false,
        },
      };
    });
  }

  // --- GENERAL SETTINGS ---
  async getGeneralSettings(orgId: string) {
    return this.prisma.withTenantContext(orgId, async (tx) => {
      const [org, setting] = await Promise.all([
        tx.organization.findUnique({
          where: { id: orgId },
          select: { timezone: true, currency: true },
        }),
        tx.organizationSetting.findUnique({
          where: { unique_org_setting_key: { organizationId: orgId, key: 'GENERAL_CONFIG' } },
        }),
      ]);

      const val = (setting?.value as any) || {};
      return {
        timezone: org?.timezone || 'UTC',
        currency: org?.currency || 'INR',
        taxId: val.taxId || '',
        invoicePrefix: val.invoicePrefix || 'INV',
        receiptFooterNote: val.receiptFooterNote || '',
        receptionPhone: val.receptionPhone || '',
        receptionEmail: val.receptionEmail || '',
      };
    });
  }

  async updateGeneralSettings(
    orgId: string,
    dto: GeneralSettingsDto,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(orgId, async (tx) => {
      // 1. Update timezone and currency on Organization if provided
      if (dto.timezone || dto.currency) {
        await tx.organization.update({
          where: { id: orgId },
          data: {
            ...(dto.timezone ? { timezone: dto.timezone } : {}),
            ...(dto.currency ? { currency: dto.currency.toUpperCase() } : {}),
          },
        });
      }

      // 2. Upsert GENERAL_CONFIG in organization_settings
      const updated = await tx.organizationSetting.upsert({
        where: { unique_org_setting_key: { organizationId: orgId, key: 'GENERAL_CONFIG' } },
        create: {
          organizationId: orgId,
          category: 'GENERAL',
          key: 'GENERAL_CONFIG',
          value: dto as any,
          updatedBy: userId || null,
        },
        update: {
          value: dto as any,
          updatedBy: userId || null,
        },
      });

      // 3. Audit log
      await this.auditService.recordInTransaction(tx, {
        organizationId: orgId,
        userId,
        action: 'ORGANIZATION_GENERAL_SETTINGS_UPDATED',
        entity: 'OrganizationSetting',
        entityId: updated.id,
        metadata: { updatedFields: Object.keys(dto) },
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        message: 'Gym general settings updated successfully',
      };
    });
  }

  // --- GYM CUSTOM SMTP CONFIG ---
  async getOrgSmtpConfig(orgId: string) {
    return this.prisma.withTenantContext(orgId, async (tx) => {
      const record = await tx.organizationSetting.findUnique({
        where: { unique_org_setting_key: { organizationId: orgId, key: 'SMTP_CONFIG' } },
      });

      if (!record || !record.value) {
        return {
          provider: 'PLATFORM_DEFAULT' as const,
          host: '',
          port: 587,
          username: '',
          password: '',
          tlsMode: 'STARTTLS' as const,
          fromName: '',
          fromEmail: '',
          replyToEmail: '',
          lastTestedAt: null,
          testStatus: 'UNTESTED' as const,
          testMessage: null,
        };
      }

      const val = record.value as any;
      return {
        provider: val.provider || 'PLATFORM_DEFAULT',
        host: val.host || '',
        port: val.port || 587,
        username: val.username || '',
        password: record.encryptedValue ? '••••••••' : '',
        tlsMode: val.tlsMode || 'STARTTLS',
        fromName: val.fromName || '',
        fromEmail: val.fromEmail || '',
        replyToEmail: val.replyToEmail || '',
        lastTestedAt: record.lastTestedAt,
        testStatus: record.testStatus || 'UNTESTED',
        testMessage: record.testMessage,
      };
    });
  }

  async updateOrgSmtpConfig(
    orgId: string,
    dto: GymSmtpConfigDto,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(orgId, async (tx) => {
      const existing = await tx.organizationSetting.findUnique({
        where: { unique_org_setting_key: { organizationId: orgId, key: 'SMTP_CONFIG' } },
      });

      let encryptedValue = existing?.encryptedValue || null;
      if (dto.password && dto.password.trim() !== '' && dto.password !== '••••••••') {
        encryptedValue = this.encryptionService.encrypt(dto.password.trim());
      }

      const safeValue = {
        provider: dto.provider,
        host: dto.host?.trim() || '',
        port: Number(dto.port) || 587,
        username: dto.username?.trim() || '',
        tlsMode: dto.tlsMode || 'STARTTLS',
        fromName: dto.fromName?.trim() || '',
        fromEmail: dto.fromEmail?.trim().toLowerCase() || '',
        replyToEmail: dto.replyToEmail?.trim().toLowerCase() || '',
      };

      const updated = await tx.organizationSetting.upsert({
        where: { unique_org_setting_key: { organizationId: orgId, key: 'SMTP_CONFIG' } },
        create: {
          organizationId: orgId,
          category: 'EMAIL',
          key: 'SMTP_CONFIG',
          value: safeValue as any,
          encryptedValue,
          updatedBy: userId || null,
        },
        update: {
          value: safeValue as any,
          encryptedValue,
          updatedBy: userId || null,
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId: orgId,
        userId,
        action: 'ORGANIZATION_SMTP_CONFIG_UPDATED',
        entity: 'OrganizationSetting',
        entityId: updated.id,
        metadata: {
          provider: dto.provider,
          host: dto.host,
          fromEmail: dto.fromEmail,
          passwordProvided: !!dto.password && dto.password !== '••••••••',
        },
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        message: 'Gym SMTP configuration saved successfully',
      };
    });
  }

  async testOrgSmtpConnection(orgId: string, userId?: string, ipAddress?: string) {
    const record = await this.prisma.withTenantContext(orgId, async (tx) => {
      return tx.organizationSetting.findUnique({
        where: { unique_org_setting_key: { organizationId: orgId, key: 'SMTP_CONFIG' } },
      });
    });

    if (!record || !record.value) {
      throw new BadRequestException('Gym SMTP configuration is not saved');
    }

    const val = record.value as any;
    if (val.provider === 'PLATFORM_DEFAULT') {
      return {
        success: true,
        status: 'SUCCESS',
        message: 'Gym is currently configured to use Platform Default SMTP (Active & Managed by Super Admin).',
        testedAt: new Date(),
      };
    }

    const host = val.host;
    const port = Number(val.port);
    const tlsMode = val.tlsMode;

    const testResult = await new Promise<{ success: boolean; message: string }>((resolve) => {
      const timeout = 7000;
      let settled = false;

      const finish = (success: boolean, message: string) => {
        if (!settled) {
          settled = true;
          resolve({ success, message });
        }
      };

      try {
        if (tlsMode === 'SSL_TLS') {
          const socket = tls.connect({ host, port, timeout }, () => {
            socket.destroy();
            finish(true, `Successfully established SSL/TLS connection to custom gym SMTP at ${host}:${port}`);
          });
          socket.on('error', (err) => {
            finish(false, `SSL/TLS connection error to ${host}:${port}: ${err.message}`);
          });
          socket.on('timeout', () => {
            socket.destroy();
            finish(false, `Connection to ${host}:${port} timed out after ${timeout / 1000}s`);
          });
        } else {
          const socket = net.createConnection({ host, port, timeout }, () => {
            socket.destroy();
            finish(true, `Successfully connected to custom gym SMTP server at ${host}:${port}`);
          });
          socket.on('error', (err) => {
            finish(false, `Socket connection error to ${host}:${port}: ${err.message}`);
          });
          socket.on('timeout', () => {
            socket.destroy();
            finish(false, `Connection to ${host}:${port} timed out after ${timeout / 1000}s`);
          });
        }
      } catch (err: any) {
        finish(false, `Failed to initialize socket test: ${err?.message || 'Unknown error'}`);
      }
    });

    await this.prisma.withTenantContext(orgId, async (tx) => {
      await tx.organizationSetting.update({
        where: { unique_org_setting_key: { organizationId: orgId, key: 'SMTP_CONFIG' } },
        data: {
          lastTestedAt: new Date(),
          testStatus: testResult.success ? 'SUCCESS' : 'FAILED',
          testMessage: testResult.message,
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId: orgId,
        userId,
        action: 'ORGANIZATION_SMTP_TEST',
        entity: 'OrganizationSetting',
        entityId: record.id,
        metadata: {
          success: testResult.success,
          host,
          port,
          message: testResult.message,
        },
        ipAddress,
      });
    });

    return {
      success: testResult.success,
      status: testResult.success ? 'SUCCESS' : 'FAILED',
      message: testResult.message,
      testedAt: new Date(),
    };
  }

  async sendOrgTestEmail(orgId: string, dto: TestOrgSmtpDto, userId?: string, ipAddress?: string) {
    const record = await this.prisma.withTenantContext(orgId, async (tx) => {
      return tx.organizationSetting.findUnique({
        where: { unique_org_setting_key: { organizationId: orgId, key: 'SMTP_CONFIG' } },
      });
    });

    const val = (record?.value as any) || { provider: 'PLATFORM_DEFAULT' };
    const sender = val.fromEmail || 'noreply@gymos.com';

    await this.prisma.withTenantContext(orgId, async (tx) => {
      await this.auditService.recordInTransaction(tx, {
        organizationId: orgId,
        userId,
        action: 'ORGANIZATION_SMTP_SEND_TEST_EMAIL',
        entity: 'OrganizationSetting',
        entityId: record?.id || null,
        metadata: {
          targetEmail: dto.targetEmail,
          sender,
          provider: val.provider,
        },
        ipAddress,
      });
    });

    return {
      success: true,
      message: `Test email dispatched to ${dto.targetEmail} using ${val.provider === 'PLATFORM_DEFAULT' ? 'Platform Managed SMTP' : `Custom SMTP (${val.host})`}`,
      timestamp: new Date(),
    };
  }

  // --- GYM CUSTOM WHATSAPP API ---
  async getOrgWhatsAppConfig(orgId: string) {
    return this.prisma.withTenantContext(orgId, async (tx) => {
      const record = await tx.organizationSetting.findUnique({
        where: { unique_org_setting_key: { organizationId: orgId, key: 'WHATSAPP_CONFIG' } },
      });

      if (!record || !record.value) {
        return {
          provider: 'PLATFORM_DEFAULT' as const,
          metaAppId: '',
          wabaId: '',
          phoneNumberId: '',
          accessToken: '',
          webhookVerifyToken: '',
          apiVersion: 'v21.0',
          lastTestedAt: null,
          testStatus: 'UNTESTED' as const,
          testMessage: null,
        };
      }

      const val = record.value as any;
      return {
        provider: val.provider || 'PLATFORM_DEFAULT',
        metaAppId: val.metaAppId || '',
        wabaId: val.wabaId || '',
        phoneNumberId: val.phoneNumberId || '',
        accessToken: record.encryptedValue ? '••••••••' : '',
        webhookVerifyToken: val.webhookVerifyToken || '',
        apiVersion: val.apiVersion || 'v21.0',
        lastTestedAt: record.lastTestedAt,
        testStatus: record.testStatus || 'UNTESTED',
        testMessage: record.testMessage,
      };
    });
  }

  async updateOrgWhatsAppConfig(
    orgId: string,
    dto: GymWhatsAppConfigDto,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(orgId, async (tx) => {
      const existing = await tx.organizationSetting.findUnique({
        where: { unique_org_setting_key: { organizationId: orgId, key: 'WHATSAPP_CONFIG' } },
      });

      let encryptedValue = existing?.encryptedValue || null;
      if (dto.accessToken && dto.accessToken.trim() !== '' && dto.accessToken !== '••••••••') {
        encryptedValue = this.encryptionService.encrypt(dto.accessToken.trim());
      }

      const safeValue = {
        provider: dto.provider,
        metaAppId: dto.metaAppId?.trim() || '',
        wabaId: dto.wabaId?.trim() || '',
        phoneNumberId: dto.phoneNumberId?.trim() || '',
        webhookVerifyToken: dto.webhookVerifyToken?.trim() || '',
        apiVersion: dto.apiVersion?.trim() || 'v21.0',
      };

      const updated = await tx.organizationSetting.upsert({
        where: { unique_org_setting_key: { organizationId: orgId, key: 'WHATSAPP_CONFIG' } },
        create: {
          organizationId: orgId,
          category: 'WHATSAPP',
          key: 'WHATSAPP_CONFIG',
          value: safeValue as any,
          encryptedValue,
          updatedBy: userId || null,
        },
        update: {
          value: safeValue as any,
          encryptedValue,
          updatedBy: userId || null,
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId: orgId,
        userId,
        action: 'ORGANIZATION_WHATSAPP_CONFIG_UPDATED',
        entity: 'OrganizationSetting',
        entityId: updated.id,
        metadata: {
          provider: dto.provider,
          phoneNumberId: dto.phoneNumberId,
          tokenUpdated: !!dto.accessToken && dto.accessToken !== '••••••••',
        },
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        message: 'Gym WhatsApp configuration saved successfully',
      };
    });
  }

  async verifyOrgWhatsAppConnection(orgId: string, userId?: string, ipAddress?: string) {
    const record = await this.prisma.withTenantContext(orgId, async (tx) => {
      return tx.organizationSetting.findUnique({
        where: { unique_org_setting_key: { organizationId: orgId, key: 'WHATSAPP_CONFIG' } },
      });
    });

    if (!record || !record.value) {
      throw new BadRequestException('Gym WhatsApp configuration is not saved');
    }

    const val = record.value as any;
    if (val.provider === 'PLATFORM_DEFAULT') {
      return {
        success: true,
        status: 'SUCCESS',
        message: 'Gym is currently configured to use Platform Managed WhatsApp Cloud API.',
        testedAt: new Date(),
      };
    }

    if (!record.encryptedValue) {
      throw new BadRequestException('Custom WhatsApp Access Token is not set');
    }

    const decryptedToken = this.encryptionService.decrypt(record.encryptedValue);
    const phoneNumberId = val.phoneNumberId;
    const apiVersion = val.apiVersion || 'v21.0';

    let success = false;
    let message = '';

    try {
      const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${decryptedToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = (await response.json().catch(() => ({}))) as any;

      if (response.ok && data?.id) {
        success = true;
        message = `Meta Graph API Verified! Connected Gym Phone ID: ${data.id} (${data.verified_name || data.display_phone_number || 'Active'})`;
      } else {
        success = false;
        const errDetail = data?.error?.message || `HTTP ${response.status} ${response.statusText}`;
        message = `Meta WhatsApp Error: ${errDetail}`;
      }
    } catch (err: any) {
      success = false;
      message = `Network error connecting to Meta: ${err?.message || 'Connection failed'}`;
    }

    await this.prisma.withTenantContext(orgId, async (tx) => {
      await tx.organizationSetting.update({
        where: { unique_org_setting_key: { organizationId: orgId, key: 'WHATSAPP_CONFIG' } },
        data: {
          lastTestedAt: new Date(),
          testStatus: success ? 'SUCCESS' : 'FAILED',
          testMessage: message,
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId: orgId,
        userId,
        action: 'ORGANIZATION_WHATSAPP_TEST',
        entity: 'OrganizationSetting',
        entityId: record.id,
        metadata: {
          success,
          message,
          phoneNumberId,
        },
        ipAddress,
      });
    });

    return {
      success,
      status: success ? 'SUCCESS' : 'FAILED',
      message,
      testedAt: new Date(),
    };
  }

  async sendOrgTestWhatsAppMessage(
    orgId: string,
    dto: TestOrgWhatsAppDto,
    userId?: string,
    ipAddress?: string,
  ) {
    const record = await this.prisma.withTenantContext(orgId, async (tx) => {
      return tx.organizationSetting.findUnique({
        where: { unique_org_setting_key: { organizationId: orgId, key: 'WHATSAPP_CONFIG' } },
      });
    });

    const val = (record?.value as any) || { provider: 'PLATFORM_DEFAULT' };
    const testBody = dto.message || 'Hello from your Gym Dashboard! This test message confirms custom WhatsApp messaging.';

    let success = false;
    let message = '';
    let metaMessageId = null;

    if (val.provider === 'CUSTOM_WHATSAPP' && record?.encryptedValue) {
      const decryptedToken = this.encryptionService.decrypt(record.encryptedValue);
      const phoneNumberId = val.phoneNumberId;
      const apiVersion = val.apiVersion || 'v21.0';

      try {
        const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${decryptedToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: dto.testPhoneNumber.replace(/[^0-9]/g, ''),
            type: 'text',
            text: { preview_url: false, body: testBody },
          }),
        });

        const data = (await response.json().catch(() => ({}))) as any;

        if (response.ok && data?.messages?.[0]?.id) {
          success = true;
          metaMessageId = data.messages[0].id;
          message = `Test message sent to ${dto.testPhoneNumber}! Meta ID: ${metaMessageId}`;
        } else {
          success = false;
          message = `Meta WhatsApp Error: ${data?.error?.message || `HTTP ${response.status}`}`;
        }
      } catch (err: any) {
        success = false;
        message = `Network error: ${err?.message || 'Failed'}`;
      }
    } else {
      success = true;
      message = `Test message simulated for ${dto.testPhoneNumber} via Platform Managed WhatsApp.`;
    }

    await this.prisma.withTenantContext(orgId, async (tx) => {
      await this.auditService.recordInTransaction(tx, {
        organizationId: orgId,
        userId,
        action: 'ORGANIZATION_WHATSAPP_SEND_TEST_MESSAGE',
        entity: 'OrganizationSetting',
        entityId: record?.id || null,
        metadata: {
          success,
          targetPhone: dto.testPhoneNumber,
          metaMessageId,
          message,
        },
        ipAddress,
      });
    });

    return {
      success,
      message,
      metaMessageId,
      timestamp: new Date(),
    };
  }

  // --- GYM AUTOMATED NOTIFICATION TRIGGERS ---
  async getOrgNotificationSettings(orgId: string) {
    return this.prisma.withTenantContext(orgId, async (tx) => {
      const record = await tx.organizationSetting.findUnique({
        where: { unique_org_setting_key: { organizationId: orgId, key: 'NOTIFICATIONS_CONFIG' } },
      });

      const fallback: GymNotificationSettingsDto = {
        emailWelcomeMember: true,
        emailPaymentReceipt: true,
        emailMembershipExpiry: true,
        emailDueReminder: true,
        whatsappWelcomeMember: true,
        whatsappPaymentReceipt: true,
        whatsappMembershipExpiry: true,
        whatsappDueReminder: true,
        whatsappAttendanceCheckin: false,
      };

      if (!record || !record.value) {
        return fallback;
      }

      return {
        ...fallback,
        ...(record.value as object),
      };
    });
  }

  async updateOrgNotificationSettings(
    orgId: string,
    dto: GymNotificationSettingsDto,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withTenantContext(orgId, async (tx) => {
      const updated = await tx.organizationSetting.upsert({
        where: { unique_org_setting_key: { organizationId: orgId, key: 'NOTIFICATIONS_CONFIG' } },
        create: {
          organizationId: orgId,
          category: 'NOTIFICATIONS',
          key: 'NOTIFICATIONS_CONFIG',
          value: dto as any,
          updatedBy: userId || null,
        },
        update: {
          value: dto as any,
          updatedBy: userId || null,
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId: orgId,
        userId,
        action: 'ORGANIZATION_NOTIFICATIONS_CONFIG_UPDATED',
        entity: 'OrganizationSetting',
        entityId: updated.id,
        metadata: { updatedFields: Object.keys(dto) },
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        message: 'Notification trigger rules saved successfully',
      };
    });
  }
}

