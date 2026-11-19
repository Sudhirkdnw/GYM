import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../common/audit/audit.module';
import { LoggingModule } from '../logging/logging.module';
import { TenantModule } from '../common/tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    LoggingModule,
    TenantModule,
    AuthModule,
    JwtModule.register({}),
  ],
  controllers: [MembershipsController],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
