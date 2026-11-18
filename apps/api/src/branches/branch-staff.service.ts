import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AppLoggerService } from '../logging/app-logger.service';
import { AssignBranchStaffInput } from './dto/branch.dto';
import {
  BranchStaffAssignmentData,
  AssignmentStatus,
  BranchStatus,
  UserRole,
} from '@gymos/shared-types';

@Injectable()
export class BranchStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly logger: AppLoggerService,
  ) {}

  /**
   * Assigns an organization staff member to a branch
   */
  async assignStaff(
    organizationId: string,
    branchId: string,
    dto: AssignBranchStaffInput,
    assignedByUserId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<BranchStaffAssignmentData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // 1. Validate branch exists and belongs to organization
      const branch = await tx.branch.findUnique({
        where: { id: branchId },
      });

      if (!branch || branch.organizationId !== organizationId) {
        throw new NotFoundException('Branch not found');
      }

      // Inactive or closed branch cannot receive new assignments
      if (branch.status !== BranchStatus.ACTIVE) {
        throw new BadRequestException(
          `Cannot assign staff to a branch that is ${branch.status.toLowerCase()}`,
        );
      }

      // 2. Validate organization user exists and belongs to the same organization
      const orgUser = await tx.organizationUser.findUnique({
        where: { id: dto.organizationUserId },
        include: { user: true },
      });

      if (!orgUser || orgUser.organizationId !== organizationId) {
        throw new BadRequestException(
          'Staff member does not belong to this organization',
        );
      }

      // 3. Check existing assignment
      const existingAssignment = await tx.branchStaffAssignment.findUnique({
        where: {
          unique_branch_org_user: {
            branchId,
            organizationUserId: dto.organizationUserId,
          },
        },
      });

      if (existingAssignment && existingAssignment.status === AssignmentStatus.ACTIVE) {
        throw new ConflictException(
          'Staff member is already actively assigned to this branch',
        );
      }

      let assignment;
      if (existingAssignment) {
        // Reactivate previously inactive assignment
        assignment = await tx.branchStaffAssignment.update({
          where: { id: existingAssignment.id },
          data: {
            status: AssignmentStatus.ACTIVE,
            assignedAt: new Date(),
            assignedBy: assignedByUserId,
          },
          include: {
            organizationUser: {
              include: { user: true },
            },
            branch: true,
          },
        });
      } else {
        assignment = await tx.branchStaffAssignment.create({
          data: {
            organizationId,
            branchId,
            organizationUserId: dto.organizationUserId,
            status: AssignmentStatus.ACTIVE,
            assignedBy: assignedByUserId,
          },
          include: {
            organizationUser: {
              include: { user: true },
            },
            branch: true,
          },
        });
      }

      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId: assignedByUserId,
        action: 'STAFF_ASSIGNED_TO_BRANCH',
        entity: 'branch_staff_assignment',
        entityId: assignment.id,
        metadata: {
          branchId,
          branchName: branch.name,
          organizationUserId: dto.organizationUserId,
          assignedUserId: orgUser.userId,
        },
        ipAddress,
        userAgent,
      });

      this.logger.log(
        `Staff member ${dto.organizationUserId} assigned to branch ${branchId} by ${assignedByUserId}`,
        'BranchStaffService',
      );

      return {
        id: assignment.id,
        organizationId: assignment.organizationId,
        branchId: assignment.branchId,
        organizationUserId: assignment.organizationUserId,
        status: assignment.status as AssignmentStatus,
        assignedAt: assignment.assignedAt.toISOString(),
        assignedBy: assignment.assignedBy,
        createdAt: assignment.createdAt.toISOString(),
        updatedAt: assignment.updatedAt.toISOString(),
        user: {
          id: assignment.organizationUser.user.id,
          email: assignment.organizationUser.user.email,
          firstName: assignment.organizationUser.user.firstName,
          lastName: assignment.organizationUser.user.lastName,
          role: assignment.organizationUser.role as UserRole,
        },
        branch: {
          id: assignment.branch.id,
          name: assignment.branch.name,
          branchCode: assignment.branch.branchCode,
          status: assignment.branch.status as BranchStatus,
        },
      };
    });
  }

  /**
   * Lists all staff assignments for a specific branch
   */
  async listBranchStaff(
    organizationId: string,
    branchId: string,
  ): Promise<BranchStaffAssignmentData[]> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const branch = await tx.branch.findUnique({
        where: { id: branchId },
      });

      if (!branch || branch.organizationId !== organizationId) {
        throw new NotFoundException('Branch not found');
      }

      const assignments = await tx.branchStaffAssignment.findMany({
        where: {
          branchId,
          organizationId,
        },
        include: {
          organizationUser: {
            include: { user: true },
          },
          branch: true,
        },
        orderBy: { assignedAt: 'desc' },
      });

      return assignments.map((a) => ({
        id: a.id,
        organizationId: a.organizationId,
        branchId: a.branchId,
        organizationUserId: a.organizationUserId,
        status: a.status as AssignmentStatus,
        assignedAt: a.assignedAt.toISOString(),
        assignedBy: a.assignedBy,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        user: {
          id: a.organizationUser.user.id,
          email: a.organizationUser.user.email,
          firstName: a.organizationUser.user.firstName,
          lastName: a.organizationUser.user.lastName,
          role: a.organizationUser.role as UserRole,
        },
        branch: {
          id: a.branch.id,
          name: a.branch.name,
          branchCode: a.branch.branchCode,
          status: a.branch.status as BranchStatus,
        },
      }));
    });
  }

  /**
   * Removes (deactivates) a staff assignment from a branch
   */
  async removeStaff(
    organizationId: string,
    branchId: string,
    organizationUserId: string,
    removedByUserId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const assignment = await tx.branchStaffAssignment.findUnique({
        where: {
          unique_branch_org_user: {
            branchId,
            organizationUserId,
          },
        },
        include: {
          branch: true,
        },
      });

      if (!assignment || assignment.organizationId !== organizationId) {
        throw new NotFoundException('Staff assignment not found for this branch');
      }

      await tx.branchStaffAssignment.update({
        where: { id: assignment.id },
        data: {
          status: AssignmentStatus.INACTIVE,
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId: removedByUserId,
        action: 'STAFF_REMOVED_FROM_BRANCH',
        entity: 'branch_staff_assignment',
        entityId: assignment.id,
        metadata: {
          branchId,
          branchName: assignment.branch.name,
          organizationUserId,
        },
        ipAddress,
        userAgent,
      });

      this.logger.log(
        `Staff member ${organizationUserId} removed from branch ${branchId} by ${removedByUserId}`,
        'BranchStaffService',
      );

      return { success: true, message: 'Staff member removed from branch successfully' };
    });
  }
}
