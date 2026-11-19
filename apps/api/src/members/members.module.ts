import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { MemberNumberService } from './member-number.service';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../common/audit/audit.module';
import { LoggingModule } from '../logging/logging.module';
import { TenantModule } from '../common/tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';
import { BranchContextGuard } from '../common/auth/branch-context.guard';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    LoggingModule,
    TenantModule,
    AuthModule,
    JwtModule.register({}),
  ],
  controllers: [MembersController],
  providers: [MembersService, MemberNumberService, BranchContextGuard],
  exports: [MembersService, MemberNumberService, BranchContextGuard],
})
export class MembersModule {}
