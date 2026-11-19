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
  CreditEntryType,
} from '@gymos/shared-types';

describe('Stage 2.6: Billing, Invoices, Payments & Financial Records (E2E Integration & Security)', () => {
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
  let branchAlpha2Id: string;
  let branchBeta1Id: string;

  // Members
  let memberAlpha1Id: string;
  let memberAlpha2Id: string;

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

    const defaultPassword = 'SecureBillingPass2026!';
    const passwordHash = await passwordHasher.hashPassword(defaultPassword);
    const timestamp = Date.now();

    // Seed test organizations, branches, staff, and members
    await prisma.withSuperAdminContext(async (tx) => {
      // 1. Org Alpha
      const oAlpha = await tx.organization.create({
        data: {
          name: `Alpha Fitness Billing_${timestamp}`,
          slug: `alpha-billing-${timestamp}`,
          status: TenantStatus.ACTIVE,
          timezone: 'Asia/Kolkata',
          currency: 'INR',
        },
      });
      orgAlpha = { id: oAlpha.id, name: oAlpha.name };

      // 2. Org Beta (Isolation tenant)
      const oBeta = await tx.organization.create({
        data: {
          name: `Beta Gyms Billing_${timestamp}`,
          slug: `beta-billing-${timestamp}`,
          status: TenantStatus.ACTIVE,
          timezone: 'Asia/Kolkata',
          currency: 'INR',
        },
      });
      orgBeta = { id: oBeta.id, name: oBeta.name };

      // 3. Branches in Alpha
      // Branch 1: Delhi (State Code 07)
      const bAlpha1 = await tx.branch.create({
        data: {
          organizationId: orgAlpha.id,
          name: 'Alpha Delhi Central',
          slug: `alpha-delhi-${timestamp}`,
          branchCode: `ADC${timestamp % 10000}`,
          status: BranchStatus.ACTIVE,
          state: '07',
          city: 'New Delhi',
        },
      });
      branchAlpha1Id = bAlpha1.id;

      // Branch 2: Haryana (State Code 06)
      const bAlpha2 = await tx.branch.create({
        data: {
          organizationId: orgAlpha.id,
          name: 'Alpha Gurgaon Express',
          slug: `alpha-ggn-${timestamp}`,
          branchCode: `AGG${timestamp % 10000}`,
          status: BranchStatus.ACTIVE,
          state: '06',
          city: 'Gurugram',
        },
      });
      branchAlpha2Id = bAlpha2.id;

      // 4. Branch in Beta
      const bBeta1 = await tx.branch.create({
        data: {
          organizationId: orgBeta.id,
          name: 'Beta Mumbai South',
          slug: `beta-mum-${timestamp}`,
          branchCode: `BMS${timestamp % 10000}`,
          status: BranchStatus.ACTIVE,
          state: '27',
          city: 'Mumbai',
        },
      });
      branchBeta1Id = bBeta1.id;

      // 5. Users
      // Alpha Owner
      const uOwnerAlpha = await tx.user.create({
        data: {
          email: `owner.alpha.${timestamp}@billingtest.com`,
          passwordHash,
          firstName: 'Arthur',
          lastName: 'AlphaOwner',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      await tx.organizationUser.create({
        data: {
          organizationId: orgAlpha.id,
          userId: uOwnerAlpha.id,
          role: UserRole.GYM_OWNER,
        },
      });
      ownerAlpha = {
        id: uOwnerAlpha.id,
        email: uOwnerAlpha.email,
        token: '',
      };

      // Alpha Receptionist (Assigned to Branch 1 only)
      const uReceptAlpha = await tx.user.create({
        data: {
          email: `recept.alpha.${timestamp}@billingtest.com`,
          passwordHash,
          firstName: 'Rachel',
          lastName: 'Receptionist',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      const ouRecept = await tx.organizationUser.create({
        data: {
          organizationId: orgAlpha.id,
          userId: uReceptAlpha.id,
          role: UserRole.RECEPTIONIST,
        },
      });
      await tx.branchStaffAssignment.create({
        data: {
          organizationId: orgAlpha.id,
          branchId: branchAlpha1Id,
          organizationUserId: ouRecept.id,
          status: 'ACTIVE',
        },
      });
      receptionistAlpha = {
        id: uReceptAlpha.id,
        email: uReceptAlpha.email,
        token: '',
      };

      // Alpha Trainer (No financial permissions)
      const uTrainerAlpha = await tx.user.create({
        data: {
          email: `trainer.alpha.${timestamp}@billingtest.com`,
          passwordHash,
          firstName: 'Tom',
          lastName: 'Trainer',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      const ouTrainer = await tx.organizationUser.create({
        data: {
          organizationId: orgAlpha.id,
          userId: uTrainerAlpha.id,
          role: UserRole.TRAINER,
        },
      });
      await tx.branchStaffAssignment.create({
        data: {
          organizationId: orgAlpha.id,
          branchId: branchAlpha1Id,
          organizationUserId: ouTrainer.id,
          status: 'ACTIVE',
        },
      });
      trainerAlpha = {
        id: uTrainerAlpha.id,
        email: uTrainerAlpha.email,
        token: '',
      };

      // Beta Owner
      const uOwnerBeta = await tx.user.create({
        data: {
          email: `owner.beta.${timestamp}@billingtest.com`,
          passwordHash,
          firstName: 'Brian',
          lastName: 'BetaOwner',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      await tx.organizationUser.create({
        data: {
          organizationId: orgBeta.id,
          userId: uOwnerBeta.id,
          role: UserRole.GYM_OWNER,
        },
      });
      ownerBeta = {
        id: uOwnerBeta.id,
        email: uOwnerBeta.email,
        token: '',
      };

      // Members in Alpha
      // Member 1: Same state (Delhi '07')
      const mAlpha1 = await tx.member.create({
        data: {
          organizationId: orgAlpha.id,
          branchId: branchAlpha1Id,
          memberNumber: `ALPH-${timestamp % 10000}-001`,
          firstName: 'Karan',
          lastName: 'Sharma',
          phone: `+9198111${timestamp % 100000}`,
          state: '07',
          city: 'New Delhi',
          status: MemberStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });
      memberAlpha1Id = mAlpha1.id;

      // Member 2: Inter-state (Haryana '06')
      const mAlpha2 = await tx.member.create({
        data: {
          organizationId: orgAlpha.id,
          branchId: branchAlpha1Id,
          memberNumber: `ALPH-${timestamp % 10000}-002`,
          firstName: 'Vikas',
          lastName: 'Yadav',
          phone: `+9198222${timestamp % 100000}`,
          state: '06',
          city: 'Gurugram',
          status: MemberStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });
      memberAlpha2Id = mAlpha2.id;

      // Member in Beta
      await tx.member.create({
        data: {
          organizationId: orgBeta.id,
          branchId: branchBeta1Id,
          memberNumber: `BETA-${timestamp % 10000}-001`,
          firstName: 'Amit',
          lastName: 'Patil',
          phone: `+9198333${timestamp % 100000}`,
          state: '27',
          city: 'Mumbai',
          status: MemberStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });
    });

    // Generate tokens
    const [tOwnerA, tRecepA, tTrainerA, tOwnerB] = await Promise.all([
      tokenService.issueTokens(ownerAlpha.id, ownerAlpha.email, false, orgAlpha.id, UserRole.GYM_OWNER),
      tokenService.issueTokens(receptionistAlpha.id, receptionistAlpha.email, false, orgAlpha.id, UserRole.RECEPTIONIST),
      tokenService.issueTokens(trainerAlpha.id, trainerAlpha.email, false, orgAlpha.id, UserRole.TRAINER),
      tokenService.issueTokens(ownerBeta.id, ownerBeta.email, false, orgBeta.id, UserRole.GYM_OWNER),
    ]);

    ownerAlpha.token = tOwnerA.accessToken;
    receptionistAlpha.token = tRecepA.accessToken;
    trainerAlpha.token = tTrainerA.accessToken;
    ownerBeta.token = tOwnerB.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  // ===========================================================================
  // 1. INVOICE CREATION & GST SNAPSHOTS
  // ===========================================================================
  describe('1. Invoice Creation & GST Snapshots', () => {
    let intraStateInvoiceId: string;

    it('should create an intra-state invoice with CGST 9% + SGST 9% (Delhi -> Delhi)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          memberId: memberAlpha1Id,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          taxMode: 'EXCLUSIVE',
          notes: 'Annual Gym Membership Fee',
          items: [
            {
              itemType: InvoiceItemType.MEMBERSHIP,
              description: 'Annual Platinum Membership',
              quantity: 1,
              unitPrice: 10000,
              discountAmount: 0,
              taxRate: 18,
              sacCode: '999723',
            },
          ],
        })
        .expect(201);

      const invoice = res.body.data;
      expect(invoice.id).toBeDefined();
      expect(invoice.invoiceNumber).toMatch(/^INV\/\d{4}-\d{2}\/\d{5}$/);
      expect(Number(invoice.subtotal)).toBe(10000);
      expect(Number(invoice.cgstAmount)).toBe(900);
      expect(Number(invoice.sgstAmount)).toBe(900);
      expect(Number(invoice.igstAmount)).toBe(0);
      expect(Number(invoice.totalTaxAmount)).toBe(1800);
      expect(Number(invoice.totalAmount)).toBe(11800);
      expect(Number(invoice.balanceDue)).toBe(11800);
      expect(invoice.status).toBe(InvoiceStatus.ISSUED);
      expect(invoice.customerSnapshot).toBeDefined();
      expect(invoice.customerSnapshot.name).toBe('Karan Sharma');

      intraStateInvoiceId = invoice.id;
    });

    it('should create an inter-state invoice with IGST 18% (Delhi -> Haryana)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          memberId: memberAlpha2Id,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          taxMode: 'EXCLUSIVE',
          items: [
            {
              itemType: InvoiceItemType.PERSONAL_TRAINING,
              description: '10 Personal Training Sessions',
              quantity: 1,
              unitPrice: 5000,
              taxRate: 18,
            },
          ],
        })
        .expect(201);

      const invoice = res.body.data;
      expect(invoice.id).toBeDefined();
      expect(Number(invoice.subtotal)).toBe(5000);
      expect(Number(invoice.cgstAmount)).toBe(0);
      expect(Number(invoice.sgstAmount)).toBe(0);
      expect(Number(invoice.igstAmount)).toBe(900);
      expect(Number(invoice.totalTaxAmount)).toBe(900);
      expect(Number(invoice.totalAmount)).toBe(5900);
      expect(Number(invoice.balanceDue)).toBe(5900);
    });

    it('should create a tax-inclusive invoice correctly backing out base price and taxes', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          memberId: memberAlpha1Id,
          dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
          taxMode: 'INCLUSIVE',
          items: [
            {
              itemType: InvoiceItemType.MERCHANDISE,
              description: 'Whey Protein 2kg (MRP inclusive of 18% GST)',
              quantity: 1,
              unitPrice: 1180,
              taxRate: 18,
            },
          ],
        })
        .expect(201);

      const invoice = res.body.data;
      expect(Number(invoice.totalAmount)).toBe(1180);
      expect(Number(invoice.subtotal)).toBeCloseTo(1000, 1);
      expect(Number(invoice.totalTaxAmount)).toBeCloseTo(180, 1);
      expect(Number(invoice.balanceDue)).toBe(1180);
    });

    it('should fetch invoice details with items and snapshots', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/billing/invoices/${intraStateInvoiceId}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      const invoice = res.body.data;
      expect(invoice.id).toBe(intraStateInvoiceId);
      expect(invoice.items).toBeDefined();
      expect(invoice.items.length).toBe(1);
      expect(invoice.items[0].description).toBe('Annual Platinum Membership');
      expect(invoice.supplierSnapshot).toBeDefined();
    });
  });

  // ===========================================================================
  // 2. INVOICE VOIDING
  // ===========================================================================
  describe('2. Invoice Voiding', () => {
    let invoiceToVoidId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          memberId: memberAlpha1Id,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          items: [
            {
              itemType: InvoiceItemType.REGISTRATION_FEE,
              description: 'Mistaken Registration Fee',
              quantity: 1,
              unitPrice: 1500,
              taxRate: 18,
            },
          ],
        });
      invoiceToVoidId = res.body.data.id;
    });

    it('should void an unpaid invoice with reason, setting balanceDue to 0', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/billing/invoices/${invoiceToVoidId}/void`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          reason: 'Billed in error; duplicate fee entered by staff',
        })
        .expect(200);

      const invoice = res.body.data;
      expect(invoice.status).toBe(InvoiceStatus.VOID);
      expect(Number(invoice.balanceDue)).toBe(0);
      expect(invoice.voidReason).toBe('Billed in error; duplicate fee entered by staff');
      expect(invoice.voidedAt).toBeDefined();
    });

    it('should reject voiding an already void invoice', async () => {
      // First void
      await request(app.getHttpServer())
        .post(`/api/v1/billing/invoices/${invoiceToVoidId}/void`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ reason: 'First void' });

      // Second void attempt
      await request(app.getHttpServer())
        .post(`/api/v1/billing/invoices/${invoiceToVoidId}/void`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ reason: 'Second void attempt' })
        .expect(409);
    });
  });

  // ===========================================================================
  // 3. MANUAL PAYMENT RECORDING & ALLOCATIONS
  // ===========================================================================
  describe('3. Manual Payment Recording & Allocations', () => {
    let testInvoice1Id: string;
    let testInvoice2Id: string;

    beforeEach(async () => {
      // Invoice 1: Total 3000
      const inv1 = await request(app.getHttpServer())
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          memberId: memberAlpha1Id,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          items: [
            {
              itemType: InvoiceItemType.SERVICE,
              description: 'Annual Locker Rental',
              quantity: 1,
              unitPrice: 3000,
              taxRate: 0,
            },
          ],
        });
      testInvoice1Id = inv1.body.data.id;

      // Invoice 2: Total 2000
      const inv2 = await request(app.getHttpServer())
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          memberId: memberAlpha1Id,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          items: [
            {
              itemType: InvoiceItemType.MERCHANDISE,
              description: 'Gym Apparel Kit',
              quantity: 1,
              unitPrice: 2000,
              taxRate: 0,
            },
          ],
        });
      testInvoice2Id = inv2.body.data.id;
    });

    it('should record full payment with UPI and mark invoice as PAID', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
          amount: 3000,
          method: PaymentMethod.UPI,
          transactionReference: 'UPI-TEST-12345678',
          notes: 'Paid via GooglePay',
          allocations: [
            {
              invoiceId: testInvoice1Id,
              amount: 3000,
            },
          ],
        })
        .expect(201);

      const payment = res.body.data;
      expect(payment.id).toBeDefined();
      expect(payment.receiptNumber).toMatch(/^REC\/\d{4}-\d{2}\/\d{5}$/);
      expect(payment.status).toBe(PaymentStatus.COMPLETED);
      expect(Number(payment.amount)).toBe(3000);
      expect(Number(payment.allocatedAmount)).toBe(3000);
      expect(Number(payment.unallocatedAmount)).toBe(0);

      // Verify invoice updated
      const invRes = await request(app.getHttpServer())
        .get(`/api/v1/billing/invoices/${testInvoice1Id}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(invRes.body.data.status).toBe(InvoiceStatus.PAID);
      expect(Number(invRes.body.data.balanceDue)).toBe(0);
      expect(Number(invRes.body.data.paidAmount)).toBe(3000);
    });

    it('should record partial payment and transition invoice status to PARTIALLY_PAID', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
          amount: 1000,
          method: PaymentMethod.CASH,
          notes: 'Partial advance cash payment',
          allocations: [
            {
              invoiceId: testInvoice1Id,
              amount: 1000,
            },
          ],
        })
        .expect(201);

      expect(res.body.data.status).toBe(PaymentStatus.COMPLETED);

      const invRes = await request(app.getHttpServer())
        .get(`/api/v1/billing/invoices/${testInvoice1Id}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(invRes.body.data.status).toBe(InvoiceStatus.PARTIALLY_PAID);
      expect(Number(invRes.body.data.balanceDue)).toBe(2000);
      expect(Number(invRes.body.data.paidAmount)).toBe(1000);
    });

    it('should record a single payment allocated across multiple invoices', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
          amount: 5000,
          method: PaymentMethod.BANK_TRANSFER,
          transactionReference: 'NEFT-AXIS-998877',
          allocations: [
            {
              invoiceId: testInvoice1Id,
              amount: 3000,
            },
            {
              invoiceId: testInvoice2Id,
              amount: 2000,
            },
          ],
        })
        .expect(201);

      const payment = res.body.data;
      expect(Number(payment.amount)).toBe(5000);
      expect(Number(payment.allocatedAmount)).toBe(5000);
      expect(payment.allocations.length).toBe(2);

      // Both invoices should now be PAID
      const [inv1Res, inv2Res] = await Promise.all([
        request(app.getHttpServer())
          .get(`/api/v1/billing/invoices/${testInvoice1Id}`)
          .set('Authorization', `Bearer ${ownerAlpha.token}`),
        request(app.getHttpServer())
          .get(`/api/v1/billing/invoices/${testInvoice2Id}`)
          .set('Authorization', `Bearer ${ownerAlpha.token}`),
      ]);

      expect(inv1Res.body.data.status).toBe(InvoiceStatus.PAID);
      expect(Number(inv1Res.body.data.balanceDue)).toBe(0);
      expect(inv2Res.body.data.status).toBe(InvoiceStatus.PAID);
      expect(Number(inv2Res.body.data.balanceDue)).toBe(0);
    });
  });

  // ===========================================================================
  // 4. OVERPAYMENTS & MEMBER CREDIT WALLET
  // ===========================================================================
  describe('4. Overpayments & Member Credit Wallet', () => {
    it('should deposit excess overpayment into member credit wallet', async () => {
      // 1. Create invoice of 1000
      const invRes = await request(app.getHttpServer())
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          memberId: memberAlpha1Id,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          items: [
            {
              itemType: InvoiceItemType.MEMBERSHIP,
              description: 'Short Term Trial',
              quantity: 1,
              unitPrice: 1000,
              taxRate: 0,
            },
          ],
        });
      const invId = invRes.body.data.id;

      // 2. Member pays 1500 (500 excess) with retainExcessAsCredit: true
      const payRes = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
          amount: 1500,
          method: PaymentMethod.UPI,
          transactionReference: 'UPI-OVERPAY-111',
          retainExcessAsCredit: true,
          allocations: [
            {
              invoiceId: invId,
              amount: 1000,
            },
          ],
        })
        .expect(201);

      expect(Number(payRes.body.data.amount)).toBe(1500);
      expect(Number(payRes.body.data.allocatedAmount)).toBe(1000);
      expect(Number(payRes.body.data.unallocatedAmount)).toBe(500);

      // 3. Verify member credit account balance has 500
      const creditRes = await request(app.getHttpServer())
        .get(`/api/v1/billing/members/${memberAlpha1Id}/credits`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(Number(creditRes.body.data.currentBalance)).toBeGreaterThanOrEqual(500);

      // 4. Verify member credit ledger
      const ledgerRes = await request(app.getHttpServer())
        .get(`/api/v1/billing/members/${memberAlpha1Id}/credits/ledger`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(ledgerRes.body.data.length).toBeGreaterThanOrEqual(1);
      const overpayEntry = ledgerRes.body.data.find(
        (e: any) => e.entryType === CreditEntryType.CREDIT_FROM_OVERPAYMENT,
      );
      expect(overpayEntry).toBeDefined();
      expect(Number(overpayEntry.amount)).toBe(500);
    });

    it('should manually deposit advance credit into member wallet', async () => {
      const depositRes = await request(app.getHttpServer())
        .post(`/api/v1/billing/members/${memberAlpha1Id}/credits/deposit`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          amount: 2500,
          description: 'Advance prepaid wallet deposit for upcoming renewals',
        })
        .expect(201);

      expect(Number(depositRes.body.data.currentBalance)).toBeGreaterThanOrEqual(2500);
    });

    it('should apply member credit wallet balance to pay an invoice', async () => {
      // 1. Create invoice of 1500
      const invRes = await request(app.getHttpServer())
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          memberId: memberAlpha1Id,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          items: [
            {
              itemType: InvoiceItemType.MERCHANDISE,
              description: 'Gym Shaker Bottle & Towel',
              quantity: 1,
              unitPrice: 1500,
              taxRate: 0,
            },
          ],
        });
      const invoiceId = invRes.body.data.id;

      // 2. Apply member credit
      const applyRes = await request(app.getHttpServer())
        .post(`/api/v1/billing/members/${memberAlpha1Id}/credits/apply`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          invoiceId,
          amount: 1500,
        })
        .expect(201);

      expect(applyRes.body.data.method).toBe(PaymentMethod.MEMBER_CREDIT);
      expect(Number(applyRes.body.data.amount)).toBe(1500);

      // 3. Invoice is PAID
      const updatedInv = await request(app.getHttpServer())
        .get(`/api/v1/billing/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(updatedInv.body.data.status).toBe(InvoiceStatus.PAID);
      expect(Number(updatedInv.body.data.balanceDue)).toBe(0);
    });
  });

  // ===========================================================================
  // 5. REFUNDS & ALLOCATION REVERSALS
  // ===========================================================================
  describe('5. Refunds & Allocation Reversals', () => {
    let refundablePaymentId: string;
    let targetInvoiceId: string;

    beforeEach(async () => {
      // Create invoice of 4000
      const invRes = await request(app.getHttpServer())
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          memberId: memberAlpha1Id,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          items: [
            {
              itemType: InvoiceItemType.MEMBERSHIP,
              description: 'Refundable Membership Package',
              quantity: 1,
              unitPrice: 4000,
              taxRate: 0,
            },
          ],
        });
      targetInvoiceId = invRes.body.data.id;

      // Pay invoice fully
      const payRes = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
          amount: 4000,
          method: PaymentMethod.CARD,
          posTransactionId: 'POS-AUTH-999',
          cardLastFour: '4242',
          allocations: [
            {
              invoiceId: targetInvoiceId,
              amount: 4000,
            },
          ],
        });
      refundablePaymentId = payRes.body.data.id;
    });

    it('should process full refund, create reversal record, and restore invoice balanceDue', async () => {
      const refRes = await request(app.getHttpServer())
        .post(`/api/v1/billing/payments/${refundablePaymentId}/refund`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          amount: 4000,
          reason: 'Member relocated to another city within 3 days',
          reference: 'REFUND-IMPS-001',
        })
        .expect(201);

      const refund = refRes.body.data;
      expect(refund.id).toBeDefined();
      expect(Number(refund.amount)).toBe(4000);
      expect(refund.reason).toBe('Member relocated to another city within 3 days');

      // Payment status should now be REFUNDED
      const payRes = await request(app.getHttpServer())
        .get(`/api/v1/billing/payments/${refundablePaymentId}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(payRes.body.data.status).toBe(PaymentStatus.REFUNDED);
      expect(Number(payRes.body.data.refundedAmount)).toBe(4000);

      // Invoice balanceDue must be restored to 4000 and status back to ISSUED
      const invRes = await request(app.getHttpServer())
        .get(`/api/v1/billing/invoices/${targetInvoiceId}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(invRes.body.data.status).toBe(InvoiceStatus.ISSUED);
      expect(Number(invRes.body.data.balanceDue)).toBe(4000);
      expect(Number(invRes.body.data.paidAmount)).toBe(0);
    });

    it('should reject refund exceeding refundable amount', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/billing/payments/${refundablePaymentId}/refund`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          amount: 6000, // exceeds payment amount 4000
          reason: 'Excessive refund attempt',
        })
        .expect(400);
    });
  });

  // ===========================================================================
  // 6. DUES & FINANCIAL REPORTS
  // ===========================================================================
  describe('6. Dues & Financial Reports', () => {
    it('should fetch outstanding dues and aging summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/billing/dues')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.agingSummary).toBeDefined();
      expect(typeof res.body.data.agingSummary.totalOutstanding).toBe('number');
      expect(res.body.data.members).toBeDefined();
      expect(Array.isArray(res.body.data.members.items)).toBe(true);
    });

    it('should fetch financial KPI summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/billing/reports/kpi')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      const kpis = res.body.data;
      expect(kpis).toBeDefined();
      expect(typeof kpis.todayCollections).toBe('number');
      expect(typeof kpis.mtdCollections).toBe('number');
      expect(typeof kpis.totalOutstandingDues).toBe('number');
    });

    it('should fetch payment methods breakdown', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/billing/reports/payment-methods')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      const methods = res.body.data;
      expect(Array.isArray(methods)).toBe(true);
      expect(methods.some((m: any) => m.method === PaymentMethod.UPI || m.method === PaymentMethod.CASH)).toBe(true);
    });

    it('should fetch branch financial performance', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/billing/reports/branch-performance')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      const branches = res.body.data;
      expect(Array.isArray(branches)).toBe(true);
      expect(branches.length).toBeGreaterThanOrEqual(1);
      expect(branches[0].branchName).toBeDefined();
    });
  });

  // ===========================================================================
  // 7. SECURITY, RBAC & MULTI-TENANT RLS ISOLATION
  // ===========================================================================
  describe('7. Security, RBAC & Multi-Tenant RLS Isolation', () => {
    let alphaInvoiceId: string;
    let alphaPaymentId: string;

    beforeAll(async () => {
      // Create invoice and payment in Org Alpha
      const invRes = await request(app.getHttpServer())
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          memberId: memberAlpha1Id,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          items: [
            {
              itemType: InvoiceItemType.MEMBERSHIP,
              description: 'Alpha Tenant Secret Service',
              quantity: 1,
              unitPrice: 2000,
              taxRate: 0,
            },
          ],
        });
      alphaInvoiceId = invRes.body.data.id;

      const payRes = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
          amount: 2000,
          method: PaymentMethod.CASH,
          allocations: [{ invoiceId: alphaInvoiceId, amount: 2000 }],
        });
      alphaPaymentId = payRes.body.data.id;
    });

    it('Cross-Tenant: Org Beta owner CANNOT view Org Alpha invoice (blocked by RLS)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/billing/invoices/${alphaInvoiceId}`)
        .set('Authorization', `Bearer ${ownerBeta.token}`)
        .expect(404);
    });

    it('Cross-Tenant: Org Beta owner CANNOT view Org Alpha payment (blocked by RLS)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/billing/payments/${alphaPaymentId}`)
        .set('Authorization', `Bearer ${ownerBeta.token}`)
        .expect(404);
    });

    it('RBAC: Receptionist CANNOT void an invoice (requires INVOICE_VOID permission)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/billing/invoices/${alphaInvoiceId}/void`)
        .set('Authorization', `Bearer ${receptionistAlpha.token}`)
        .send({ reason: 'Unauthorized void attempt' })
        .expect(403);
    });

    it('RBAC: Receptionist CANNOT refund a payment (requires PAYMENT_REFUND permission)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/billing/payments/${alphaPaymentId}/refund`)
        .set('Authorization', `Bearer ${receptionistAlpha.token}`)
        .send({ amount: 1000, reason: 'Unauthorized receptionist refund' })
        .expect(403);
    });

    it('RBAC: Trainer CANNOT create an invoice or record payments (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${trainerAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          memberId: memberAlpha1Id,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          items: [
            {
              itemType: InvoiceItemType.MEMBERSHIP,
              description: 'Trainer illegal invoice',
              quantity: 1,
              unitPrice: 1000,
              taxRate: 0,
            },
          ],
        })
        .expect(403);

      await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${trainerAlpha.token}`)
        .send({
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
          amount: 500,
          method: PaymentMethod.CASH,
        })
        .expect(403);
    });

    it('Branch Authorization: Receptionist assigned to Branch 1 CANNOT bill for Branch 2', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${receptionistAlpha.token}`)
        .send({
          branchId: branchAlpha2Id, // Unauthorized branch
          memberId: memberAlpha1Id,
          dueDate: new Date().toISOString().slice(0, 10),
          items: [
            {
              itemType: InvoiceItemType.MEMBERSHIP,
              description: 'Cross branch billing attempt',
              quantity: 1,
              unitPrice: 1000,
              taxRate: 0,
            },
          ],
        })
        .expect(403);
    });

    it('Referential Integrity: Attempt to delete member with financial history fails (onDelete: Restrict)', async () => {
      // Direct delete query in tenant context should be blocked by FK restrict constraint
      await expect(
        prisma.withTenantContext(orgAlpha.id, async (tx) => {
          return tx.member.delete({
            where: { id: memberAlpha1Id },
          });
        }),
      ).rejects.toThrow();
    });

    it('Concurrency & Idempotency: Duplicate payment submission with same idempotency key is safely handled', async () => {
      const idempotencyKey = `e2e-idem-pay-${Date.now()}`;

      // 1. First submission
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .set('idempotency-key', idempotencyKey)
        .send({
          memberId: memberAlpha2Id,
          branchId: branchAlpha1Id,
          amount: 1200,
          method: PaymentMethod.CASH,
          notes: 'Idempotency test payment',
          idempotencyKey,
        })
        .expect(201);

      // 2. Second submission with identical idempotencyKey
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/billing/payments')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .set('idempotency-key', idempotencyKey)
        .send({
          memberId: memberAlpha2Id,
          branchId: branchAlpha1Id,
          amount: 1200,
          method: PaymentMethod.CASH,
          notes: 'Idempotency test duplicate',
          idempotencyKey,
        })
        .expect(201);

      // Should return the exact same payment receipt without charging twice
      expect(res1.body.data.id).toBe(res2.body.data.id);
      expect(res1.body.data.receiptNumber).toBe(res2.body.data.receiptNumber);
    });
  });
});
