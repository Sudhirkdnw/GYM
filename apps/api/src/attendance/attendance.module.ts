import { Module } from '@nestjs/common';
import { EnvelopeEncryptionService } from './encryption/envelope-encryption.service';
import { PhysicalPasscodeService } from './physical-passcode.service';
import { QrTokenService } from './qr-token.service';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [
    EnvelopeEncryptionService,
    PhysicalPasscodeService,
    QrTokenService,
  ],
  exports: [
    EnvelopeEncryptionService,
    PhysicalPasscodeService,
    QrTokenService,
  ],
})
export class AttendanceModule {}
