import { Global, Module } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { BranchContextService } from './branch-context.service';

@Global()
@Module({
  providers: [TenantContextService, BranchContextService],
  exports: [TenantContextService, BranchContextService],
})
export class TenantModule {}
