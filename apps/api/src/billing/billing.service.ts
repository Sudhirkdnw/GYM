import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AppLoggerService } from '../logging/app-logger.service';
import {
  UserRole,
  InvoiceStatus,
  InvoiceItemType,
  PaymentMethod,
  PaymentStatus,
  AllocationStatus,
  RefundStatus,
  CreditEntryType,
  InvoiceData,
  InvoiceDetailData,
  PaymentData,
  PaymentDetailData,
  PaymentAllocationData,
  RefundData,
  MemberCreditAccountData,
  MemberCreditEntryData,
  FinancialKpiData,
  OutstandingDuesSummaryData,
  PaymentMethodDistributionData,
  BranchPerformanceData,
  PaginatedResult,
} from '@gymos/shared-types';
import {
  InvoiceStatus as PrismaInvoiceStatus,
  AllocationStatus as PrismaAllocationStatus,
  PaymentStatus as PrismaPaymentStatus,
  CreditEntryType as PrismaCreditEntryType,
  Prisma,
} from '@prisma/client';
import {
  CreateInvoiceInput,
  VoidInvoiceInput,
  RecordPaymentInput,
  ProcessRefundInput,
  DepositCreditInput,
  ApplyCreditInput,
  InvoiceQueryInput,
  PaymentQueryInput,
  DuesQueryInput,
} from '@gymos/validation';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLoggerService,
  ) {}

  // ===========================================================================
  // HELPER UTILITIES
  // ===========================================================================

  /**
   * Computes the Indian Financial Year string (e.g. "2026-27") for a given date.
   * In India, Financial Year starts April 1 and ends March 31.
   */
  public getFinancialYear(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed: Jan=0, Mar=2, Apr=3, Dec=11
    if (month >= 3) {
      const startYear = year;
      const endYear = (year + 1) % 100;
      return `${startYear}-${String(endYear).padStart(2, '0')}`;
    } else {
      const startYear = year - 1;
      const endYear = year % 100;
      return `${startYear}-${String(endYear).padStart(2, '0')}`;
    }
  }

  /**
   * Atomically increments and retrieves the sequential number for an organization and FY.
   */
  private async getNextSequence(
    tx: Prisma.TransactionClient,
    organizationId: string,
    sequenceType: 'INVOICE' | 'PAYMENT' | 'REFUND',
    financialYear: string,
  ): Promise<number> {
    const seq = await tx.organizationBillingSequence.upsert({
      where: {
        unique_org_seq_type_fy: {
          organizationId,
          sequenceType,
          financialYear,
        },
      },
      create: {
        organizationId,
        sequenceType,
        financialYear,
        lastNumber: 1,
      },
      update: {
        lastNumber: { increment: 1 },
      },
    });
    return seq.lastNumber;
  }

  /**
   * Enforces staff branch scoping for branch managers and receptionists.
   */
  private async getStaffPermittedBranchIds(
    tx: Prisma.TransactionClient,
    organizationId: string,
    userId: string,
    role: UserRole,
  ): Promise<string[] | null> {
    if (role === UserRole.GYM_OWNER) {
      return null; // Full access across all branches
    }
    const assignments = await tx.branchStaffAssignment.findMany({
      where: {
        organizationId,
        organizationUser: { userId },
        status: 'ACTIVE',
      },
      select: { branchId: true },
    });
    return assignments.map((a) => a.branchId);
  }

  // ===========================================================================
  // 1. INVOICES
  // ===========================================================================

  async createInvoice(
    organizationId: string,
    userId: string,
    role: UserRole,
    dto: CreateInvoiceInput,
    idempotencyKey?: string,
  ): Promise<InvoiceDetailData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // 1. Validate branch access
      const permittedBranches = await this.getStaffPermittedBranchIds(tx, organizationId, userId, role);
      if (permittedBranches && !permittedBranches.includes(dto.branchId)) {
        throw new ForbiddenException('You are not authorized to create invoices for this branch');
      }

      // 2. Fetch Branch and Organization details for tax snapshot
      const [branch, org, member] = await Promise.all([
        tx.branch.findFirst({
          where: { id: dto.branchId, organizationId, status: 'ACTIVE' },
        }),
        tx.organization.findFirst({
          where: { id: organizationId },
        }),
        tx.member.findFirst({
          where: { id: dto.memberId, organizationId },
        }),
      ]);

      if (!branch) {
        throw new BadRequestException('Branch not found or inactive');
      }
      if (!org) {
        throw new NotFoundException('Organization not found');
      }
      if (!member) {
        throw new NotFoundException('Member not found in this organization');
      }

      // 3. Date & Financial Year
      const now = new Date();
      const issueDate = dto.issueDate ? new Date(dto.issueDate) : now;
      const dueDate = dto.dueDate ? new Date(dto.dueDate) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const financialYear = this.getFinancialYear(issueDate);

      // 4. State & Place of Supply (India GST Rules)
      const supplierState = branch.state || org.state || 'Delhi';
      const supplierStateCode = (branch.state && branch.state.length === 2)
        ? branch.state
        : (branch.postalCode?.substring(0, 2) || '07');
      const customerStateCode = (member.state && member.state.length === 2)
        ? member.state
        : supplierStateCode;
      const placeOfSupply = dto.placeOfSupply || customerStateCode;
      const isInterState = supplierStateCode !== placeOfSupply;

      // 5. Line items calculation
      let subtotal = new Prisma.Decimal(0);
      let lineDiscounts = new Prisma.Decimal(0);
      let taxableAmount = new Prisma.Decimal(0);
      let cgstAmount = new Prisma.Decimal(0);
      let sgstAmount = new Prisma.Decimal(0);
      let igstAmount = new Prisma.Decimal(0);
      let totalTaxAmount = new Prisma.Decimal(0);
      let totalAmount = new Prisma.Decimal(0);

      const computedItems = dto.items.map((item) => {
        const qty = new Prisma.Decimal(item.quantity || 1);
        const unitPrice = new Prisma.Decimal(item.unitPrice);
        const itemDiscount = new Prisma.Decimal(item.discountAmount || 0);
        const gross = qty.mul(unitPrice);
        const discounted = gross.sub(itemDiscount);
        const taxRate = new Prisma.Decimal(item.taxRate || 0);

        let itemTaxable: Prisma.Decimal;
        let itemTax: Prisma.Decimal;
        let itemTotal: Prisma.Decimal;

        if (dto.taxMode === 'INCLUSIVE') {
          // Gross price includes tax: Taxable = Gross / (1 + TaxRate/100)
          const divisor = new Prisma.Decimal(1).add(taxRate.div(100));
          itemTaxable = discounted.div(divisor).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
          itemTax = discounted.sub(itemTaxable).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
          itemTotal = discounted;
        } else {
          // Exclusive: Tax = Taxable * TaxRate/100
          itemTaxable = discounted;
          itemTax = itemTaxable.mul(taxRate).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
          itemTotal = itemTaxable.add(itemTax);
        }

        let itemCgstRate = new Prisma.Decimal(0);
        let itemSgstRate = new Prisma.Decimal(0);
        let itemIgstRate = new Prisma.Decimal(0);
        let itemCgstAmount = new Prisma.Decimal(0);
        let itemSgstAmount = new Prisma.Decimal(0);
        let itemIgstAmount = new Prisma.Decimal(0);

        if (isInterState) {
          itemIgstRate = taxRate;
          itemIgstAmount = itemTax;
        } else {
          itemCgstRate = taxRate.div(2);
          itemSgstRate = taxRate.div(2);
          itemCgstAmount = itemTax.div(2).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
          itemSgstAmount = itemTax.sub(itemCgstAmount); // Prevent 1-cent split discrepancy
        }

        subtotal = subtotal.add(dto.taxMode === 'INCLUSIVE' ? itemTaxable : gross);
        lineDiscounts = lineDiscounts.add(itemDiscount);
        taxableAmount = taxableAmount.add(itemTaxable);
        cgstAmount = cgstAmount.add(itemCgstAmount);
        sgstAmount = sgstAmount.add(itemSgstAmount);
        igstAmount = igstAmount.add(itemIgstAmount);
        totalTaxAmount = totalTaxAmount.add(itemTax);
        totalAmount = totalAmount.add(itemTotal);

        return {
          itemType: item.itemType as InvoiceItemType,
          description: item.description,
          sacHsnCode: item.sacHsnCode || '999723',
          quantity: item.quantity,
          unitPrice,
          discountAmount: itemDiscount,
          taxableAmount: itemTaxable,
          taxRate,
          cgstRate: itemCgstRate,
          sgstRate: itemSgstRate,
          igstRate: itemIgstRate,
          taxAmount: itemTax,
          totalAmount: itemTotal,
          membershipId: item.membershipId,
        };
      });

      // Overall invoice level discount
      const invoiceDiscount = new Prisma.Decimal(dto.discountAmount || 0);
      const totalDiscountAmount = lineDiscounts.add(invoiceDiscount);
      if (invoiceDiscount.gt(0)) {
        totalAmount = totalAmount.sub(invoiceDiscount);
      }
      const balanceDue = totalAmount;

      // 6. Transactional Numbering
      const sequenceNumber = await this.getNextSequence(tx, organizationId, 'INVOICE', financialYear);
      const invoiceNumber = `INV/${financialYear}/${String(sequenceNumber).padStart(5, '0')}`;

      // 7. Snapshots
      const supplierSnapshot = {
        legalName: org.legalName || org.name,
        tradeName: org.name,
        branchName: branch.name,
        addressLine1: branch.addressLine1 || org.addressLine1,
        city: branch.city || org.city,
        state: supplierState,
        stateCode: supplierStateCode,
        postalCode: branch.postalCode || org.postalCode,
        gstin: '27AABCU9603R1ZX', // Branch / Org GSTIN
        pan: 'AABCU9603R',
        phone: branch.phone || org.businessPhone,
        email: branch.email || org.businessEmail,
      };

      const customerSnapshot = {
        memberId: member.id,
        memberNumber: member.memberNumber,
        name: `${member.firstName} ${member.lastName}`.trim(),
        email: member.email,
        phone: member.phone,
        addressLine1: member.addressLine1,
        city: member.city,
        state: member.state,
        postalCode: member.postalCode,
        recipientGstin: undefined,
      };

      const taxSnapshot = {
        taxMode: dto.taxMode,
        isInterState,
        placeOfSupply,
        cgstRate: isInterState ? 0 : 9,
        sgstRate: isInterState ? 0 : 9,
        igstRate: isInterState ? 18 : 0,
      };

      // 8. Create Invoice and Line Items
      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          branchId: dto.branchId,
          memberId: dto.memberId,
          invoiceNumber,
          financialYear,
          sequenceNumber,
          issueDate,
          dueDate,
          currency: 'INR',
          subtotal,
          discountAmount: totalDiscountAmount,
          discountReason: dto.discountReason,
          taxableAmount,
          cgstAmount,
          sgstAmount,
          igstAmount,
          cessAmount: new Prisma.Decimal(0),
          totalTaxAmount,
          totalAmount,
          allocatedAmount: new Prisma.Decimal(0),
          balanceDue,
          status: 'ISSUED',
          supplierSnapshot,
          customerSnapshot,
          taxSnapshot,
          placeOfSupply,
          notes: dto.notes,
          terms: dto.terms,
          createdById: userId,
          items: {
            create: computedItems.map((ci) => ({
              organizationId,
              itemType: ci.itemType,
              description: ci.description,
              sacHsnCode: ci.sacHsnCode,
              quantity: ci.quantity,
              unitPrice: ci.unitPrice,
              discountAmount: ci.discountAmount,
              taxableAmount: ci.taxableAmount,
              taxRate: ci.taxRate,
              cgstRate: ci.cgstRate,
              sgstRate: ci.sgstRate,
              igstRate: ci.igstRate,
              taxAmount: ci.taxAmount,
              totalAmount: ci.totalAmount,
              membershipId: ci.membershipId,
            })),
          },
        },
        include: {
          items: true,
          allocations: true,
          member: {
            select: {
              id: true,
              memberNumber: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              branchCode: true,
            },
          },
        },
      });

      // 9. Persist Outbox Event
      await tx.billingOutboxEvent.create({
        data: {
          organizationId,
          aggregateId: invoice.id,
          eventType: 'billing.invoice.issued',
          payload: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            totalAmount: Number(invoice.totalAmount),
            dueDate: invoice.dueDate.toISOString().split('T')[0],
            memberId: member.id,
            memberName: customerSnapshot.name,
            phone: member.phone,
          },
          status: 'PENDING',
          idempotencyKey: idempotencyKey || `outbox-invoice-${invoice.id}`,
        },
      });

      this.logger.log(
        `Invoice ${invoice.invoiceNumber} created for member ${member.memberNumber} in org ${organizationId}`,
        'BillingService',
      );

      return this.mapInvoiceDetail(invoice);
    });
  }

  async getInvoices(
    organizationId: string,
    userId: string,
    role: UserRole,
    query: InvoiceQueryInput,
  ): Promise<PaginatedResult<InvoiceData>> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const permittedBranches = await this.getStaffPermittedBranchIds(tx, organizationId, userId, role);

      const where: Prisma.InvoiceWhereInput = {
        organizationId,
      };

      if (query.branchId) {
        if (permittedBranches && !permittedBranches.includes(query.branchId)) {
          throw new ForbiddenException('You do not have access to this branch');
        }
        where.branchId = query.branchId;
      } else if (permittedBranches) {
        where.branchId = { in: permittedBranches };
      }

      if (query.memberId) {
        where.memberId = query.memberId;
      }

      if (query.status) {
        where.status = query.status as InvoiceStatus;
      }

      if (query.search) {
        where.OR = [
          { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
          { member: { firstName: { contains: query.search, mode: 'insensitive' } } },
          { member: { lastName: { contains: query.search, mode: 'insensitive' } } },
          { member: { phone: { contains: query.search, mode: 'insensitive' } } },
          { member: { memberNumber: { contains: query.search, mode: 'insensitive' } } },
        ];
      }

      if (query.startDate || query.endDate) {
        where.issueDate = {};
        if (query.startDate) where.issueDate.gte = new Date(query.startDate);
        if (query.endDate) where.issueDate.lte = new Date(query.endDate);
      }

      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const [total, records] = await Promise.all([
        tx.invoice.count({ where }),
        tx.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
          include: {
            member: {
              select: {
                id: true,
                memberNumber: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
                branchCode: true,
              },
            },
          },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        items: records.map((r) => this.mapInvoice(r)),
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    });
  }

  async getInvoiceById(
    organizationId: string,
    userId: string,
    role: UserRole,
    invoiceId: string,
  ): Promise<InvoiceDetailData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, organizationId },
        include: {
          items: true,
          allocations: {
            include: {
              reversals: true,
              payment: {
                select: {
                  id: true,
                  paymentNumber: true,
                  method: true,
                  paidAt: true,
                },
              },
            },
          },
          member: {
            select: {
              id: true,
              memberNumber: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              branchCode: true,
            },
          },
        },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      const permittedBranches = await this.getStaffPermittedBranchIds(tx, organizationId, userId, role);
      if (permittedBranches && !permittedBranches.includes(invoice.branchId)) {
        throw new ForbiddenException('You do not have access to this branch invoice');
      }

      return this.mapInvoiceDetail(invoice);
    });
  }

  async voidInvoice(
    organizationId: string,
    userId: string,
    role: UserRole,
    invoiceId: string,
    dto: VoidInvoiceInput,
  ): Promise<InvoiceData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, organizationId },
        include: { allocations: true },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      const permittedBranches = await this.getStaffPermittedBranchIds(tx, organizationId, userId, role);
      if (permittedBranches && !permittedBranches.includes(invoice.branchId)) {
        throw new ForbiddenException('You are not authorized to void invoices for this branch');
      }

      if (invoice.status === 'VOID') {
        throw new ConflictException('Invoice is already voided');
      }

      // Invariant: Cannot void invoice if any active payment allocations exist
      const activeAllocations = invoice.allocations.filter((a) => a.status === 'ACTIVE');
      if (activeAllocations.length > 0) {
        throw new BadRequestException('Cannot void an invoice with active payments. Please refund or reverse payments first.');
      }

      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'VOID',
          balanceDue: new Prisma.Decimal(0),
          voidedAt: new Date(),
          voidReason: dto.reason,
          voidedById: userId,
        },
        include: {
          member: {
            select: {
              id: true,
              memberNumber: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              branchCode: true,
            },
          },
        },
      });

      // Outbox Event
      await tx.billingOutboxEvent.create({
        data: {
          organizationId,
          aggregateId: invoice.id,
          eventType: 'billing.invoice.voided',
          payload: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            reason: dto.reason,
            voidedBy: userId,
          },
          status: 'PENDING',
          idempotencyKey: `outbox-void-${invoice.id}-${Date.now()}`,
        },
      });

      return this.mapInvoice(updated);
    });
  }

  // ===========================================================================
  // 2. PAYMENTS & ALLOCATIONS
  // ===========================================================================

  async recordPayment(
    organizationId: string,
    userId: string,
    role: UserRole,
    dto: RecordPaymentInput,
    idempotencyKey?: string,
  ): Promise<PaymentDetailData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // 1. Check idempotency if provided
      if (idempotencyKey) {
        const existing = await tx.payment.findUnique({
          where: { idempotencyKey },
          include: {
            allocations: { include: { reversals: true } },
            refunds: true,
            member: {
              select: {
                id: true,
                memberNumber: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
                branchCode: true,
              },
            },
          },
        });
        if (existing) {
          return this.mapPaymentDetail(existing);
        }
      }

      // 2. Validate branch permission
      const permittedBranches = await this.getStaffPermittedBranchIds(tx, organizationId, userId, role);
      if (permittedBranches && !permittedBranches.includes(dto.branchId)) {
        throw new ForbiddenException('You are not authorized to record payments for this branch');
      }

      const member = await tx.member.findFirst({
        where: { id: dto.memberId, organizationId },
      });
      if (!member) {
        throw new NotFoundException('Member not found');
      }

      const now = new Date();
      const paidAt = dto.paidAt ? new Date(dto.paidAt) : now;
      const financialYear = this.getFinancialYear(paidAt);
      const paymentAmount = new Prisma.Decimal(dto.amount);

      // 3. Special handling for MEMBER_CREDIT method
      if (dto.method === 'MEMBER_CREDIT') {
        const wallet = await tx.memberCreditAccount.findUnique({
          where: {
            unique_org_member_currency_credit: {
              organizationId,
              memberId: dto.memberId,
              currency: 'INR',
            },
          },
        });

        if (!wallet || wallet.currentBalance.lt(paymentAmount)) {
          throw new BadRequestException(
            `Insufficient member credit balance (Available: ₹${wallet?.currentBalance || 0}, Required: ₹${paymentAmount})`,
          );
        }

        // Deduct from wallet
        const newBalance = wallet.currentBalance.sub(paymentAmount);
        await tx.memberCreditAccount.update({
          where: { id: wallet.id },
          data: { currentBalance: newBalance },
        });

        // Record credit transaction
        await tx.memberCreditEntry.create({
          data: {
            organizationId,
            creditAccountId: wallet.id,
            entryType: 'CREDIT_APPLIED',
            amount: paymentAmount.negated(),
            description: `Redeemed for payment on ${dto.allocations?.map((a) => a.invoiceId).join(', ') || 'invoices'}`,
            createdById: userId,
            idempotencyKey: idempotencyKey ? `credit-redeem-${idempotencyKey}` : undefined,
          },
        });
      }

      // 4. Sequential receipt number
      const sequenceNumber = await this.getNextSequence(tx, organizationId, 'PAYMENT', financialYear);
      const paymentNumber = `REC/${financialYear}/${String(sequenceNumber).padStart(5, '0')}`;

      // 5. Create Payment record
      const payment = await tx.payment.create({
        data: {
          organizationId,
          branchId: dto.branchId,
          memberId: dto.memberId,
          paymentNumber,
          financialYear,
          sequenceNumber,
          amount: paymentAmount,
          currency: 'INR',
          method: dto.method as PaymentMethod,
          status: dto.method === 'CHEQUE' ? 'PENDING' : 'COMPLETED',
          transactionReference: dto.transactionReference,
          bankName: dto.bankName,
          chequeNumber: dto.chequeNumber,
          chequeDate: dto.chequeDate ? new Date(dto.chequeDate) : undefined,
          paidAt,
          collectedById: userId,
          idempotencyKey,
          notes: dto.notes,
        },
      });

      // 6. Process Allocations
      let totalAllocated = new Prisma.Decimal(0);
      const createdAllocations = [];

      if (dto.allocations && dto.allocations.length > 0) {
        for (const allocReq of dto.allocations) {
          const allocAmount = new Prisma.Decimal(allocReq.amount);
          if (allocAmount.lte(0)) continue;

          // Lock invoice row for update
          const invoice = await tx.invoice.findFirst({
            where: { id: allocReq.invoiceId, organizationId },
          });

          if (!invoice) {
            throw new NotFoundException(`Invoice ${allocReq.invoiceId} not found`);
          }
          if (invoice.status === 'VOID' || invoice.status === 'REFUNDED') {
            throw new BadRequestException(`Cannot allocate payment to invoice in status ${invoice.status}`);
          }
          if (allocAmount.gt(invoice.balanceDue)) {
            throw new BadRequestException(
              `Allocation of ₹${allocAmount} exceeds invoice ${invoice.invoiceNumber} balance due of ₹${invoice.balanceDue}`,
            );
          }

          const allocation = await tx.paymentAllocation.create({
            data: {
              organizationId,
              paymentId: payment.id,
              invoiceId: invoice.id,
              amount: allocAmount,
              status: 'ACTIVE',
            },
          });

          // Update invoice balances and status
          const newAllocated = invoice.allocatedAmount.add(allocAmount);
          const newBalanceDue = invoice.totalAmount.sub(newAllocated);
          const newStatus: PrismaInvoiceStatus = newBalanceDue.lte(0) ? 'PAID' : 'PARTIALLY_PAID';

          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              allocatedAmount: newAllocated,
              balanceDue: newBalanceDue,
              status: newStatus,
            },
          });

          totalAllocated = totalAllocated.add(allocAmount);
          createdAllocations.push(allocation);
        }
      }

      // 7. Check if payment exceeds allocated amount -> Overpayment to MemberCreditAccount
      const excess = paymentAmount.sub(totalAllocated);
      if (excess.gt(0) && dto.retainExcessAsCredit) {
        const wallet = await tx.memberCreditAccount.upsert({
          where: {
            unique_org_member_currency_credit: {
              organizationId,
              memberId: dto.memberId,
              currency: 'INR',
            },
          },
          create: {
            organizationId,
            memberId: dto.memberId,
            currency: 'INR',
            currentBalance: excess,
          },
          update: {
            currentBalance: { increment: excess },
          },
        });

        await tx.memberCreditEntry.create({
          data: {
            organizationId,
            creditAccountId: wallet.id,
            entryType: 'CREDIT_FROM_OVERPAYMENT' as PrismaCreditEntryType,
            amount: excess,
            referenceType: 'PAYMENT',
            referenceId: payment.id,
            description: `Overpayment surplus from payment receipt ${payment.paymentNumber}`,
            createdById: userId,
          },
        });
      }

      // 8. Outbox Event
      await tx.billingOutboxEvent.create({
        data: {
          organizationId,
          aggregateId: payment.id,
          eventType: 'billing.payment.recorded',
          payload: {
            paymentId: payment.id,
            paymentNumber: payment.paymentNumber,
            amount: Number(payment.amount),
            method: payment.method,
            memberId: member.id,
            memberName: `${member.firstName} ${member.lastName}`.trim(),
            allocatedAmount: Number(totalAllocated),
            overpaymentCredit: Number(excess.gt(0) ? excess : 0),
          },
          status: 'PENDING',
          idempotencyKey: idempotencyKey || `outbox-pay-${payment.id}`,
        },
      });

      const completePayment = await tx.payment.findUnique({
        where: { id: payment.id },
        include: {
          allocations: {
            include: {
              reversals: true,
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  totalAmount: true,
                  balanceDue: true,
                  status: true,
                },
              },
            },
          },
          refunds: true,
          member: {
            select: {
              id: true,
              memberNumber: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              branchCode: true,
            },
          },
        },
      });

      return this.mapPaymentDetail(completePayment);
    });
  }

  async getPayments(
    organizationId: string,
    userId: string,
    role: UserRole,
    query: PaymentQueryInput,
  ): Promise<PaginatedResult<PaymentData>> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const permittedBranches = await this.getStaffPermittedBranchIds(tx, organizationId, userId, role);

      const where: Prisma.PaymentWhereInput = {
        organizationId,
      };

      if (query.branchId) {
        if (permittedBranches && !permittedBranches.includes(query.branchId)) {
          throw new ForbiddenException('You do not have access to this branch');
        }
        where.branchId = query.branchId;
      } else if (permittedBranches) {
        where.branchId = { in: permittedBranches };
      }

      if (query.memberId) {
        where.memberId = query.memberId;
      }

      if (query.method) {
        where.method = query.method as PaymentMethod;
      }

      if (query.status) {
        where.status = query.status as PaymentStatus;
      }

      if (query.search) {
        where.OR = [
          { paymentNumber: { contains: query.search, mode: 'insensitive' } },
          { transactionReference: { contains: query.search, mode: 'insensitive' } },
          { member: { firstName: { contains: query.search, mode: 'insensitive' } } },
          { member: { lastName: { contains: query.search, mode: 'insensitive' } } },
          { member: { phone: { contains: query.search, mode: 'insensitive' } } },
        ];
      }

      if (query.startDate || query.endDate) {
        where.paidAt = {};
        if (query.startDate) where.paidAt.gte = new Date(query.startDate);
        if (query.endDate) where.paidAt.lte = new Date(query.endDate);
      }

      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const [total, records] = await Promise.all([
        tx.payment.count({ where }),
        tx.payment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [query.sortBy || 'paidAt']: query.sortOrder || 'desc' },
          include: {
            member: {
              select: {
                id: true,
                memberNumber: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
                branchCode: true,
              },
            },
          },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        items: records.map((r) => this.mapPayment(r)),
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    });
  }

  async getPaymentById(
    organizationId: string,
    userId: string,
    role: UserRole,
    paymentId: string,
  ): Promise<PaymentDetailData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, organizationId },
        include: {
          allocations: {
            include: {
              reversals: true,
              invoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  totalAmount: true,
                  balanceDue: true,
                  status: true,
                },
              },
            },
          },
          refunds: {
            include: { reversals: true },
          },
          member: {
            select: {
              id: true,
              memberNumber: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              branchCode: true,
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      const permittedBranches = await this.getStaffPermittedBranchIds(tx, organizationId, userId, role);
      if (permittedBranches && !permittedBranches.includes(payment.branchId)) {
        throw new ForbiddenException('You do not have access to this payment');
      }

      return this.mapPaymentDetail(payment);
    });
  }

  // ===========================================================================
  // 3. REFUNDS & ALLOCATION REVERSALS
  // ===========================================================================

  async processRefund(
    organizationId: string,
    userId: string,
    role: UserRole,
    paymentId: string,
    dto: ProcessRefundInput,
    idempotencyKey?: string,
  ): Promise<RefundData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // 1. Role Check: Receptionists CANNOT issue refunds
      if (role === UserRole.RECEPTIONIST) {
        throw new ForbiddenException('Receptionists are not authorized to issue refunds');
      }

      // Check idempotency
      if (idempotencyKey) {
        const existing = await tx.refund.findUnique({
          where: { idempotencyKey },
          include: { reversals: true },
        });
        if (existing) {
          return this.mapRefund(existing);
        }
      }

      // 2. Fetch payment with existing refunds and allocations
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, organizationId },
        include: {
          allocations: {
            include: { reversals: true, invoice: true },
          },
          refunds: true,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      const permittedBranches = await this.getStaffPermittedBranchIds(tx, organizationId, userId, role);
      if (permittedBranches && !permittedBranches.includes(payment.branchId)) {
        throw new ForbiddenException('You do not have permission to refund payments for this branch');
      }

      // Invariant: Refund amount cannot exceed unrefunded amount
      const totalRefundedSoFar = payment.refunds.reduce(
        (acc, r) => acc.add(r.amount),
        new Prisma.Decimal(0),
      );
      const unrefundedBalance = payment.amount.sub(totalRefundedSoFar);
      const requestedRefund = new Prisma.Decimal(dto.amount);

      if (requestedRefund.gt(unrefundedBalance)) {
        throw new BadRequestException(
          `Refund amount ₹${requestedRefund} exceeds available unrefunded payment balance of ₹${unrefundedBalance}`,
        );
      }

      const now = new Date();
      const financialYear = this.getFinancialYear(now);
      const sequenceNumber = await this.getNextSequence(tx, organizationId, 'REFUND', financialYear);
      const refundNumber = `REF/${financialYear}/${String(sequenceNumber).padStart(5, '0')}`;

      // 3. Create Refund record
      const refund = await tx.refund.create({
        data: {
          organizationId,
          paymentId: payment.id,
          refundNumber,
          financialYear,
          sequenceNumber,
          amount: requestedRefund,
          method: (dto.method || payment.method) as PaymentMethod,
          reason: dto.reason,
          reference: dto.reference,
          status: 'COMPLETED',
          initiatedById: userId,
          approvedById: userId,
          idempotencyKey,
        },
      });

      // 4. Allocation Reversals Logic
      if (dto.reversals && dto.reversals.length > 0) {
        // Explicit Reversals provided
        let totalReversalAmount = new Prisma.Decimal(0);

        for (const revReq of dto.reversals) {
          const revAmount = new Prisma.Decimal(revReq.amount);
          const targetAlloc = payment.allocations.find((a) => a.id === revReq.allocationId);

          if (!targetAlloc) {
            throw new BadRequestException(`Allocation ${revReq.allocationId} does not belong to this payment`);
          }

          const existingReversed = targetAlloc.reversals.reduce((sum, r) => sum.add(r.amount), new Prisma.Decimal(0));
          const availableToReverse = targetAlloc.amount.sub(existingReversed);

          if (revAmount.gt(availableToReverse)) {
            throw new BadRequestException(
              `Reversal amount ₹${revAmount} exceeds active allocation balance ₹${availableToReverse}`,
            );
          }

          await tx.paymentAllocationReversal.create({
            data: {
              organizationId,
              allocationId: targetAlloc.id,
              refundId: refund.id,
              amount: revAmount,
              reason: dto.reason,
              reversedById: userId,
            },
          });

          // Update allocation status
          const totalRevAfter = existingReversed.add(revAmount);
          const newAllocStatus: PrismaAllocationStatus = totalRevAfter.gte(targetAlloc.amount) ? 'REVERSED' : 'PARTIALLY_REVERSED';
          await tx.paymentAllocation.update({
            where: { id: targetAlloc.id },
            data: { status: newAllocStatus },
          });

          // Recalculate invoice balances
          const invoice = await tx.invoice.findUnique({
            where: { id: targetAlloc.invoiceId },
          });
          if (invoice) {
            const newAllocated = invoice.allocatedAmount.sub(revAmount);
            const newBalanceDue = invoice.totalAmount.sub(newAllocated);
            const newStatus: PrismaInvoiceStatus =
              newBalanceDue.gte(invoice.totalAmount)
                ? (now > invoice.dueDate ? 'OVERDUE' : 'ISSUED')
                : 'PARTIALLY_PAID';

            await tx.invoice.update({
              where: { id: invoice.id },
              data: {
                allocatedAmount: newAllocated,
                balanceDue: newBalanceDue,
                status: newStatus,
              },
            });
          }

          totalReversalAmount = totalReversalAmount.add(revAmount);
        }

        if (!totalReversalAmount.equals(requestedRefund)) {
          throw new BadRequestException(
            `Sum of allocation reversals (₹${totalReversalAmount}) must match refund amount (₹${requestedRefund})`,
          );
        }
      } else {
        // Automatic LIFO Reversal across active allocations:
        // Deterministic LIFO ordering: sort by invoice creation time (most recent invoice first)
        let remainingRefundToDistribute = requestedRefund;

        const sortedAllocations = [...payment.allocations].sort((a, b) => {
          const timeA = new Date(a.invoice?.createdAt || a.createdAt).getTime();
          const timeB = new Date(b.invoice?.createdAt || b.createdAt).getTime();
          if (timeA !== timeB) return timeB - timeA; // Descending (most recent first for LIFO)
          return (b.invoice?.invoiceNumber || '').localeCompare(a.invoice?.invoiceNumber || '');
        });

        for (const targetAlloc of sortedAllocations) {
          if (remainingRefundToDistribute.lte(0)) break;

          const existingReversed = targetAlloc.reversals.reduce((sum, r) => sum.add(r.amount), new Prisma.Decimal(0));
          const availableToReverse = targetAlloc.amount.sub(existingReversed);

          if (availableToReverse.lte(0)) continue;

          const revAmount = Prisma.Decimal.min(remainingRefundToDistribute, availableToReverse);

          await tx.paymentAllocationReversal.create({
            data: {
              organizationId,
              allocationId: targetAlloc.id,
              refundId: refund.id,
              amount: revAmount,
              reason: dto.reason,
              reversedById: userId,
            },
          });

          const totalRevAfter = existingReversed.add(revAmount);
          const newAllocStatus: PrismaAllocationStatus = totalRevAfter.gte(targetAlloc.amount) ? 'REVERSED' : 'PARTIALLY_REVERSED';
          await tx.paymentAllocation.update({
            where: { id: targetAlloc.id },
            data: { status: newAllocStatus },
          });

          // Recalculate invoice balances
          const invoice = await tx.invoice.findUnique({
            where: { id: targetAlloc.invoiceId },
          });
          if (invoice) {
            const newAllocated = invoice.allocatedAmount.sub(revAmount);
            const newBalanceDue = invoice.totalAmount.sub(newAllocated);
            const newStatus: PrismaInvoiceStatus =
              newBalanceDue.gte(invoice.totalAmount)
                ? (now > invoice.dueDate ? 'OVERDUE' : 'ISSUED')
                : 'PARTIALLY_PAID';

            await tx.invoice.update({
              where: { id: invoice.id },
              data: {
                allocatedAmount: newAllocated,
                balanceDue: newBalanceDue,
                status: newStatus,
              },
            });
          }

          remainingRefundToDistribute = remainingRefundToDistribute.sub(revAmount);
        }
      }

      // 5. Update Payment status
      const totalRefundedNow = totalRefundedSoFar.add(requestedRefund);
      const newPaymentStatus: PrismaPaymentStatus = totalRefundedNow.gte(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: newPaymentStatus },
      });

      // 6. Outbox Event
      await tx.billingOutboxEvent.create({
        data: {
          organizationId,
          aggregateId: refund.id,
          eventType: 'billing.refund.issued',
          payload: {
            refundId: refund.id,
            refundNumber: refund.refundNumber,
            paymentId: payment.id,
            amount: Number(refund.amount),
            reason: refund.reason,
          },
          status: 'PENDING',
          idempotencyKey: idempotencyKey || `outbox-ref-${refund.id}`,
        },
      });

      return this.mapRefund(refund);
    });
  }

  // ===========================================================================
  // 4. MEMBER CREDIT ACCOUNTS & LEDGER
  // ===========================================================================

  async getMemberCreditsList(
    organizationId: string,
    query?: { search?: string; page?: number; limit?: number },
  ): Promise<PaginatedResult<MemberCreditAccountData>> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const page = query?.page && query.page > 0 ? query.page : 1;
      const limit = query?.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
      const skip = (page - 1) * limit;

      const where: Prisma.MemberCreditAccountWhereInput = {
        organizationId,
        currentBalance: { gt: 0 },
      };

      if (query?.search) {
        where.member = {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search } },
            { memberNumber: { contains: query.search, mode: 'insensitive' } },
          ],
        };
      }

      const [total, accounts] = await Promise.all([
        tx.memberCreditAccount.count({ where }),
        tx.memberCreditAccount.findMany({
          where,
          include: { member: true },
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limit,
        }),
      ]);

      return {
        items: accounts.map((acc) => ({
          id: acc.id,
          organizationId: acc.organizationId,
          memberId: acc.memberId,
          currency: acc.currency,
          currentBalance: Number(acc.currentBalance),
          createdAt: acc.createdAt.toISOString(),
          updatedAt: acc.updatedAt.toISOString(),
          member: acc.member
            ? {
                id: acc.member.id,
                organizationId: acc.member.organizationId,
                branchId: acc.member.branchId,
                userId: acc.member.userId,
                memberNumber: acc.member.memberNumber,
                firstName: acc.member.firstName,
                lastName: acc.member.lastName,
                preferredName: acc.member.preferredName,
                email: acc.member.email,
                phone: acc.member.phone,
                dateOfBirth: acc.member.dateOfBirth?.toISOString(),
                gender: acc.member.gender as any,
                status: acc.member.status as any,
                addressLine1: acc.member.addressLine1,
                addressLine2: acc.member.addressLine2,
                city: acc.member.city,
                state: acc.member.state,
                postalCode: acc.member.postalCode,
                country: acc.member.country,
                emergencyContactName: acc.member.emergencyContactName,
                emergencyContactPhone: acc.member.emergencyContactPhone,
                emergencyContactRelationship: acc.member.emergencyContactRelationship,
                profilePhotoKey: acc.member.profilePhotoKey,
                notes: acc.member.notes,
                joinedAt: acc.member.joinedAt.toISOString(),
                createdAt: acc.member.createdAt.toISOString(),
                updatedAt: acc.member.updatedAt.toISOString(),
                archivedAt: acc.member.archivedAt?.toISOString(),
              }
            : undefined,
        })),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          hasNextPage: page < (Math.ceil(total / limit) || 1),
          hasPreviousPage: page > 1,
        },
      };
    });
  }

  async getMemberCredit(
    organizationId: string,
    memberId: string,
  ): Promise<MemberCreditAccountData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const account = await tx.memberCreditAccount.upsert({
        where: {
          unique_org_member_currency_credit: {
            organizationId,
            memberId,
            currency: 'INR',
          },
        },
        create: {
          organizationId,
          memberId,
          currency: 'INR',
          currentBalance: new Prisma.Decimal(0),
        },
        update: {},
      });

      return {
        id: account.id,
        organizationId: account.organizationId,
        memberId: account.memberId,
        currency: account.currency,
        currentBalance: Number(account.currentBalance),
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      };
    });
  }

  async getMemberCreditLedger(
    organizationId: string,
    memberId: string,
  ): Promise<MemberCreditEntryData[]> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const account = await tx.memberCreditAccount.findUnique({
        where: {
          unique_org_member_currency_credit: {
            organizationId,
            memberId,
            currency: 'INR',
          },
        },
      });

      if (!account) {
        return [];
      }

      const entries = await tx.memberCreditEntry.findMany({
        where: {
          organizationId,
          creditAccountId: account.id,
        },
        orderBy: { createdAt: 'asc' },
      });

      let running = 0;
      const computed = entries.map((e) => {
        const balanceBefore = running;
        running += Number(e.amount);
        const balanceAfter = running;
        return {
          id: e.id,
          organizationId: e.organizationId,
          creditAccountId: e.creditAccountId,
          entryType: e.entryType as CreditEntryType,
          amount: Number(e.amount),
          balanceBefore,
          balanceAfter,
          referenceType: e.referenceType,
          referenceId: e.referenceId,
          description: e.description,
          idempotencyKey: e.idempotencyKey,
          createdById: e.createdById,
          createdAt: e.createdAt.toISOString(),
        };
      });

      return computed.reverse();
    });
  }

  async depositCredit(
    organizationId: string,
    userId: string,
    role: UserRole,
    memberId: string,
    dto: DepositCreditInput,
    idempotencyKey?: string,
  ): Promise<MemberCreditAccountData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      if (role === UserRole.RECEPTIONIST) {
        throw new ForbiddenException('Receptionists cannot manually deposit credits');
      }

      const depositAmount = new Prisma.Decimal(dto.amount);
      const account = await tx.memberCreditAccount.upsert({
        where: {
          unique_org_member_currency_credit: {
            organizationId,
            memberId,
            currency: 'INR',
          },
        },
        create: {
          organizationId,
          memberId,
          currency: 'INR',
          currentBalance: depositAmount,
        },
        update: {
          currentBalance: { increment: depositAmount },
        },
      });

      await tx.memberCreditEntry.create({
        data: {
          organizationId,
          creditAccountId: account.id,
          entryType: 'CREDIT_ADJUSTMENT' as PrismaCreditEntryType,
          amount: depositAmount,
          referenceType: dto.referenceType || 'MANUAL',
          referenceId: dto.referenceId,
          description: dto.description,
          idempotencyKey,
          createdById: userId,
        },
      });

      const updatedAccount = await tx.memberCreditAccount.findUniqueOrThrow({
        where: { id: account.id },
      });

      return {
        id: updatedAccount.id,
        organizationId: updatedAccount.organizationId,
        memberId: updatedAccount.memberId,
        currency: updatedAccount.currency,
        currentBalance: Number(updatedAccount.currentBalance),
        createdAt: updatedAccount.createdAt.toISOString(),
        updatedAt: updatedAccount.updatedAt.toISOString(),
      };
    });
  }

  async applyCreditToInvoice(
    organizationId: string,
    userId: string,
    role: UserRole,
    memberId: string,
    dto: ApplyCreditInput,
    idempotencyKey?: string,
  ): Promise<PaymentDetailData> {
    const invoice = await this.prisma.withTenantContext(organizationId, async (tx) => {
      return tx.invoice.findFirst({
        where: { id: dto.invoiceId, organizationId, memberId },
      });
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found for this member');
    }

    return this.recordPayment(
      organizationId,
      userId,
      role,
      {
        branchId: invoice.branchId,
        memberId,
        amount: dto.amount,
        method: 'MEMBER_CREDIT',
        notes: `Paid using member store credit`,
        allocations: [{ invoiceId: invoice.id, amount: dto.amount }],
        retainExcessAsCredit: false,
      },
      idempotencyKey,
    );
  }

  // ===========================================================================
  // 5. FINANCIAL REPORTS & DUES
  // ===========================================================================

  async getOutstandingDues(
    organizationId: string,
    userId: string,
    role: UserRole,
    query: DuesQueryInput,
  ): Promise<OutstandingDuesSummaryData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const permittedBranches = await this.getStaffPermittedBranchIds(tx, organizationId, userId, role);

      const where: Prisma.InvoiceWhereInput = {
        organizationId,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
        balanceDue: { gt: 0 },
      };

      if (query.branchId) {
        if (permittedBranches && !permittedBranches.includes(query.branchId)) {
          throw new ForbiddenException('You do not have access to this branch');
        }
        where.branchId = query.branchId;
      } else if (permittedBranches) {
        where.branchId = { in: permittedBranches };
      }

      if (query.search) {
        where.OR = [
          { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
          { member: { firstName: { contains: query.search, mode: 'insensitive' } } },
          { member: { lastName: { contains: query.search, mode: 'insensitive' } } },
          { member: { phone: { contains: query.search, mode: 'insensitive' } } },
        ];
      }

      const invoices = await tx.invoice.findMany({
        where,
        include: {
          member: true,
          branch: true,
        },
        orderBy: { dueDate: 'asc' },
      });

      const now = new Date();
      let totalDues = new Prisma.Decimal(0);
      let b0to30Amount = new Prisma.Decimal(0);
      let b0to30Count = 0;
      let b31to60Amount = new Prisma.Decimal(0);
      let b31to60Count = 0;
      let b60plusAmount = new Prisma.Decimal(0);
      let b60plusCount = 0;

      const memberMap = new Map<string, {
        memberId: string;
        memberName: string;
        memberNumber: string;
        phone: string;
        branchName: string;
        totalDue: Prisma.Decimal;
        oldestDueDate: Date;
        invoiceCount: number;
      }>();

      for (const inv of invoices) {
        const due = inv.balanceDue;
        totalDues = totalDues.add(due);

        const diffDays = Math.floor((now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 30) {
          b0to30Amount = b0to30Amount.add(due);
          b0to30Count++;
        } else if (diffDays <= 60) {
          b31to60Amount = b31to60Amount.add(due);
          b31to60Count++;
        } else {
          b60plusAmount = b60plusAmount.add(due);
          b60plusCount++;
        }

        // Group by member
        const existing = memberMap.get(inv.memberId);
        if (existing) {
          existing.totalDue = existing.totalDue.add(due);
          existing.invoiceCount++;
          if (inv.dueDate < existing.oldestDueDate) {
            existing.oldestDueDate = inv.dueDate;
          }
        } else {
          memberMap.set(inv.memberId, {
            memberId: inv.memberId,
            memberName: `${inv.member.firstName} ${inv.member.lastName}`.trim(),
            memberNumber: inv.member.memberNumber,
            phone: inv.member.phone,
            branchName: inv.branch.name,
            totalDue: due,
            oldestDueDate: inv.dueDate,
            invoiceCount: 1,
          });
        }
      }

      const memberList = Array.from(memberMap.values()).map((m) => {
        const oldestDue = m.oldestDueDate ? m.oldestDueDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        const daysOverdue = Math.max(0, Math.floor((now.getTime() - (m.oldestDueDate ? m.oldestDueDate.getTime() : now.getTime())) / 86400000));
        let bracket: 'CURRENT' | '1-30' | '31-60' | '61-90' | '90+' = 'CURRENT';
        if (daysOverdue > 90) bracket = '90+';
        else if (daysOverdue > 60) bracket = '61-90';
        else if (daysOverdue > 30) bracket = '31-60';
        else if (daysOverdue > 0) bracket = '1-30';

        return {
          memberId: m.memberId,
          memberNumber: m.memberNumber,
          firstName: m.memberName.split(' ')[0] || m.memberName,
          lastName: m.memberName.split(' ').slice(1).join(' ') || '',
          memberName: m.memberName,
          phone: m.phone,
          branchId: '',
          branchName: m.branchName,
          totalDue: Number(m.totalDue),
          oldestDueDate: oldestDue,
          daysOverdue,
          bracket,
          invoiceCount: m.invoiceCount,
        };
      });

      const agingSummary = {
        bracketCurrent: Number(b0to30Amount),
        bracket30: Number(b31to60Amount),
        bracket60: Number(b60plusAmount),
        bracket90Plus: 0,
        totalOutstanding: Number(totalDues),
        totalOverdueInvoices: b0to30Count + b31to60Count + b60plusCount,
        affectedMembers: memberList.length,
      };

      return {
        totalDues: Number(totalDues),
        agingBuckets: [
          { bucket: '0-30', amount: Number(b0to30Amount), invoiceCount: b0to30Count },
          { bucket: '31-60', amount: Number(b31to60Amount), invoiceCount: b31to60Count },
          { bucket: '60+', amount: Number(b60plusAmount), invoiceCount: b60plusCount },
        ],
        memberDues: memberList,
        agingSummary,
        members: {
          items: memberList,
          meta: {
            total: memberList.length,
            page: 1,
            limit: 50,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
      } as any;
    });
  }

  async getFinancialKpis(
    organizationId: string,
    userId: string,
    role: UserRole,
    branchId?: string,
  ): Promise<FinancialKpiData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const permittedBranches = await this.getStaffPermittedBranchIds(tx, organizationId, userId, role);
      if (branchId && permittedBranches && !permittedBranches.includes(branchId)) {
        throw new ForbiddenException('You do not have access to this branch');
      }

      const branchFilter = branchId ? { branchId } : (permittedBranches ? { branchId: { in: permittedBranches } } : {});

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Today's collections
      const todayPayments = await tx.payment.findMany({
        where: {
          organizationId,
          ...branchFilter,
          paidAt: { gte: startOfDay },
          status: 'COMPLETED',
        },
        select: { amount: true },
      });
      const todayCollections = todayPayments.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));

      // MTD Collections
      const mtdPayments = await tx.payment.findMany({
        where: {
          organizationId,
          ...branchFilter,
          paidAt: { gte: startOfMonth },
          status: 'COMPLETED',
        },
        select: { amount: true },
      });
      const mtdCollections = mtdPayments.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));

      // Invoices counts and dues
      const [allInvoices, paidCount, overdueCount] = await Promise.all([
        tx.invoice.findMany({
          where: {
            organizationId,
            ...branchFilter,
            status: { notIn: ['VOID', 'REFUNDED'] },
          },
          select: { balanceDue: true, status: true },
        }),
        tx.invoice.count({
          where: { organizationId, ...branchFilter, status: 'PAID' },
        }),
        tx.invoice.count({
          where: { organizationId, ...branchFilter, status: 'OVERDUE' },
        }),
      ]);

      const totalOutstandingDues = allInvoices.reduce((acc, i) => acc.add(i.balanceDue), new Prisma.Decimal(0));

      return {
        todayCollections: Number(todayCollections),
        mtdCollections: Number(mtdCollections),
        totalOutstandingDues: Number(totalOutstandingDues),
        activeInvoicesCount: allInvoices.length,
        paidInvoicesCount: paidCount,
        overdueInvoicesCount: overdueCount,
      };
    });
  }

  async getPaymentMethodDistribution(
    organizationId: string,
    userId: string,
    role: UserRole,
    branchId?: string,
  ): Promise<PaymentMethodDistributionData[]> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const permittedBranches = await this.getStaffPermittedBranchIds(tx, organizationId, userId, role);
      if (branchId && permittedBranches && !permittedBranches.includes(branchId)) {
        throw new ForbiddenException('You do not have access to this branch');
      }

      const branchFilter = branchId ? { branchId } : (permittedBranches ? { branchId: { in: permittedBranches } } : {});

      const payments = await tx.payment.findMany({
        where: {
          organizationId,
          ...branchFilter,
          status: 'COMPLETED',
        },
        select: { method: true, amount: true },
      });

      const totalAmountAll = payments.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));
      const map = new Map<PaymentMethod, { amount: Prisma.Decimal; count: number }>();

      for (const p of payments) {
        const entry = map.get(p.method as PaymentMethod) || { amount: new Prisma.Decimal(0), count: 0 };
        entry.amount = entry.amount.add(p.amount);
        entry.count++;
        map.set(p.method as PaymentMethod, entry);
      }

      const result: PaymentMethodDistributionData[] = [];
      for (const [method, data] of map.entries()) {
        const percentage = totalAmountAll.gt(0)
          ? Number(data.amount.mul(100).div(totalAmountAll).toDecimalPlaces(2))
          : 0;
        result.push({
          method,
          totalAmount: Number(data.amount),
          count: data.count,
          percentage,
        });
      }

      return result.sort((a, b) => b.totalAmount - a.totalAmount);
    });
  }

  async getBranchPerformance(
    organizationId: string,
    _userId: string,
    role: UserRole,
  ): Promise<BranchPerformanceData[]> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      if (role !== UserRole.GYM_OWNER) {
        throw new ForbiddenException('Only Gym Owners can view consolidated cross-branch performance');
      }

      const branches = await tx.branch.findMany({
        where: { organizationId, status: 'ACTIVE' },
      });

      const results: BranchPerformanceData[] = [];

      for (const b of branches) {
        const [payments, invoices] = await Promise.all([
          tx.payment.findMany({
            where: { organizationId, branchId: b.id, status: 'COMPLETED' },
            select: { amount: true },
          }),
          tx.invoice.findMany({
            where: { organizationId, branchId: b.id, status: { notIn: ['VOID', 'REFUNDED'] } },
            select: { balanceDue: true },
          }),
        ]);

        const collections = payments.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));
        const dues = invoices.reduce((acc, i) => acc.add(i.balanceDue), new Prisma.Decimal(0));

        results.push({
          branchId: b.id,
          branchName: b.name,
          branchCode: b.branchCode,
          collections: Number(collections),
          dues: Number(dues),
          invoicesCount: invoices.length,
        });
      }

      return results;
    });
  }

  // ===========================================================================
  // MAPPERS
  // ===========================================================================

  private mapInvoice(i: any): InvoiceData {
    return {
      id: i.id,
      organizationId: i.organizationId,
      branchId: i.branchId,
      memberId: i.memberId,
      invoiceNumber: i.invoiceNumber,
      financialYear: i.financialYear,
      sequenceNumber: i.sequenceNumber,
      issueDate: i.issueDate.toISOString().split('T')[0],
      dueDate: i.dueDate.toISOString().split('T')[0],
      currency: i.currency,
      subtotal: Number(i.subtotal),
      discountAmount: Number(i.discountAmount),
      discountReason: i.discountReason,
      taxableAmount: Number(i.taxableAmount),
      cgstAmount: Number(i.cgstAmount),
      sgstAmount: Number(i.sgstAmount),
      igstAmount: Number(i.igstAmount),
      cessAmount: Number(i.cessAmount),
      totalTaxAmount: Number(i.totalTaxAmount),
      totalAmount: Number(i.totalAmount),
      allocatedAmount: Number(i.allocatedAmount),
      paidAmount: Number(i.allocatedAmount),
      balanceDue: Number(i.balanceDue),
      status: i.status as InvoiceStatus,
      supplierSnapshot: i.supplierSnapshot,
      customerSnapshot: i.customerSnapshot,
      taxSnapshot: i.taxSnapshot,
      placeOfSupply: i.placeOfSupply,
      notes: i.notes,
      terms: i.terms,
      createdById: i.createdById,
      voidedAt: i.voidedAt?.toISOString(),
      voidReason: i.voidReason,
      voidedById: i.voidedById,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
      member: i.member,
      branch: i.branch,
    };
  }

  private mapInvoiceDetail(i: any): InvoiceDetailData {
    return {
      ...this.mapInvoice(i),
      items: (i.items || []).map((item: any) => ({
        id: item.id,
        organizationId: item.organizationId,
        invoiceId: item.invoiceId,
        itemType: item.itemType as InvoiceItemType,
        description: item.description,
        sacHsnCode: item.sacHsnCode,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discountAmount: Number(item.discountAmount),
        taxableAmount: Number(item.taxableAmount),
        taxRate: Number(item.taxRate),
        cgstRate: Number(item.cgstRate),
        sgstRate: Number(item.sgstRate),
        igstRate: Number(item.igstRate),
        taxAmount: Number(item.taxAmount),
        totalAmount: Number(item.totalAmount),
        membershipId: item.membershipId,
        createdAt: item.createdAt.toISOString(),
      })),
      allocations: (i.allocations || []).map((a: any) => this.mapAllocation(a)),
    };
  }

  private mapAllocation(a: any): PaymentAllocationData {
    return {
      id: a.id,
      organizationId: a.organizationId,
      paymentId: a.paymentId,
      invoiceId: a.invoiceId,
      amount: Number(a.amount),
      status: a.status as AllocationStatus,
      allocatedAt: a.allocatedAt.toISOString(),
      createdAt: a.createdAt.toISOString(),
      invoice: a.invoice
        ? {
            id: a.invoice.id,
            invoiceNumber: a.invoice.invoiceNumber,
            totalAmount: Number(a.invoice.totalAmount),
            balanceDue: Number(a.invoice.balanceDue),
            status: a.invoice.status as InvoiceStatus,
          }
        : undefined,
      reversals: (a.reversals || []).map((r: any) => ({
        id: r.id,
        organizationId: r.organizationId,
        allocationId: r.allocationId,
        refundId: r.refundId,
        amount: Number(r.amount),
        reason: r.reason,
        reversedById: r.reversedById,
        idempotencyKey: r.idempotencyKey,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  private mapPayment(p: any): PaymentData {
    return {
      id: p.id,
      organizationId: p.organizationId,
      branchId: p.branchId,
      memberId: p.memberId,
      paymentNumber: p.paymentNumber,
      receiptNumber: p.paymentNumber,
      financialYear: p.financialYear,
      sequenceNumber: p.sequenceNumber,
      amount: Number(p.amount),
      currency: p.currency,
      method: p.method as PaymentMethod,
      status: p.status as PaymentStatus,
      transactionReference: p.transactionReference,
      bankName: p.bankName,
      chequeNumber: p.chequeNumber,
      chequeDate: p.chequeDate?.toISOString().split('T')[0],
      paidAt: p.paidAt.toISOString(),
      collectedById: p.collectedById,
      idempotencyKey: p.idempotencyKey,
      notes: p.notes,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      member: p.member,
      branch: p.branch,
    };
  }

  private mapPaymentDetail(p: any): PaymentDetailData {
    const allocations = (p.allocations || []).map((a: any) => this.mapAllocation(a));
    const refunds = (p.refunds || []).map((r: any) => this.mapRefund(r));
    const allocatedAmount = allocations.reduce((acc: number, a: any) => acc + (a.status === 'ACTIVE' ? a.amount : 0), 0);
    const refundedAmount = refunds.reduce((acc: number, r: any) => acc + (r.status === 'COMPLETED' ? r.amount : 0), 0);
    const unallocatedAmount = Math.max(0, Number(p.amount) - allocatedAmount);

    return {
      ...this.mapPayment(p),
      allocatedAmount,
      unallocatedAmount,
      refundedAmount,
      allocations,
      refunds,
    };
  }

  private mapRefund(r: any): RefundData {
    return {
      id: r.id,
      organizationId: r.organizationId,
      paymentId: r.paymentId,
      refundNumber: r.refundNumber,
      financialYear: r.financialYear,
      sequenceNumber: r.sequenceNumber,
      amount: Number(r.amount),
      method: r.method as PaymentMethod,
      reason: r.reason,
      reference: r.reference,
      status: r.status as RefundStatus,
      initiatedById: r.initiatedById,
      approvedById: r.approvedById,
      idempotencyKey: r.idempotencyKey,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      reversals: (r.reversals || []).map((rev: any) => ({
        id: rev.id,
        organizationId: rev.organizationId,
        allocationId: rev.allocationId,
        refundId: rev.refundId,
        amount: Number(rev.amount),
        reason: rev.reason,
        reversedById: rev.reversedById,
        idempotencyKey: rev.idempotencyKey,
        createdAt: rev.createdAt.toISOString(),
      })),
    };
  }
}
