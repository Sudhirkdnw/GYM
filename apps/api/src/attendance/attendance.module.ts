import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EnvelopeEncryptionService } from './encryption/envelope-encryption.service';
import { PhysicalPasscodeService } from './physical-passcode.service';
import { QrTokenService } from './qr-token.service';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { RedisModule } from '../common/redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { TenantModule } from '../common/tenant/tenant.module';

@Module({
  imports: [
    RedisModule,
    AuthModule,
    DatabaseModule,
    TenantModule,
    JwtModule.register({}),
  ],
  controllers: [AttendanceController],
  providers: [
    EnvelopeEncryptionService,
    PhysicalPasscodeService,
    QrTokenService,
    AttendanceService,
  ],
  exports: [
    EnvelopeEncryptionService,
    PhysicalPasscodeService,
    QrTokenService,
    AttendanceService,
  ],
})
export class AttendanceModule {}
