import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { EntitlementModule } from '../common/entitlements/entitlement.module';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, EntitlementModule, AuthModule],
  controllers: [PlatformController],
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
