import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class MemberNumberService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomically generates a sequential member number for the organization.
   * Uses INSERT ... ON CONFLICT DO UPDATE RETURNING current_value.
   * Format: MEM-00001
   */
  async generateMemberNumber(
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const client = tx || this.prisma;
    const result = await client.$queryRawUnsafe<{ current_value: number }[]>(
      `INSERT INTO organization_member_sequences (organization_id, current_value, updated_at)
       VALUES ($1::uuid, 1, NOW())
       ON CONFLICT (organization_id)
       DO UPDATE SET current_value = organization_member_sequences.current_value + 1, updated_at = NOW()
       RETURNING current_value;`,
      organizationId,
    );

    const nextVal = result[0]?.current_value ?? 1;
    const padded = String(nextVal).padStart(5, '0');
    return `MEM-${padded}`;
  }
}
