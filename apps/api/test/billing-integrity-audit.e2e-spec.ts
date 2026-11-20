import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';
import { TokenService } from '../src/auth/token.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import {
  UserRole,
  UserStatus,
  TenantStatus,
  BranchStatus,
  MemberStatus,
  InvoiceStatus,
  InvoiceItemType,
  PaymentMethod,
  PaymentStatus,
} from '@gymos/shared-types';

describe('Stage 2.6: Financial Integrity & Deep Allocation Audit (10 Scenarios)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordHasher: PasswordHasherService;
  let tokenService: TokenService;

  // Organizations
  let orgAlpha: { id: string; name: string };
  let orgBeta: { id: string; name: string };

  // Staff Users & Auth Tokens
  let ownerAlpha: { id: string; email: string; token: string };
  let receptionistAlpha: { id: string; email: string; token: string };
  let trainerAlpha: { id: string; email: string; token: string };
  let ownerBeta: { id: string; email: string; token: string };

  // Branches
  let branchAlpha1Id: string;

  // Members
  let memberAlpha1Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    await app.init();

    prisma = app.get(PrismaService);
    passwordHasher = app.get(PasswordHasherService);
    tokenService = app.get(TokenService);

    const defaultPassword = 'SecureAuditPass2026!';
    const passwordHash = await passwordHasher.hashPassword(defaultPassword);
    const timestamp = Date.now();

    let uOwnerAId = '';
    let uOwnerAEmail = '';
    let uReceptAId = '';
    let uReceptAEmail = '';
    let uTrainerAId = '';
    let uTrainerAEmail = '';
    let uOwnerBId = '';
    let uOwnerBEmail = '';

    await prisma.withSuperAdminContext(async (tx) => {
      // 1. Org Alpha
      const oAlpha = await tx.organization.create({
        data: {
          name: `Audit Alpha Org_${timestamp}`,
          slug: `audit-alpha-${timestamp}`,
          status: TenantStatus.ACTIVE,
          timezone: 'Asia/Kolkata',
          currency: 'INR',
        },
      });
      orgAlpha = { id: oAlpha.id, name: oAlpha.name };

      // 2. Org Beta (Isolation)
      const oBeta = await tx.organization.create({
        data: {
          name: `Audit Beta Org_${timestamp}`,
          slug: `audit-beta-${timestamp}`,
          status: TenantStatus.ACTIVE,
          timezone: 'Asia/Kolkata',
          currency: 'INR',
        },
      });
      orgBeta = { id: oBeta.id, name: oBeta.name };

      // 3. Branch Alpha
      const bAlpha1 = await tx.branch.create({
        data: {
          organizationId: orgAlpha.id,
          name: 'Audit Alpha Delhi',
          slug: `audit-alpha-delhi-${timestamp}`,
          branchCode: `AAD${timestamp % 10000}`,
          status: BranchStatus.ACTIVE,
          state: '07',
          city: 'New Delhi',
        },
      });
      branchAlpha1Id = bAlpha1.id;

      // 4. Branch Beta
      await tx.branch.create({
        data: {
          organizationId: orgBeta.id,
          name: 'Audit Beta Mumbai',
          slug: `audit-beta-mum-${timestamp}`,
          branchCode: `ABM${timestamp % 10000}`,
          status: BranchStatus.ACTIVE,
          state: '27',
          city: 'Mumbai',
        },
      });

      // 5. Users
      const uOwnerA = await tx.user.create({
        data: {
          email: `audit_owner_a_${timestamp}@gymos.test`,
          passwordHash,
          firstName: 'AuditOwner',
          lastName: 'Alpha',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      uOwnerAId = uOwnerA.id;
      uOwnerAEmail = uOwnerA.email;
      await tx.organizationUser.create({
        data: {
          organizationId: orgAlpha.id,
          userId: uOwnerA.id,
          role: UserRole.GYM_OWNER,
        },
      });

      const uReceptA = await tx.user.create({
        data: {
          email: `audit_recept_a_${timestamp}@gymos.test`,
          passwordHash,
          firstName: 'AuditRecept',
          lastName: 'Alpha',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      uReceptAId = uReceptA.id;
      uReceptAEmail = uReceptA.email;
      const ouReceptA = await tx.organizationUser.create({
        data: {
          organizationId: orgAlpha.id,
          userId: uReceptA.id,
          role: UserRole.RECEPTIONIST,
        },
      });
      await tx.branchStaffAssignment.create({
        data: {
          organizationId: orgAlpha.id,
          organizationUserId: ouReceptA.id,
          branchId: branchAlpha1Id,
        },
      });

      const uTrainerA = await tx.user.create({
        data: {
          email: `audit_trainer_a_${timestamp}@gymos.test`,
          passwordHash,
          firstName: 'AuditTrainer',
          lastName: 'Alpha',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      uTrainerAId = uTrainerA.id;
      uTrainerAEmail = uTrainerA.email;
      await tx.organizationUser.create({
        data: {
          organizationId: orgAlpha.id,
          userId: uTrainerA.id,
          role: UserRole.TRAINER,
        },
      });

      const uOwnerB = await tx.user.create({
        data: {
          email: `audit_owner_b_${timestamp}@gymos.test`,
          passwordHash,
          firstName: 'AuditOwner',
          lastName: 'Beta',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      uOwnerBId = uOwnerB.id;
      uOwnerBEmail = uOwnerB.email;
      await tx.organizationUser.create({
        data: {
          organizationId: orgBeta.id,
          userId: uOwnerB.id,
          role: UserRole.GYM_OWNER,
        },
      });

      // 7. Member in Org Alpha
      const mAlpha1 = await tx.member.create({
        data: {
          organizationId: orgAlpha.id,
          branchId: branchAlpha1Id,
          memberNumber: `AUD-001`,
          firstName: 'Audit',
          lastName: 'Member',
          phone: `+91998877${timestamp % 10000}`,
          email: `audit_member_${timestamp}@test.com`,
          status: MemberStatus.ACTIVE,
          state: '07',
          joinedAt: new Date(),
        },
      });
      memberAlpha1Id = mAlpha1.id;
    });

    const [tOwnerA, tReceptA, tTrainerA, tOwnerB] = await Promise.all([
      tokenService.issueTokens(uOwnerAId, uOwnerAEmail, false, orgAlpha.id, UserRole.GYM_OWNER),
      tokenService.issueTokens(uReceptAId, uReceptAEmail, false, orgAlpha.id, UserRole.RECEPTIONIST),
      tokenService.issueTokens(uTrainerAId, uTrainerAEmail, false, orgAlpha.id, UserRole.TRAINER),
      tokenService.issueTokens(uOwnerBId, uOwnerBEmail, false, orgBeta.id, UserRole.GYM_OWNER),
    ]);

    ownerAlpha = { id: uOwnerAId, email: uOwnerAEmail, token: tOwnerA.accessToken };
    receptionistAlpha = { id: uReceptAId, email: uReceptAEmail, token: tReceptA.accessToken };
    trainerAlpha = { id: uTrainerAId, email: uTrainerAEmail, token: tTrainerA.accessToken };
    ownerBeta = { id: uOwnerBId, email: uOwnerBEmail, token: tOwnerB.accessToken };
  });

  afterAll(async () => {
    await app.close();
  });

  // Helper to create an invoice
  const createInvoice = async (amount: number, taxRate = 0, taxMode: 'EXCLUSIVE' | 'INCLUSIVE' = 'EXCLUSIVE') => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/billing/invoices')
      .set('Authorization', `Bearer ${ownerAlpha.token}`)
      .send({
        branchId: branchAlpha1Id,
        memberId: memberAlpha1Id,
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        taxMode,
        items: [
          {
            itemType: InvoiceItemType.MEMBERSHIP,
            description: `Audit Item for ₹${amount}`,
            quantity: 1,
            unitPrice: amount,
            taxRate,
          },
        ],
      })
      .expect(201);
    return res.body.data;
  };

  describe('Scenario 1: One payment allocated to one invoice', () => {
    it('should allocate single payment to single invoice and transition to PAID', async () => {
      const inv = await createInvoice(3000);
      expect(Number(inv.balanceDue)).toBe(3000);
      expect(inv.status).toBe(InvoiceStatus.ISSUED);

      const payRes = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
          amount: 3000,
          method: PaymentMethod.UPI,
          transactionReference: 'UPI-SCENARIO-1',
          allocations: [{ invoiceId: inv.id, amount: 3000 }],
        })
        .expect(201);

      const payment = payRes.body.data;
      expect(payment.status).toBe(PaymentStatus.COMPLETED);
      expect(Number(payment.allocatedAmount)).toBe(3000);
      expect(Number(payment.unallocatedAmount)).toBe(0);

      const updatedInv = await request(app.getHttpServer())
        .get(`/api/v1/billing/invoices/${inv.id}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(updatedInv.body.data.status).toBe(InvoiceStatus.PAID);
      expect(Number(updatedInv.body.data.balanceDue)).toBe(0);
      expect(Number(updatedInv.body.data.allocatedAmount)).toBe(3000);
    });
  });

  describe('Scenario 2: One payment allocated across multiple invoices', () => {
    it('should allocate a ₹5000 payment across two invoices (₹2000 and ₹3000) settling both', async () => {
      const inv1 = await createInvoice(2000);
      const inv2 = await createInvoice(3000);

      const payRes = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
          amount: 5000,
          method: PaymentMethod.BANK_TRANSFER,
          transactionReference: 'NEFT-SCENARIO-2',
          allocations: [
            { invoiceId: inv1.id, amount: 2000 },
            { invoiceId: inv2.id, amount: 3000 },
          ],
        })
        .expect(201);

      expect(payRes.body.data.status).toBe(PaymentStatus.COMPLETED);
      expect(Number(payRes.body.data.allocatedAmount)).toBe(5000);

      // Verify inv1
      const res1 = await request(app.getHttpServer())
        .get(`/api/v1/billing/invoices/${inv1.id}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);
      expect(res1.body.data.status).toBe(InvoiceStatus.PAID);
      expect(Number(res1.body.data.balanceDue)).toBe(0);

      // Verify inv2
      const res2 = await request(app.getHttpServer())
        .get(`/api/v1/billing/invoices/${inv2.id}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);
      expect(res2.body.data.status).toBe(InvoiceStatus.PAID);
      expect(Number(res2.body.data.balanceDue)).toBe(0);
    });
  });

  describe('Scenario 3: Partial payment followed by another payment', () => {
    it('should accept partial payment of ₹2000 on ₹5000 invoice, then second payment of ₹3000 settles it', async () => {
      const inv = await createInvoice(5000);

      // First partial payment: ₹2000
      const pay1 = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
          amount: 2000,
          method: PaymentMethod.CASH,
          allocations: [{ invoiceId: inv.id, amount: 2000 }],
        })
        .expect(201);

      expect(pay1.body.data.status).toBe(PaymentStatus.COMPLETED);

      const invCheck1 = await request(app.getHttpServer())
        .get(`/api/v1/billing/invoices/${inv.id}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);
      expect(invCheck1.body.data.status).toBe(InvoiceStatus.PARTIALLY_PAID);
      expect(Number(invCheck1.body.data.balanceDue)).toBe(3000);
      expect(Number(invCheck1.body.data.allocatedAmount)).toBe(2000);

      // Second payment: ₹3000 (settles balance)
      const pay2 = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
          amount: 3000,
          method: PaymentMethod.UPI,
          transactionReference: 'UPI-PARTIAL-SETTLE',
          allocations: [{ invoiceId: inv.id, amount: 3000 }],
        })
        .expect(201);

      expect(pay2.body.data.status).toBe(PaymentStatus.COMPLETED);

      const invCheck2 = await request(app.getHttpServer())
        .get(`/api/v1/billing/invoices/${inv.id}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);
      expect(invCheck2.body.data.status).toBe(InvoiceStatus.PAID);
      expect(Number(invCheck2.body.data.balanceDue)).toBe(0);
      expect(Number(invCheck2.body.data.allocatedAmount)).toBe(5000);
    });
  });

  describe('Scenario 4: Overpayment deposited into member credit wallet', () => {
    it('should allocate ₹2000 to invoice and deposit excess ₹1000 into member credit wallet', async () => {
      const inv = await createInvoice(2000);

      const payRes = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
          amount: 3000, // ₹1000 excess
          method: PaymentMethod.CASH,
          retainExcessAsCredit: true,
          allocations: [{ invoiceId: inv.id, amount: 2000 }],
        })
        .expect(201);

      expect(payRes.body.data.status).toBe(PaymentStatus.COMPLETED);

      // Verify wallet balance
      const creditRes = await request(app.getHttpServer())
        .get(`/api/v1/billing/members/${memberAlpha1Id}/credits`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(Number(creditRes.body.data.currentBalance)).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('Scenario 5: Member credit applied to an invoice', () => {
    it('should use member credit wallet to pay an invoice in full', async () => {
      // 1. Ensure member has at least ₹1500 credit
      await request(app.getHttpServer())
        .post(`/api/v1/billing/members/${memberAlpha1Id}/credits/deposit`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          amount: 1500,
          description: 'Advance deposit for membership renewal',
        })
        .expect(201);

      // 2. Create invoice of ₹1500
      const inv = await createInvoice(1500);

      // 3. Apply credit to invoice
      const applyRes = await request(app.getHttpServer())
        .post(`/api/v1/billing/members/${memberAlpha1Id}/credits/apply`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          invoiceId: inv.id,
          amount: 1500,
        })
        .expect(201);

      expect(applyRes.body.data.method).toBe(PaymentMethod.MEMBER_CREDIT);
      expect(applyRes.body.data.status).toBe(PaymentStatus.COMPLETED);

      // 4. Verify invoice is PAID
      const invRes = await request(app.getHttpServer())
        .get(`/api/v1/billing/invoices/${inv.id}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(invRes.body.data.status).toBe(InvoiceStatus.PAID);
      expect(Number(invRes.body.data.balanceDue)).toBe(0);
    });
  });

  describe('Scenario 6: Partial refund against multi-invoice payment (LIFO reversal)', () => {
    it('should reverse only the most recent allocation and restore that specific invoice balanceDue', async () => {
      const invA = await createInvoice(2000);
      const invB = await createInvoice(3000);

      const payRes = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
          amount: 5000,
          method: PaymentMethod.CARD,
          posTransactionId: 'POS-MULTI-REV',
          cardLastFour: '1234',
          allocations: [
            { invoiceId: invA.id, amount: 2000 },
            { invoiceId: invB.id, amount: 3000 },
          ],
        })
        .expect(201);

      const paymentId = payRes.body.data.id;

      // Partial refund of ₹1500 (LIFO should reverse ₹1500 from invB)
      const refRes = await request(app.getHttpServer())
        .post(`/api/v1/billing/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          amount: 1500,
          reason: 'Service cancellation for part of plan',
          reference: 'IMPS-REF-SCENARIO-6',
        })
        .expect(201);

      expect(Number(refRes.body.data.amount)).toBe(1500);

      // Payment status should now be PARTIALLY_REFUNDED
      const payCheck = await request(app.getHttpServer())
        .get(`/api/v1/billing/payments/${paymentId}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);
      expect(payCheck.body.data.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
      expect(Number(payCheck.body.data.refundedAmount)).toBe(1500);

      // InvB balanceDue should be restored to 1500 and status PARTIALLY_PAID
      const invBCheck = await request(app.getHttpServer())
        .get(`/api/v1/billing/invoices/${invB.id}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);
      expect(invBCheck.body.data.status).toBe(InvoiceStatus.PARTIALLY_PAID);
      expect(Number(invBCheck.body.data.balanceDue)).toBe(1500);
      expect(Number(invBCheck.body.data.allocatedAmount)).toBe(1500);

      // InvA must remain completely untouched (PAID with balanceDue 0)
      const invACheck = await request(app.getHttpServer())
        .get(`/api/v1/billing/invoices/${invA.id}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);
      expect(invACheck.body.data.status).toBe(InvoiceStatus.PAID);
      expect(Number(invACheck.body.data.balanceDue)).toBe(0);
    });
  });

  describe('Scenario 7: Multiple partial refunds against one payment', () => {
    it('should allow consecutive partial refunds transitioning payment to REFUNDED upon reaching total', async () => {
      const inv = await createInvoice(4000);

      const payRes = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
          amount: 4000,
          method: PaymentMethod.UPI,
          transactionReference: 'UPI-MULTI-REF',
          allocations: [{ invoiceId: inv.id, amount: 4000 }],
        })
        .expect(201);

      const paymentId = payRes.body.data.id;

      // 1st partial refund: ₹1500
      await request(app.getHttpServer())
        .post(`/api/v1/billing/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ amount: 1500, reason: '1st partial refund' })
        .expect(201);

      let payCheck = await request(app.getHttpServer())
        .get(`/api/v1/billing/payments/${paymentId}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);
      expect(payCheck.body.data.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
      expect(Number(payCheck.body.data.refundedAmount)).toBe(1500);

      // 2nd partial refund: ₹1500 (total refunded 3000)
      await request(app.getHttpServer())
        .post(`/api/v1/billing/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ amount: 1500, reason: '2nd partial refund' })
        .expect(201);

      payCheck = await request(app.getHttpServer())
        .get(`/api/v1/billing/payments/${paymentId}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);
      expect(payCheck.body.data.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
      expect(Number(payCheck.body.data.refundedAmount)).toBe(3000);

      // 3rd final refund: ₹1000 (total refunded 4000) -> Transitions to REFUNDED
      await request(app.getHttpServer())
        .post(`/api/v1/billing/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ amount: 1000, reason: '3rd and final refund' })
        .expect(201);

      payCheck = await request(app.getHttpServer())
        .get(`/api/v1/billing/payments/${paymentId}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);
      expect(payCheck.body.data.status).toBe(PaymentStatus.REFUNDED);
      expect(Number(payCheck.body.data.refundedAmount)).toBe(4000);

      // Invoice balanceDue is now fully restored to 4000
      const invCheck = await request(app.getHttpServer())
        .get(`/api/v1/billing/invoices/${inv.id}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);
      expect(invCheck.body.data.status).toBe(InvoiceStatus.ISSUED);
      expect(Number(invCheck.body.data.balanceDue)).toBe(4000);
    });
  });

  describe('Scenario 8: Refund exceeding the refundable amount', () => {
    it('should reject refund request that exceeds payment unrefunded balance', async () => {
      const inv = await createInvoice(2000);

      const payRes = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
          amount: 2000,
          method: PaymentMethod.CASH,
          allocations: [{ invoiceId: inv.id, amount: 2000 }],
        })
        .expect(201);

      const paymentId = payRes.body.data.id;

      // Attempt to refund ₹2500 on ₹2000 payment
      const errRes = await request(app.getHttpServer())
        .post(`/api/v1/billing/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          amount: 2500,
          reason: 'Excessive refund attempt',
        })
        .expect(400);

      expect(errRes.body.message).toContain('exceeds available unrefunded payment balance');
    });
  });

  describe('Scenario 9: Sequential rapid refund requests safety', () => {
    it('should prevent double refund when two rapid requests collectively exceed unrefunded balance', async () => {
      const inv = await createInvoice(3000);

      const payRes = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
          amount: 3000,
          method: PaymentMethod.CASH,
          allocations: [{ invoiceId: inv.id, amount: 3000 }],
        })
        .expect(201);

      const paymentId = payRes.body.data.id;

      // First refund of ₹2000
      await request(app.getHttpServer())
        .post(`/api/v1/billing/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ amount: 2000, reason: 'First slice' })
        .expect(201);

      // Second refund of ₹2000 (only ₹1000 remains) -> Must be rejected with 400
      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/billing/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ amount: 2000, reason: 'Second slice beyond balance' })
        .expect(400);

      expect(res2.body.message).toContain('exceeds available unrefunded payment balance');
    });
  });

  describe('Scenario 10: Duplicate payment submissions using same idempotency key', () => {
    it('should return existing payment without duplicating transactions or allocations', async () => {
      const inv = await createInvoice(1000);
      const idempotencyKey = `audit-idem-${Date.now()}`;

      // 1st submission
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .set('idempotency-key', idempotencyKey)
        .send({
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
          amount: 1000,
          method: PaymentMethod.UPI,
          transactionReference: 'UPI-IDEM-001',
          allocations: [{ invoiceId: inv.id, amount: 1000 }],
        })
        .expect(201);

      const payId1 = res1.body.data.id;

      // 2nd submission with EXACT SAME idempotency key
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .set('idempotency-key', idempotencyKey)
        .send({
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
          amount: 1000,
          method: PaymentMethod.UPI,
          transactionReference: 'UPI-IDEM-001',
          allocations: [{ invoiceId: inv.id, amount: 1000 }],
        })
        .expect(201);

      // Must be same payment ID
      expect(res2.body.data.id).toBe(payId1);

      // Verify invoice was not allocated twice (balanceDue should be exactly 0, not negative)
      const invCheck = await request(app.getHttpServer())
        .get(`/api/v1/billing/invoices/${inv.id}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(Number(invCheck.body.data.balanceDue)).toBe(0);
      expect(Number(invCheck.body.data.allocatedAmount)).toBe(1000);
    });
  });

  describe('Audit 4: Member Credit Ledger Verification', () => {
    it('should maintain chronological running balances with balanceBefore and balanceAfter matching account balance', async () => {
      // 1. Fetch current credit ledger
      const ledgerRes = await request(app.getHttpServer())
        .get(`/api/v1/billing/members/${memberAlpha1Id}/credits/ledger`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      const entries = ledgerRes.body.data;
      expect(Array.isArray(entries)).toBe(true);

      // Verify balanceBefore and balanceAfter consistency
      if (entries.length > 0) {
        // Entries returned in descending order (latest first)
        const latest = entries[0];
        expect(latest.balanceBefore).toBeDefined();
        expect(latest.balanceAfter).toBeDefined();
        expect(latest.balanceAfter).toBe(latest.balanceBefore + latest.amount);

        // Fetch account balance to confirm exact reconciliation
        const acctRes = await request(app.getHttpServer())
          .get(`/api/v1/billing/members/${memberAlpha1Id}/credits`)
          .set('Authorization', `Bearer ${ownerAlpha.token}`)
          .expect(200);

        expect(Number(acctRes.body.data.currentBalance)).toBe(latest.balanceAfter);
      }
    });
  });

  describe('Audit 7: RBAC & Tenant Isolation Verification', () => {
    it('should block Receptionist from issuing refunds (403 Forbidden)', async () => {
      const inv = await createInvoice(1000);
      const payRes = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
          amount: 1000,
          method: PaymentMethod.CASH,
          allocations: [{ invoiceId: inv.id, amount: 1000 }],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/billing/payments/${payRes.body.data.id}/refund`)
        .set('Authorization', `Bearer ${receptionistAlpha.token}`)
        .send({ amount: 500, reason: 'Unauthorized receptionist refund attempt' })
        .expect(403);
    });

    it('should block Trainer from creating invoices (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${trainerAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          memberId: memberAlpha1Id,
          items: [{ itemType: InvoiceItemType.MEMBERSHIP, description: 'Blocked Trainer Item', unitPrice: 1000, quantity: 1 }],
        })
        .expect(403);
    });

    it('should block Org Beta owner from reading Org Alpha invoice via PostgreSQL RLS (404)', async () => {
      const inv = await createInvoice(2000);

      // Verify that Beta owner attempting to read Alpha invoice cannot find it due to RLS
      await request(app.getHttpServer())
        .get(`/api/v1/billing/invoices/${inv.id}`)
        .set('Authorization', `Bearer ${ownerBeta.token}`)
        .expect(404);
    });
  });
});
