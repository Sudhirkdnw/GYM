import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextData {
  organizationId: string;
  userId?: string;
  role?: string;
  isSuperAdmin?: boolean;
  branchId?: string;
}

export const tenantAsyncLocalStorage = new AsyncLocalStorage<TenantContextData>();

export class TenantContextStore {
  static get(): TenantContextData | undefined {
    return tenantAsyncLocalStorage.getStore();
  }

  static getOrganizationId(): string | undefined {
    return tenantAsyncLocalStorage.getStore()?.organizationId;
  }

  static getBranchId(): string | undefined {
    return tenantAsyncLocalStorage.getStore()?.branchId;
  }

  static run<R>(context: TenantContextData, fn: () => R): R {
    return tenantAsyncLocalStorage.run(context, fn);
  }
}
