import { Module } from '@nestjs/common';
import { EnvelopeEncryptionService } from './encryption/envelope-encryption.service';
import { PhysicalPasscodeService } from './physical-passcode.service';
import { QrTokenService } from './qr-token.service';
import { AttendanceService } from './attendance.service';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [RedisModule],
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
