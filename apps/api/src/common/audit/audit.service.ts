import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AppLoggerService } from '../../logging/app-logger.service';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'accesstoken',
  'resettoken',
  'verificationtoken',
  'tokenhash',
  'secret',
  'cookie',
  'authorization',
]);

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLoggerService,
  ) {}

  /**
   * Sanitizes metadata by stripping sensitive credentials
   */
  public sanitizeMetadata(data: unknown): Prisma.InputJsonValue {
    if (!data || typeof data !== 'object') {
      return (data as Prisma.InputJsonValue) ?? {};
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeMetadata(item)) as unknown as Prisma.InputJsonValue;
    }

    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        clean[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        clean[key] = this.sanitizeMetadata(value);
      } else {
        clean[key] = value;
      }
    }
    return clean as Prisma.InputJsonValue;
  }

  /**
   * Record audit log within an existing transaction
   */
  async recordInTransaction(
    tx: Prisma.TransactionClient,
    params: {
      organizationId?: string | null;
      userId?: string | null;
      action: string;
      entity: string;
      entityId?: string | null;
      metadata?: Record<string, unknown> | null;
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ): Promise<void> {
    try {
      await tx.auditLog.create({
        data: {
          organizationId: params.organizationId || null,
          userId: params.userId || null,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId || null,
          metadata: params.metadata ? this.sanitizeMetadata(params.metadata) : undefined,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent ? params.userAgent.slice(0, 500) : null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to record audit log for action: ${params.action}`,
        error instanceof Error ? error.stack : undefined,
        'AuditService',
      );
    }
  }

  /**
   * Record standalone audit log with tenant context
   */
  async record(params: {
    organizationId: string;
    userId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    metadata?: Record<string, unknown> | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    try {
      await this.prisma.withTenantContext(params.organizationId, async (tx) => {
        await this.recordInTransaction(tx, params);
      });
    } catch (error) {
      this.logger.error(
        `Failed to record audit log for action: ${params.action}`,
        error instanceof Error ? error.stack : undefined,
        'AuditService',
      );
    }
  }
}
