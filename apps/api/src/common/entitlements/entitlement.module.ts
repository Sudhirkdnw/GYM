import { Module, Global } from '@nestjs/common';
import { EntitlementService } from './entitlement.service';
import { EntitlementGuard } from '../auth/entitlement.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';

@Global()
@Module({
  providers: [EntitlementService, EntitlementGuard, SuperAdminGuard],
  exports: [EntitlementService, EntitlementGuard, SuperAdminGuard],
})
export class EntitlementModule {}
