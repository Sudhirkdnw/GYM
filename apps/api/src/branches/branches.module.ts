import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BranchesService } from './branches.service';
import { BranchStaffService } from './branch-staff.service';
import { BranchesController } from './branches.controller';
import { UserBranchesController } from './user-branches.controller';
import { DatabaseModule } from '../database/database.module';
import { BranchContextGuard } from '../common/auth/branch-context.guard';

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [BranchesController, UserBranchesController],
  providers: [BranchesService, BranchStaffService, BranchContextGuard],
  exports: [BranchesService, BranchStaffService, BranchContextGuard],
})
export class BranchesModule {}
