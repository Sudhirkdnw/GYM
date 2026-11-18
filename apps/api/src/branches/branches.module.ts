import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BranchesService } from './branches.service';
import { BranchStaffService } from './branch-staff.service';
import { BranchesController } from './branches.controller';
import { UserBranchesController } from './user-branches.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [BranchesController, UserBranchesController],
  providers: [BranchesService, BranchStaffService],
  exports: [BranchesService, BranchStaffService],
})
export class BranchesModule {}
