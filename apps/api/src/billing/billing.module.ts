import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
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
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
