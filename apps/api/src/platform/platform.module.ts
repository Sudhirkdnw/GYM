import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { EntitlementModule } from '../common/entitlements/entitlement.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule, EntitlementModule],
  controllers: [PlatformController],
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
