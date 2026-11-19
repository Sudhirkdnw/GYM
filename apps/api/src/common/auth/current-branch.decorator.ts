import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { BranchData } from '@gymos/shared-types';

/**
 * Injects the validated BranchData resolved by BranchContextGuard into controller handlers.
 */
export const CurrentBranch = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): BranchData | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.branch || null;
  },
);
