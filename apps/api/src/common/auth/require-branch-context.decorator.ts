import { SetMetadata } from '@nestjs/common';

export const REQUIRE_BRANCH_CONTEXT_KEY = 'require_branch_context';

export interface RequireBranchContextOptions {
  required?: boolean;
  allowInactive?: boolean;
}

/**
 * Declares that an endpoint is branch-scoped.
 * The BranchContextGuard will extract and validate `x-branch-id` header or `branchId` parameter.
 */
export const RequireBranchContext = (
  options: RequireBranchContextOptions = { required: true, allowInactive: false },
) => SetMetadata(REQUIRE_BRANCH_CONTEXT_KEY, options);
