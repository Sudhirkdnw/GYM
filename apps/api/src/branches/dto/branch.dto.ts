import {
  createBranchSchema,
  CreateBranchInput,
  updateBranchSchema,
  UpdateBranchInput,
  updateBranchStatusSchema,
  UpdateBranchStatusInput,
  branchQuerySchema,
  BranchQueryInput,
  assignBranchStaffSchema,
  AssignBranchStaffInput,
  selectBranchSchema,
  SelectBranchInput,
} from '@gymos/validation';

export type {
  CreateBranchInput,
  UpdateBranchInput,
  UpdateBranchStatusInput,
  BranchQueryInput,
  AssignBranchStaffInput,
  SelectBranchInput,
};

export {
  createBranchSchema,
  updateBranchSchema,
  updateBranchStatusSchema,
  branchQuerySchema,
  assignBranchStaffSchema,
  selectBranchSchema,
};
