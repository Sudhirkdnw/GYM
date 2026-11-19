import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUIRE_BRANCH_CONTEXT_KEY,
  RequireBranchContextOptions,
} from './require-branch-context.decorator';
import { BranchContextService } from '../tenant/branch-context.service';
import { AuthenticatedUserContext } from '@gymos/shared-types';

@Injectable()
export class BranchContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly branchContextService: BranchContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RequireBranchContextOptions>(
      REQUIRE_BRANCH_CONTEXT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If endpoint is not decorated with @RequireBranchContext, pass through
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUserContext | undefined = request.user;
    const orgId: string | undefined = request.organizationId || user?.organizationId;

    if (!orgId) {
      throw new BadRequestException(
        'Active organization context required before resolving branch context',
      );
    }

    // Extract branch ID candidate from headers (preferred) or route params / query
    const branchIdCandidate: string | undefined =
      (request.headers['x-branch-id'] as string) ||
      request.params?.branchId ||
      (request.query?.branchId as string);

    if (!branchIdCandidate) {
      if (options.required !== false) {
        throw new BadRequestException(
          'Branch context required: Missing x-branch-id header or branchId parameter',
        );
      }
      return true;
    }

    if (!user) {
      throw new BadRequestException('Authenticated user required for branch access validation');
    }

    // Validate branch ownership, status, and staff access permissions
    const validatedBranch = await this.branchContextService.validateBranchAccess(
      orgId,
      branchIdCandidate,
      user,
      { allowInactive: options.allowInactive },
    );

    // Attach validated branch to request object
    request.branch = validatedBranch;
    request.branchId = validatedBranch.id;

    return true;
  }
}
