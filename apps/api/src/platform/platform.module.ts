import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformSettingsController } from './settings/platform-settings.controller';
import { PlatformSettingsService } from './settings/platform-settings.service';
import { PlatformEncryptionService } from './settings/platform-encryption.service';
import { EntitlementModule } from '../common/entitlements/entitlement.module';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../common/audit/audit.module';

@Module({
  imports: [DatabaseModule, EntitlementModule, AuthModule, AuditModule],
  controllers: [PlatformController, PlatformSettingsController],
  providers: [
    PlatformService,
    PlatformSettingsService,
    PlatformEncryptionService,
  ],
  exports: [PlatformService, PlatformSettingsService, PlatformEncryptionService],
})
export class PlatformModule {}
