import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AppLoggerService } from '../logging/app-logger.service';
import {
  CreateBranchInput,
  UpdateBranchInput,
  UpdateBranchStatusInput,
  BranchQueryInput,
} from './dto/branch.dto';
import {
  BranchData,
  BranchStatus,
  PaginatedResult,
  UserRole,
  AuthenticatedUserContext,
} from '@gymos/shared-types';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly logger: AppLoggerService,
  ) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Creates a new branch under the current tenant organization
   */
  async createBranch(
    organizationId: string,
    dto: CreateBranchInput,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<BranchData> {
    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.name);
    const branchCode = dto.branchCode.toUpperCase().trim();

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // Check duplicate slug within organization
      const existingSlug = await tx.branch.findUnique({
        where: {
          unique_org_branch_slug: {
            organizationId,
            slug,
          },
        },
      });
      if (existingSlug) {
        throw new ConflictException(
          `Branch slug '${slug}' already exists in this organization`,
        );
      }

      // Check duplicate branchCode within organization
      const existingCode = await tx.branch.findUnique({
        where: {
          unique_org_branch_code: {
            organizationId,
            branchCode,
          },
        },
      });
      if (existingCode) {
        throw new ConflictException(
          `Branch code '${branchCode}' already exists in this organization`,
        );
      }

      const branch = await tx.branch.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          slug,
          branchCode,
          description: dto.description || null,
          email: dto.email || null,
          phone: dto.phone || null,
          website: dto.website || null,
          logoUrl: dto.logoUrl || null,
          addressLine1: dto.addressLine1 || null,
          addressLine2: dto.addressLine2 || null,
          city: dto.city || null,
          state: dto.state || null,
          country: dto.country || null,
          postalCode: dto.postalCode || null,
          timezone: dto.timezone || 'UTC',
          status: BranchStatus.ACTIVE,
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId,
        action: 'BRANCH_CREATED',
        entity: 'branch',
        entityId: branch.id,
        metadata: {
          name: branch.name,
          slug: branch.slug,
          branchCode: branch.branchCode,
        },
        ipAddress,
        userAgent,
      });

      this.logger.log(
        `Branch ${branch.id} (${branch.name}) created in org ${organizationId} by user ${userId}`,
        'BranchesService',
      );

      return {
        id: branch.id,
        organizationId: branch.organizationId,
        name: branch.name,
        slug: branch.slug,
        branchCode: branch.branchCode,
        description: branch.description,
        email: branch.email,
        phone: branch.phone,
        website: branch.website,
        logoUrl: branch.logoUrl,
        addressLine1: branch.addressLine1,
        addressLine2: branch.addressLine2,
        city: branch.city,
        state: branch.state,
        country: branch.country,
        postalCode: branch.postalCode,
        timezone: branch.timezone,
        status: branch.status as BranchStatus,
        createdAt: branch.createdAt.toISOString(),
        updatedAt: branch.updatedAt.toISOString(),
        staffCount: 0,
      };
    });
  }

  /**
   * Lists branches with server-side pagination, search, and status filtering
   */
  async listBranches(
    organizationId: string,
    query: BranchQueryInput,
    userContext?: AuthenticatedUserContext,
  ): Promise<PaginatedResult<BranchData>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const where: Prisma.BranchWhereInput = {
        organizationId,
      };

      if (query.status) {
        where.status = query.status as BranchStatus;
      }

      if (query.city) {
        where.city = { contains: query.city, mode: 'insensitive' };
      }

      if (query.state) {
        where.state = { contains: query.state, mode: 'insensitive' };
      }

      if (query.search) {
        const search = query.search.trim();
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { branchCode: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
          { state: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Restrict staff without owner/admin authority to their assigned branches
      if (
        userContext &&
        (userContext.role === UserRole.RECEPTIONIST ||
          userContext.role === UserRole.TRAINER)
      ) {
        const userAssignments = await tx.branchStaffAssignment.findMany({
          where: {
            organizationId,
            organizationUser: { userId: userContext.id },
            status: 'ACTIVE',
          },
          select: { branchId: true },
        });

        const assignedBranchIds = userAssignments.map((a) => a.branchId);
        where.id = { in: assignedBranchIds };
      }

      const [total, branches] = await Promise.all([
        tx.branch.count({ where }),
        tx.branch.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            [query.sortBy || 'createdAt']: query.sortOrder || 'desc',
          },
          include: {
            _count: {
              select: { staffAssignments: true },
            },
          },
        }),
      ]);

      const items: BranchData[] = branches.map((b) => ({
        id: b.id,
        organizationId: b.organizationId,
        name: b.name,
        slug: b.slug,
        branchCode: b.branchCode,
        description: b.description,
        email: b.email,
        phone: b.phone,
        website: b.website,
        logoUrl: b.logoUrl,
        addressLine1: b.addressLine1,
        addressLine2: b.addressLine2,
        city: b.city,
        state: b.state,
        country: b.country,
        postalCode: b.postalCode,
        timezone: b.timezone,
        status: b.status as BranchStatus,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
        staffCount: b._count.staffAssignments,
      }));

      const totalPages = Math.ceil(total / limit);

      return {
        items,
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    });
  }

  /**
   * Retrieves single branch by ID with tenant and role validation
   */
  async getBranchById(
    organizationId: string,
    branchId: string,
    userContext?: AuthenticatedUserContext,
  ): Promise<BranchData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const branch = await tx.branch.findUnique({
        where: { id: branchId },
        include: {
          _count: {
            select: { staffAssignments: true },
          },
        },
      });

      if (!branch || branch.organizationId !== organizationId) {
        throw new NotFoundException('Branch not found');
      }

      // Check staff access permission
      if (
        userContext &&
        (userContext.role === UserRole.RECEPTIONIST ||
          userContext.role === UserRole.TRAINER)
      ) {
        const assignment = await tx.branchStaffAssignment.findFirst({
          where: {
            branchId,
            organizationId,
            organizationUser: { userId: userContext.id },
            status: 'ACTIVE',
          },
        });

        if (!assignment) {
          throw new ForbiddenException(
            'Forbidden: You are not assigned to this branch',
          );
        }
      }

      return {
        id: branch.id,
        organizationId: branch.organizationId,
        name: branch.name,
        slug: branch.slug,
        branchCode: branch.branchCode,
        description: branch.description,
        email: branch.email,
        phone: branch.phone,
        website: branch.website,
        logoUrl: branch.logoUrl,
        addressLine1: branch.addressLine1,
        addressLine2: branch.addressLine2,
        city: branch.city,
        state: branch.state,
        country: branch.country,
        postalCode: branch.postalCode,
        timezone: branch.timezone,
        status: branch.status as BranchStatus,
        createdAt: branch.createdAt.toISOString(),
        updatedAt: branch.updatedAt.toISOString(),
        staffCount: branch._count.staffAssignments,
      };
    });
  }

  /**
   * Updates branch details
   */
  async updateBranch(
    organizationId: string,
    branchId: string,
    dto: UpdateBranchInput,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<BranchData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.branch.findUnique({
        where: { id: branchId },
      });

      if (!existing || existing.organizationId !== organizationId) {
        throw new NotFoundException('Branch not found');
      }

      if (existing.status === BranchStatus.CLOSED) {
        throw new BadRequestException('Cannot modify a permanently closed branch');
      }

      let newSlug: string | undefined = undefined;
      if (dto.slug) {
        newSlug = this.slugify(dto.slug);
        if (newSlug !== existing.slug) {
          const duplicate = await tx.branch.findUnique({
            where: {
              unique_org_branch_slug: {
                organizationId,
                slug: newSlug,
              },
            },
          });
          if (duplicate) {
            throw new ConflictException(`Branch slug '${newSlug}' is already in use`);
          }
        }
      }

      let newBranchCode: string | undefined = undefined;
      if (dto.branchCode) {
        newBranchCode = dto.branchCode.toUpperCase().trim();
        if (newBranchCode !== existing.branchCode) {
          const duplicate = await tx.branch.findUnique({
            where: {
              unique_org_branch_code: {
                organizationId,
                branchCode: newBranchCode,
              },
            },
          });
          if (duplicate) {
            throw new ConflictException(
              `Branch code '${newBranchCode}' is already in use`,
            );
          }
        }
      }

      const updated = await tx.branch.update({
        where: { id: branchId },
        data: {
          name: dto.name ? dto.name.trim() : undefined,
          slug: newSlug,
          branchCode: newBranchCode,
          description: dto.description !== undefined ? dto.description : undefined,
          email: dto.email !== undefined ? (dto.email || null) : undefined,
          phone: dto.phone !== undefined ? dto.phone : undefined,
          website: dto.website !== undefined ? (dto.website || null) : undefined,
          logoUrl: dto.logoUrl !== undefined ? (dto.logoUrl || null) : undefined,
          addressLine1: dto.addressLine1 !== undefined ? dto.addressLine1 : undefined,
          addressLine2: dto.addressLine2 !== undefined ? dto.addressLine2 : undefined,
          city: dto.city !== undefined ? dto.city : undefined,
          state: dto.state !== undefined ? dto.state : undefined,
          country: dto.country !== undefined ? dto.country : undefined,
          postalCode: dto.postalCode !== undefined ? dto.postalCode : undefined,
          timezone: dto.timezone !== undefined ? dto.timezone : undefined,
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId,
        action: 'BRANCH_UPDATED',
        entity: 'branch',
        entityId: branchId,
        metadata: { changes: dto },
        ipAddress,
        userAgent,
      });

      return {
        id: updated.id,
        organizationId: updated.organizationId,
        name: updated.name,
        slug: updated.slug,
        branchCode: updated.branchCode,
        description: updated.description,
        email: updated.email,
        phone: updated.phone,
        website: updated.website,
        logoUrl: updated.logoUrl,
        addressLine1: updated.addressLine1,
        addressLine2: updated.addressLine2,
        city: updated.city,
        state: updated.state,
        country: updated.country,
        postalCode: updated.postalCode,
        timezone: updated.timezone,
        status: updated.status as BranchStatus,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Updates branch status (ACTIVE, INACTIVE, CLOSED)
   */
  async updateBranchStatus(
    organizationId: string,
    branchId: string,
    dto: UpdateBranchStatusInput,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<BranchData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.branch.findUnique({
        where: { id: branchId },
      });

      if (!existing || existing.organizationId !== organizationId) {
        throw new NotFoundException('Branch not found');
      }

      // Validate transitions: Permanently CLOSED branches cannot be reopened
      if (existing.status === BranchStatus.CLOSED && dto.status !== BranchStatus.CLOSED) {
        throw new BadRequestException(
          'Closed branches have permanently ceased operations and cannot be reactivated',
        );
      }

      if (existing.status === dto.status) {
        return {
          id: existing.id,
          organizationId: existing.organizationId,
          name: existing.name,
          slug: existing.slug,
          branchCode: existing.branchCode,
          description: existing.description,
          email: existing.email,
          phone: existing.phone,
          website: existing.website,
          logoUrl: existing.logoUrl,
          addressLine1: existing.addressLine1,
          addressLine2: existing.addressLine2,
          city: existing.city,
          state: existing.state,
          country: existing.country,
          postalCode: existing.postalCode,
          timezone: existing.timezone,
          status: existing.status as BranchStatus,
          createdAt: existing.createdAt.toISOString(),
          updatedAt: existing.updatedAt.toISOString(),
        };
      }

      const updated = await tx.branch.update({
        where: { id: branchId },
        data: { status: dto.status as BranchStatus },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId,
        action: `BRANCH_STATUS_${dto.status}`,
        entity: 'branch',
        entityId: branchId,
        metadata: {
          previousStatus: existing.status,
          newStatus: dto.status,
        },
        ipAddress,
        userAgent,
      });

      return {
        id: updated.id,
        organizationId: updated.organizationId,
        name: updated.name,
        slug: updated.slug,
        branchCode: updated.branchCode,
        description: updated.description,
        email: updated.email,
        phone: updated.phone,
        website: updated.website,
        logoUrl: updated.logoUrl,
        addressLine1: updated.addressLine1,
        addressLine2: updated.addressLine2,
        city: updated.city,
        state: updated.state,
        country: updated.country,
        postalCode: updated.postalCode,
        timezone: updated.timezone,
        status: updated.status as BranchStatus,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }
}
