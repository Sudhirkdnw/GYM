import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/auth/permissions.guard';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { CurrentTenant } from '../common/auth/current-tenant.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  Permission,
  AuthenticatedUserContext,
  UserRole,
  InvoiceData,
  InvoiceDetailData,
  PaymentData,
  PaymentDetailData,
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
  createInvoiceSchema,
  CreateInvoiceInput,
  voidInvoiceSchema,
  VoidInvoiceInput,
  recordPaymentSchema,
  RecordPaymentInput,
  processRefundSchema,
  ProcessRefundInput,
  depositCreditSchema,
  DepositCreditInput,
  applyCreditSchema,
  ApplyCreditInput,
  invoiceQuerySchema,
  InvoiceQueryInput,
  paymentQuerySchema,
  PaymentQueryInput,
  duesQuerySchema,
  DuesQueryInput,
} from '@gymos/validation';

@Controller('billing')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ===========================================================================
  // 1. INVOICES
  // ===========================================================================

  @Post('invoices')
  @RequirePermissions(Permission.INVOICE_CREATE)
  async createInvoice(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(createInvoiceSchema)) dto: CreateInvoiceInput,
  ): Promise<InvoiceDetailData> {
    return this.billingService.createInvoice(
      organizationId,
      user.id,
      user.role || UserRole.MEMBER,
      dto,
      idempotencyKey,
    );
  }

  @Get('invoices')
  @RequirePermissions(Permission.INVOICE_READ)
  async getInvoices(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Query(new ZodValidationPipe(invoiceQuerySchema)) query: InvoiceQueryInput,
  ): Promise<PaginatedResult<InvoiceData>> {
    return this.billingService.getInvoices(
      organizationId,
      user.id,
      user.role || UserRole.MEMBER,
      query,
    );
  }

  @Get('invoices/:id')
  @RequirePermissions(Permission.INVOICE_READ)
  async getInvoiceById(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id') invoiceId: string,
  ): Promise<InvoiceDetailData> {
    return this.billingService.getInvoiceById(
      organizationId,
      user.id,
      user.role || UserRole.MEMBER,
      invoiceId,
    );
  }

  @Post('invoices/:id/void')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.INVOICE_VOID)
  async voidInvoice(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id') invoiceId: string,
    @Body(new ZodValidationPipe(voidInvoiceSchema)) dto: VoidInvoiceInput,
  ): Promise<InvoiceData> {
    return this.billingService.voidInvoice(
      organizationId,
      user.id,
      user.role || UserRole.MEMBER,
      invoiceId,
      dto,
    );
  }

  @Get('invoices/:id/print')
  @RequirePermissions(Permission.INVOICE_READ)
  async printInvoice(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id') invoiceId: string,
  ): Promise<InvoiceDetailData> {
    return this.billingService.getInvoiceById(
      organizationId,
      user.id,
      user.role || UserRole.MEMBER,
      invoiceId,
    );
  }

  // ===========================================================================
  // 2. PAYMENTS & ALLOCATIONS
  // ===========================================================================

  @Post('payments')
  @RequirePermissions(Permission.PAYMENT_RECORD)
  async recordPayment(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(recordPaymentSchema)) dto: RecordPaymentInput,
  ): Promise<PaymentDetailData> {
    return this.billingService.recordPayment(
      organizationId,
      user.id,
      user.role || UserRole.MEMBER,
      dto,
      idempotencyKey,
    );
  }

  @Get('payments')
  @RequirePermissions(Permission.PAYMENT_READ)
  async getPayments(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Query(new ZodValidationPipe(paymentQuerySchema)) query: PaymentQueryInput,
  ): Promise<PaginatedResult<PaymentData>> {
    return this.billingService.getPayments(
      organizationId,
      user.id,
      user.role || UserRole.MEMBER,
      query,
    );
  }

  @Get('payments/:id')
  @RequirePermissions(Permission.PAYMENT_READ)
  async getPaymentById(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id') paymentId: string,
  ): Promise<PaymentDetailData> {
    return this.billingService.getPaymentById(
      organizationId,
      user.id,
      user.role || UserRole.MEMBER,
      paymentId,
    );
  }

  @Post('payments/:id/refund')
  @RequirePermissions(Permission.PAYMENT_REFUND)
  async processRefund(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('id') paymentId: string,
    @Body(new ZodValidationPipe(processRefundSchema)) dto: ProcessRefundInput,
  ): Promise<RefundData> {
    return this.billingService.processRefund(
      organizationId,
      user.id,
      user.role || UserRole.MEMBER,
      paymentId,
      dto,
      idempotencyKey,
    );
  }

  // ===========================================================================
  // 3. MEMBER CREDITS
  // ===========================================================================

  @Get('members/:memberId/credits')
  @RequirePermissions(Permission.MEMBER_CREDIT_READ)
  async getMemberCredit(
    @CurrentTenant() organizationId: string,
    @Param('memberId') memberId: string,
  ): Promise<MemberCreditAccountData> {
    return this.billingService.getMemberCredit(organizationId, memberId);
  }

  @Get('members/:memberId/credits/ledger')
  @RequirePermissions(Permission.MEMBER_CREDIT_READ)
  async getMemberCreditLedger(
    @CurrentTenant() organizationId: string,
    @Param('memberId') memberId: string,
  ): Promise<MemberCreditEntryData[]> {
    return this.billingService.getMemberCreditLedger(organizationId, memberId);
  }

  @Post('members/:memberId/credits/deposit')
  @RequirePermissions(Permission.MEMBER_CREDIT_MANAGE)
  async depositCredit(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(depositCreditSchema)) dto: DepositCreditInput,
  ): Promise<MemberCreditAccountData> {
    return this.billingService.depositCredit(
      organizationId,
      user.id,
      user.role || UserRole.MEMBER,
      memberId,
      dto,
      idempotencyKey,
    );
  }

  @Post('members/:memberId/credits/apply')
  @RequirePermissions(Permission.MEMBER_CREDIT_MANAGE)
  async applyCredit(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(applyCreditSchema)) dto: ApplyCreditInput,
  ): Promise<PaymentDetailData> {
    return this.billingService.applyCreditToInvoice(
      organizationId,
      user.id,
      user.role || UserRole.MEMBER,
      memberId,
      dto,
      idempotencyKey,
    );
  }

  // ===========================================================================
  // 4. DUES & REPORTS
  // ===========================================================================

  @Get('dues')
  @RequirePermissions(Permission.INVOICE_READ)
  async getOutstandingDues(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Query(new ZodValidationPipe(duesQuerySchema)) query: DuesQueryInput,
  ): Promise<OutstandingDuesSummaryData> {
    return this.billingService.getOutstandingDues(
      organizationId,
      user.id,
      user.role || UserRole.MEMBER,
      query,
    );
  }

  @Get(['reports/kpi', 'reports/kpis'])
  @RequirePermissions(Permission.FINANCIAL_REPORT_READ)
  async getFinancialKpis(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Query('branchId') branchId?: string,
  ): Promise<FinancialKpiData> {
    return this.billingService.getFinancialKpis(
      organizationId,
      user.id,
      user.role || UserRole.MEMBER,
      branchId,
    );
  }

  @Get('reports/payment-methods')
  @RequirePermissions(Permission.FINANCIAL_REPORT_READ)
  async getPaymentMethodDistribution(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Query('branchId') branchId?: string,
  ): Promise<PaymentMethodDistributionData[]> {
    return this.billingService.getPaymentMethodDistribution(
      organizationId,
      user.id,
      user.role || UserRole.MEMBER,
      branchId,
    );
  }

  @Get('reports/branch-performance')
  @RequirePermissions(Permission.FINANCIAL_REPORT_READ)
  async getBranchPerformance(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
  ): Promise<BranchPerformanceData[]> {
    return this.billingService.getBranchPerformance(
      organizationId,
      user.id,
      user.role || UserRole.MEMBER,
    );
  }
}
