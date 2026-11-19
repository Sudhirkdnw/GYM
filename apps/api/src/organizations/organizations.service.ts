import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AppLoggerService } from '../logging/app-logger.service';
import {
  UpdateOrganizationProfileInput,
  UpdateOrganizationSettingsInput,
  CreateOrganizationInput,
} from './dto/organization.dto';
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
}
