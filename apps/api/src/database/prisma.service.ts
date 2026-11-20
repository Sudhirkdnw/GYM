import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { AppLoggerService } from '../logging/app-logger.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly logger: AppLoggerService) {
    super({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('Initializing database connection...', 'PrismaService');
      await this.$connect();
      this.logger.log('Database connection established successfully', 'PrismaService');
    } catch (error) {
      this.logger.error(
        'Failed to connect to PostgreSQL database during initialization',
        error instanceof Error ? error.stack : undefined,
        'PrismaService',
      );
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting database client...', 'PrismaService');
    await this.$disconnect();
    this.logger.log('Database client disconnected', 'PrismaService');
  }

  async isHealthy(): Promise<{ isHealthy: boolean; latencyMs: number; message?: string }> {
    const start = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      return {
        isHealthy: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        isHealthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  /**
   * Executes a database operation within a trusted, tenant-scoped PostgreSQL transaction.
   * Sets session variable `app.current_tenant_id` locally inside the transaction using `SET LOCAL`.
   * Automatically cleared when transaction commits or rolls back.
   */
  async withTenantContext<T>(
    tenantId: string,
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
    isSuperAdmin = false,
  ): Promise<T> {
    if (!UUID_REGEX.test(tenantId)) {
      throw new Error(`Invalid tenant ID format: ${tenantId}`);
    }

    return this.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}';`);
        if (isSuperAdmin) {
          await tx.$executeRawUnsafe(`SET LOCAL app.is_super_admin = 'true';`);
        }
        return callback(tx);
      },
      { maxWait: 10000, timeout: 15000 },
    );
  }

  /**
   * Executes a database operation with Super Admin privileges across all tenants.
   */
  async withSuperAdminContext<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.is_super_admin = 'true';`);
        return callback(tx);
      },
      { maxWait: 10000, timeout: 15000 },
    );
  }
}
