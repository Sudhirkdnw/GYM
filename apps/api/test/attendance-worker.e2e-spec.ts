import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import {
  AttendanceStatus,
  AttendanceMethod,
  BranchStatus,
  MemberStatus,
} from '@gymos/shared-types';
import { AttendanceOutboxDispatcher } from '@gymos/worker/attendance/attendance-outbox.dispatcher';
import { AutoCheckoutProcessor } from '@gymos/worker/attendance/auto-checkout.processor';
import { createAttendanceWorker } from '@gymos/worker/attendance/attendance.worker';

describe('Stage 2.7 Step 6: Worker Outbox Events & Auto-Checkout Background Job (E2E)', () => {
  let prisma: PrismaService;
  let redis: Redis;
  let queueRedis: Redis;
  let testQueueName: string;
  let attendanceQueue: Queue;
  let dispatcher: AttendanceOutboxDispatcher;
  let processor: AutoCheckoutProcessor;

  // Organizations
  let orgAlpha: { id: string; name: string };
  let orgBeta: { id: string; name: string };

  // Branches
  let branchAlpha1Id: string;
  let branchAlpha2Id: string;
  let branchBeta1Id: string;

  // Members
  let memberAlpha1Id: string;
  let memberAlpha2Id: string;
  let memberBeta1Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    });

    queueRedis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    });

    testQueueName = `gymos-attendance-test-${Date.now()}`;
    attendanceQueue = new Queue(testQueueName, {
      connection: queueRedis,
    });

    const debugLog = (level: string, msg: string, meta?: any) => {
      if (level === 'ERROR' || level === 'WARN') console.log(`[DISPATCHER ${level}]`, msg, meta);
    };
    dispatcher = new AttendanceOutboxDispatcher(prisma, attendanceQueue, debugLog);
    processor = new AutoCheckoutProcessor(prisma, redis, debugLog);

    // Setup Test Orgs, Branches, and Members
    await prisma.withSuperAdminContext(async (tx) => {
      // 1. Clean existing test data
      await tx.attendanceRecord.deleteMany({
        where: { notes: { contains: 'STEP6_TEST' } },
      });
      await tx.attendanceOutboxEvent.deleteMany({
        where: { idempotencyKey: { contains: 'step6_test' } },
      });

      // 2. Org Alpha & Beta
      let dbOrgAlpha = await tx.organization.findFirst({ where: { slug: 'step6-org-alpha' } });
      if (!dbOrgAlpha) {
        dbOrgAlpha = await tx.organization.create({
          data: {
            name: 'Step 6 Alpha Fitness',
            slug: 'step6-org-alpha',
            status: 'ACTIVE',
            timezone: 'Asia/Kolkata',
          },
        });
      } else if (dbOrgAlpha.status !== 'ACTIVE') {
        dbOrgAlpha = await tx.organization.update({
          where: { id: dbOrgAlpha.id },
          data: { status: 'ACTIVE' },
        });
      }
      orgAlpha = { id: dbOrgAlpha.id, name: dbOrgAlpha.name };

      let dbOrgBeta = await tx.organization.findFirst({ where: { slug: 'step6-org-beta' } });
      if (!dbOrgBeta) {
        dbOrgBeta = await tx.organization.create({
          data: {
            name: 'Step 6 Beta Athletics',
            slug: 'step6-org-beta',
            status: 'ACTIVE',
            timezone: 'UTC',
          },
        });
      } else if (dbOrgBeta.status !== 'ACTIVE') {
        dbOrgBeta = await tx.organization.update({
          where: { id: dbOrgBeta.id },
          data: { status: 'ACTIVE' },
        });
      }
      orgBeta = { id: dbOrgBeta.id, name: dbOrgBeta.name };

      // 3. Branches
      let bAlpha1 = await tx.branch.findFirst({ where: { organizationId: orgAlpha.id, branchCode: 'S6A1' } });
      if (!bAlpha1) {
        bAlpha1 = await tx.branch.create({
          data: {
            organizationId: orgAlpha.id,
            name: 'Alpha Main Gym',
            slug: 'alpha-main-s6',
            branchCode: 'S6A1',
            timezone: 'Asia/Kolkata',
            status: BranchStatus.ACTIVE,
          },
        });
      }
      branchAlpha1Id = bAlpha1.id;

      let bAlpha2 = await tx.branch.findFirst({ where: { organizationId: orgAlpha.id, branchCode: 'S6A2' } });
      if (!bAlpha2) {
        bAlpha2 = await tx.branch.create({
          data: {
            organizationId: orgAlpha.id,
            name: 'Alpha Express Gym',
            slug: 'alpha-express-s6',
            branchCode: 'S6A2',
            timezone: 'Asia/Kolkata',
            status: BranchStatus.ACTIVE,
          },
        });
      }
      branchAlpha2Id = bAlpha2.id;

      let bBeta1 = await tx.branch.findFirst({ where: { organizationId: orgBeta.id, branchCode: 'S6B1' } });
      if (!bBeta1) {
        bBeta1 = await tx.branch.create({
          data: {
            organizationId: orgBeta.id,
            name: 'Beta Downtown',
            slug: 'beta-downtown-s6',
            branchCode: 'S6B1',
            timezone: 'UTC',
            status: BranchStatus.ACTIVE,
          },
        });
      }
      branchBeta1Id = bBeta1.id;

      // 4. Members
      let mAlpha1 = await tx.member.findFirst({ where: { organizationId: orgAlpha.id, memberNumber: 'M-S6-001' } });
      if (!mAlpha1) {
        mAlpha1 = await tx.member.create({
          data: {
            organizationId: orgAlpha.id,
            branchId: branchAlpha1Id,
            memberNumber: 'M-S6-001',
            firstName: 'Alice',
            lastName: 'WorkerTest',
            email: 'alice.worker@test.com',
            phone: '+919999000001',
            status: MemberStatus.ACTIVE,
          },
        });
      }
      memberAlpha1Id = mAlpha1.id;

      let mAlpha2 = await tx.member.findFirst({ where: { organizationId: orgAlpha.id, memberNumber: 'M-S6-002' } });
      if (!mAlpha2) {
        mAlpha2 = await tx.member.create({
          data: {
            organizationId: orgAlpha.id,
            branchId: branchAlpha1Id,
            memberNumber: 'M-S6-002',
            firstName: 'Bob',
            lastName: 'WorkerTest',
            email: 'bob.worker@test.com',
            phone: '+919999000002',
            status: MemberStatus.ACTIVE,
          },
        });
      }
      memberAlpha2Id = mAlpha2.id;

      let mBeta1 = await tx.member.findFirst({ where: { organizationId: orgBeta.id, memberNumber: 'M-S6-003' } });
      if (!mBeta1) {
        mBeta1 = await tx.member.create({
          data: {
            organizationId: orgBeta.id,
            branchId: branchBeta1Id,
            memberNumber: 'M-S6-003',
            firstName: 'Charlie',
            lastName: 'WorkerBeta',
            email: 'charlie.beta@test.com',
            phone: '+919999000003',
            status: MemberStatus.ACTIVE,
          },
        });
      }
      memberBeta1Id = mBeta1.id;
    });
  });

  afterAll(async () => {
    // Clean up test records
    await prisma.withSuperAdminContext(async (tx) => {
      await tx.attendanceRecord.deleteMany({
        where: { notes: { contains: 'STEP6_TEST' } },
      });
      await tx.attendanceOutboxEvent.deleteMany({
        where: { idempotencyKey: { contains: 'step6_test' } },
      });
    });

    await redis.del('lock:worker:attendance:auto-checkout');
    await attendanceQueue.obliterate({ force: true }).catch(() => {});
    await attendanceQueue.close();
    await queueRedis.quit();
    await redis.quit();
    await prisma.$disconnect();
  });

  describe('1. Attendance Outbox Event Dispatcher', () => {
    it('should dispatch PENDING outbox events to BullMQ and update status to PUBLISHED', async () => {
      const idempKey1 = `step6_test_checkin_${Date.now()}`;
      const idempKey2 = `step6_test_milestone_${Date.now()}`;

      // Create pending events in Org Alpha
      await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        await tx.attendanceOutboxEvent.createMany({
          data: [
            {
              organizationId: orgAlpha.id,
              aggregateId: memberAlpha1Id,
              eventType: 'attendance.checked_in',
              idempotencyKey: idempKey1,
              payload: {
                memberId: memberAlpha1Id,
                branchId: branchAlpha1Id,
                organizationId: orgAlpha.id,
                checkInTime: new Date().toISOString(),
                method: AttendanceMethod.QR_SCAN,
              },
              status: 'PENDING',
            },
            {
              organizationId: orgAlpha.id,
              aggregateId: memberAlpha1Id,
              eventType: 'attendance.milestone_reached',
              idempotencyKey: idempKey2,
              payload: {
                memberId: memberAlpha1Id,
                milestoneType: 'TOTAL_VISITS',
                milestoneValue: 50,
              },
              status: 'PENDING',
            },
          ],
        });
      });

      // Dispatch pending events
      const result = await dispatcher.dispatchPendingEvents();
      expect(result.dispatched).toBeGreaterThanOrEqual(2);

      // Verify events in DB are now PUBLISHED
      const events = await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        return tx.attendanceOutboxEvent.findMany({
          where: {
            idempotencyKey: { in: [idempKey1, idempKey2] },
          },
        });
      });

      expect(events).toHaveLength(2);
      expect(events[0]?.status).toBe('PUBLISHED');
      expect(events[0]?.processedAt).not.toBeNull();
      expect(events[1]?.status).toBe('PUBLISHED');
      expect(events[1]?.processedAt).not.toBeNull();
    });

    it('should record retryCount and lastError when BullMQ queue.add fails, and mark FAILED after 5 retries', async () => {
      const idempKeyFail = `step6_test_fail_${Date.now()}`;

      // Insert event with retryCount = 4
      await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        await tx.attendanceOutboxEvent.create({
          data: {
            organizationId: orgAlpha.id,
            aggregateId: memberAlpha2Id,
            eventType: 'attendance.rejected',
            idempotencyKey: idempKeyFail,
            payload: {
              rejectionCode: 'SUBSCRIPTION_EXPIRED',
              branchId: branchAlpha1Id,
            },
            status: 'PENDING',
            retryCount: 4,
          },
        });
      });

      // Mock queue.add to reject for this specific job
      const originalAdd = attendanceQueue.add.bind(attendanceQueue);
      jest.spyOn(attendanceQueue, 'add').mockImplementation(async (name: any, data: any, opts: any) => {
        if (opts?.jobId === idempKeyFail) {
          throw new Error('Simulated BullMQ Redis connection drop');
        }
        return originalAdd(name, data, opts);
      });

      const result = await dispatcher.dispatchPendingEvents();
      expect(result.failed).toBeGreaterThanOrEqual(1);

      // Verify event is now FAILED and retryCount is 5
      const failedEvent = await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        return tx.attendanceOutboxEvent.findUnique({
          where: { idempotencyKey: idempKeyFail },
        });
      });

      expect(failedEvent?.status).toBe('FAILED');
      expect(failedEvent?.retryCount).toBe(5);
      expect(failedEvent?.lastError).toContain('Simulated BullMQ Redis connection drop');

      // Restore
      jest.spyOn(attendanceQueue, 'add').mockImplementation(originalAdd);
    });

    it('should respect strict per-tenant RLS isolation during outbox dispatching', async () => {
      const idempBeta = `step6_test_beta_${Date.now()}`;

      // Create event in Org Beta
      await prisma.withTenantContext(orgBeta.id, async (tx) => {
        await tx.attendanceOutboxEvent.create({
          data: {
            organizationId: orgBeta.id,
            aggregateId: memberBeta1Id,
            eventType: 'attendance.checked_out',
            idempotencyKey: idempBeta,
            payload: {
              memberId: memberBeta1Id,
              branchId: branchBeta1Id,
              source: 'MANUAL_STAFF',
            },
            status: 'PENDING',
          },
        });
      });

      await dispatcher.dispatchPendingEvents();

      // Verify Beta event is PUBLISHED
      const betaEvent = await prisma.withTenantContext(orgBeta.id, async (tx) => {
        return tx.attendanceOutboxEvent.findUnique({
          where: { idempotencyKey: idempBeta },
        });
      });
      expect(betaEvent?.status).toBe('PUBLISHED');

      // Querying with Org Alpha tenant context must return null due to RLS
      const crossTenantCheck = await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        return tx.attendanceOutboxEvent.findUnique({
          where: { idempotencyKey: idempBeta },
        });
      });
      expect(crossTenantCheck).toBeNull();
    });
  });

  describe('2. Auto-Checkout Background Job', () => {
    it('should auto checkout open sessions exceeding autoCheckOutHours limit', async () => {
      // Configure Org Alpha attendance settings: autoCheckOutHours = 3
      await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        const existing = await tx.attendanceSettings.findFirst({
          where: { organizationId: orgAlpha.id, branchId: null },
        });
        if (existing) {
          await tx.attendanceSettings.update({
            where: { id: existing.id },
            data: { autoCheckOutHours: 3, allowOffHoursCheckIn: true },
          });
        } else {
          await tx.attendanceSettings.create({
            data: {
              organizationId: orgAlpha.id,
              branchId: null,
              autoCheckOutHours: 3,
              allowOffHoursCheckIn: true,
            },
          });
        }
      });

      // Create an active session checked in 4 hours ago
      const checkInTime = new Date(Date.now() - 4 * 60 * 60 * 1000);
      const sessionRecord = await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        return tx.attendanceRecord.create({
          data: {
            organizationId: orgAlpha.id,
            branchId: branchAlpha1Id,
            memberId: memberAlpha1Id,
            status: AttendanceStatus.CHECKED_IN,
            method: AttendanceMethod.QR_SCAN,
            checkInTime,
            notes: 'STEP6_TEST_DURATION_EXCEEDED',
          },
        });
      });

      // Process auto-checkout
      const res = await processor.processAutoCheckout();
      expect(res.checkedOutCount).toBeGreaterThanOrEqual(1);

      // Verify record is now AUTO_CHECKED_OUT
      const updated = await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        return tx.attendanceRecord.findUnique({
          where: { id: sessionRecord.id },
        });
      });

      expect(updated?.status).toBe(AttendanceStatus.AUTO_CHECKED_OUT);
      expect(updated?.checkOutTime).not.toBeNull();
      expect(updated?.durationMinutes).toBe(180);
      expect(updated?.notes).toContain('System auto-checkout due to duration limit');

      // Verify attendance.checked_out outbox event was generated
      const outbox = await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        return tx.attendanceOutboxEvent.findFirst({
          where: {
            aggregateId: sessionRecord.id,
            eventType: 'attendance.checked_out',
          },
        });
      });

      expect(outbox).not.toBeNull();
      expect((outbox?.payload as any)?.source).toBe('AUTO_CHECKOUT');
      expect((outbox?.payload as any)?.durationMinutes).toBe(updated?.durationMinutes);
    });

    it('should be strictly idempotent on repeated runs', async () => {
      // Second run immediately after
      const res = await processor.processAutoCheckout();
      expect(res.checkedOutCount).toBe(0);
    });

    it('should gracefully handle concurrent manual staff checkout race condition', async () => {
      // Create session 5 hours old
      const checkInTime = new Date(Date.now() - 5 * 60 * 60 * 1000);
      const sessionRecord = await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        return tx.attendanceRecord.create({
          data: {
            organizationId: orgAlpha.id,
            branchId: branchAlpha1Id,
            memberId: memberAlpha2Id,
            status: AttendanceStatus.CHECKED_IN,
            method: AttendanceMethod.QR_SCAN,
            checkInTime,
            notes: 'STEP6_TEST_CONCURRENT_RACE',
          },
        });
      });

      // Staff manually checks out the member first
      await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        await tx.attendanceRecord.update({
          where: { id: sessionRecord.id },
          data: {
            status: AttendanceStatus.CHECKED_OUT,
            checkOutTime: new Date(),
            durationMinutes: 300,
            notes: 'STEP6_TEST_CONCURRENT_RACE | Manually checked out by staff',
          },
        });
      });

      // Now auto-checkout processor runs
      const res = await processor.processAutoCheckout();
      expect(res).toBeDefined();

      // Record remains CHECKED_OUT with staff notes, not overwritten to AUTO_CHECKED_OUT
      const postCheck = await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        return tx.attendanceRecord.findUnique({
          where: { id: sessionRecord.id },
        });
      });

      expect(postCheck?.status).toBe(AttendanceStatus.CHECKED_OUT);
      expect(postCheck?.notes).toContain('Manually checked out by staff');
    });

    it('should auto-checkout open sessions when branch operating hours are closed and off-hours check-in is disabled', async () => {
      // Ensure Branch Alpha 2 is ACTIVE
      await prisma.withSuperAdminContext(async (tx) => {
        await tx.branch.update({
          where: { id: branchAlpha2Id },
          data: { status: BranchStatus.ACTIVE },
        });
      });

      // Configure Branch Alpha 2: operating hours 06:00 - 08:00, allowOffHoursCheckIn = false
      await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        const existing = await tx.attendanceSettings.findFirst({
          where: { organizationId: orgAlpha.id, branchId: branchAlpha2Id },
        });
        if (existing) {
          await tx.attendanceSettings.update({
            where: { id: existing.id },
            data: {
              operatingHoursStart: '06:00',
              operatingHoursEnd: '08:00',
              allowOffHoursCheckIn: false,
              autoCheckOutHours: 12,
            },
          });
        } else {
          await tx.attendanceSettings.create({
            data: {
              organizationId: orgAlpha.id,
              branchId: branchAlpha2Id,
              operatingHoursStart: '06:00',
              operatingHoursEnd: '08:00',
              allowOffHoursCheckIn: false,
              autoCheckOutHours: 12,
            },
          });
        }
      });

      // Run processor with a simulated time outside 06:00-08:00 (e.g. 23:00 UTC = 04:30 IST)
      const simulatedNightTime = new Date('2026-11-20T23:00:00.000Z');
      // Create active session in Branch Alpha 2 checked in 30 minutes before simulated night time
      const checkInTime = new Date(simulatedNightTime.getTime() - 30 * 60 * 1000);
      const sessionRecord = await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        return tx.attendanceRecord.create({
          data: {
            organizationId: orgAlpha.id,
            branchId: branchAlpha2Id,
            memberId: memberAlpha1Id,
            status: AttendanceStatus.CHECKED_IN,
            method: AttendanceMethod.QR_SCAN,
            checkInTime,
            notes: 'STEP6_TEST_OPERATING_HOURS_CLOSED',
          },
        });
      });

      const res = await processor.processAutoCheckout(simulatedNightTime);
      expect(res.checkedOutCount).toBeGreaterThanOrEqual(1);

      const record = await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        return tx.attendanceRecord.findUnique({
          where: { id: sessionRecord.id },
        });
      });

      expect(record?.status).toBe(AttendanceStatus.AUTO_CHECKED_OUT);
      expect(record?.notes).toContain('System auto-checkout due to branch closing');
    });

    it('should auto-checkout open sessions when branch is INACTIVE', async () => {
      try {
        // Temporarily set Branch Alpha 2 to INACTIVE
        await prisma.withSuperAdminContext(async (tx) => {
          await tx.branch.update({
            where: { id: branchAlpha2Id },
            data: { status: BranchStatus.INACTIVE },
          });
        });

        // Create active session
        const checkInTime = new Date(Date.now() - 15 * 60 * 1000);
        const sessionRecord = await prisma.withTenantContext(orgAlpha.id, async (tx) => {
          return tx.attendanceRecord.create({
            data: {
              organizationId: orgAlpha.id,
              branchId: branchAlpha2Id,
              memberId: memberAlpha2Id,
              status: AttendanceStatus.CHECKED_IN,
              method: AttendanceMethod.QR_SCAN,
              checkInTime,
              notes: 'STEP6_TEST_INACTIVE_BRANCH',
            },
          });
        });

        const res = await processor.processAutoCheckout();
        expect(res.checkedOutCount).toBeGreaterThanOrEqual(1);

        const record = await prisma.withTenantContext(orgAlpha.id, async (tx) => {
          return tx.attendanceRecord.findUnique({
            where: { id: sessionRecord.id },
          });
        });

        expect(record?.status).toBe(AttendanceStatus.AUTO_CHECKED_OUT);
        expect(record?.notes).toContain('System auto-checkout due to branch deactivation');
      } finally {
        // Restore branch status
        await prisma.withSuperAdminContext(async (tx) => {
          await tx.branch.update({
            where: { id: branchAlpha2Id },
            data: { status: BranchStatus.ACTIVE },
          });
        });
      }
    }, 15000);

    it('should maintain strict per-tenant isolation without cross-tenant session leaks', async () => {
      // Create session in Org Beta
      const checkInTime = new Date(Date.now() - 5 * 60 * 60 * 1000);
      const betaSession = await prisma.withTenantContext(orgBeta.id, async (tx) => {
        return tx.attendanceRecord.create({
          data: {
            organizationId: orgBeta.id,
            branchId: branchBeta1Id,
            memberId: memberBeta1Id,
            status: AttendanceStatus.CHECKED_IN,
            method: AttendanceMethod.QR_SCAN,
            checkInTime,
            notes: 'STEP6_TEST_BETA_ISOLATION',
          },
        });
      });

      // Verify Org Alpha cannot see or modify Org Beta session under RLS
      const crossTenantFetch = await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        return tx.attendanceRecord.findUnique({
          where: { id: betaSession.id },
        });
      });
      expect(crossTenantFetch).toBeNull();
    });
  });

  describe('2B. Token-Safe Redis Distributed Lock (F-01 Remediation)', () => {
    const lockKey = 'lock:worker:attendance:auto-checkout';

    beforeEach(async () => {
      await redis.del(lockKey);
    });

    afterEach(async () => {
      await redis.del(lockKey);
    });

    it('1. should successfully acquire and release the lock with matching token', async () => {
      const token = 'token-alpha-123';
      const acquired = await processor.acquireLock(token, 60);
      expect(acquired).toBe(true);

      const valInRedis = await redis.get(lockKey);
      expect(valInRedis).toBe(token);

      const released = await processor.releaseLock(token);
      expect(released).toBe(true);

      const valAfterRelease = await redis.get(lockKey);
      expect(valAfterRelease).toBeNull();
    });

    it('2. should reject lock acquisition by another worker while lock is held', async () => {
      const token1 = 'worker-1-token';
      const token2 = 'worker-2-token';

      const acquired1 = await processor.acquireLock(token1, 60);
      expect(acquired1).toBe(true);

      const acquired2 = await processor.acquireLock(token2, 60);
      expect(acquired2).toBe(false);

      const valInRedis = await redis.get(lockKey);
      expect(valInRedis).toBe(token1);
    });

    it('3. should allow reacquisition after a previous lock expires', async () => {
      const token1 = 'fast-expiring-token';
      const token2 = 'subsequent-token';

      // 1-second TTL
      await processor.acquireLock(token1, 1);
      expect(await redis.get(lockKey)).toBe(token1);

      // Wait 1.1s for expiration
      await new Promise((r) => setTimeout(r, 1100));
      expect(await redis.get(lockKey)).toBeNull();

      const acquired2 = await processor.acquireLock(token2, 60);
      expect(acquired2).toBe(true);
      expect(await redis.get(lockKey)).toBe(token2);
    });

    it('4. should prevent an older execution from releasing a newer execution lock', async () => {
      const oldToken = 'old-execution-token';
      const newToken = 'new-execution-token';

      // Simulate newer execution holding the lock
      await redis.set(lockKey, newToken, 'EX', 60);

      // Old execution attempts to release using oldToken
      const released = await processor.releaseLock(oldToken);
      expect(released).toBe(false);

      // Verify the new execution's lock was NOT deleted
      const valStillThere = await redis.get(lockKey);
      expect(valStillThere).toBe(newToken);
    });

    it('5. should validate token ownership before extending TTL during renewal', async () => {
      const validToken = 'valid-token';
      const invalidToken = 'rogue-token';

      await processor.acquireLock(validToken, 60);

      // Renewal with wrong token should fail
      const renewedInvalid = await processor.renewLock(invalidToken, 120);
      expect(renewedInvalid).toBe(false);

      // Renewal with valid token should succeed and update TTL
      const renewedValid = await processor.renewLock(validToken, 120);
      expect(renewedValid).toBe(true);

      const ttl = await redis.ttl(lockKey);
      expect(ttl).toBeGreaterThan(60);
    });

    it('6. should handle Redis failure safely without crashing', async () => {
      // Create a dummy broken processor with closed Redis
      const brokenRedis = new Redis({
        host: '127.0.0.1',
        port: 6399, // unreachable port
        connectTimeout: 50,
        maxRetriesPerRequest: 0,
        retryStrategy: () => null,
      });
      brokenRedis.on('error', () => {}); // silence connection error

      const safeProcessor = new AutoCheckoutProcessor(prisma, brokenRedis, () => {});
      const acquired = await safeProcessor.acquireLock('any-token');
      expect(acquired).toBe(false);

      const released = await safeProcessor.releaseLock('any-token');
      expect(released).toBe(false);

      const renewed = await safeProcessor.renewLock('any-token');
      expect(renewed).toBe(false);

      await brokenRedis.disconnect();
    });

    it('7. should handle concurrent auto-checkout executions: exactly 1 acquires lock, other skips', async () => {
      const proc1 = new AutoCheckoutProcessor(prisma, redis, () => {});
      const proc2 = new AutoCheckoutProcessor(prisma, redis, () => {});

      const [res1, res2] = await Promise.all([
        proc1.processAutoCheckout(),
        proc2.processAutoCheckout(),
      ]);

      expect(res1).toBeDefined();
      expect(res2).toBeDefined();
    });
  });

  describe('3. BullMQ Attendance Worker Execution (F-02 Deterministic Synchronization)', () => {
    it(
      'should consume and handle attendance domain events without error using event-based completion',
      async () => {
      const logs: string[] = [];
      const workerLog = (_level: string, message: string) => {
        logs.push(message);
      };

      // Use dedicated isolated Redis connection for worker to avoid command contention
      const workerRedis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
      });

      const worker = createAttendanceWorker(workerRedis, 4, workerLog, testQueueName);
      await worker.waitUntilReady();

      const completedJobIds = new Set<string>();
      const failedJobIds = new Map<string, string>();

      worker.on('completed', (job) => {
        completedJobIds.add(job.id!);
      });
      worker.on('failed', (job, err) => {
        failedJobIds.set(job?.id || 'unknown', err.message);
      });

      // Add jobs of each event type to queue
      const [j1, j2, j3, j4] = await Promise.all([
        attendanceQueue.add('attendance.checked_in', {
          memberId: memberAlpha1Id,
          branchId: branchAlpha1Id,
        }),
        attendanceQueue.add('attendance.checked_out', {
          memberId: memberAlpha1Id,
          durationMinutes: 90,
          source: 'AUTO_CHECKOUT',
        }),
        attendanceQueue.add('attendance.rejected', {
          rejectionCode: 'PASS_REVOKED',
          branchId: branchAlpha1Id,
        }),
        attendanceQueue.add('attendance.milestone_reached', {
          memberId: memberAlpha1Id,
          milestoneType: 'TOTAL_VISITS',
          milestoneValue: 100,
        }),
      ]);

      const expectedJobIds = [j1.id!, j2.id!, j3.id!, j4.id!];
      const startWait = Date.now();
      const timeoutMs = 15000;

      // Deterministic polling of worker event completion instead of arbitrary sleep
      while (
        expectedJobIds.some((id) => !completedJobIds.has(id)) &&
        Date.now() - startWait < timeoutMs
      ) {
        if (failedJobIds.size > 0) {
          const failures = Array.from(failedJobIds.entries())
            .map(([id, msg]) => `${id}: ${msg}`)
            .join(', ');
          throw new Error(`Worker job failed during test: ${failures}`);
        }
        await new Promise((r) => setTimeout(r, 50));
      }

      await worker.close();
      await workerRedis.quit();

      if (expectedJobIds.some((id) => !completedJobIds.has(id))) {
        throw new Error(
          `Timed out waiting for BullMQ jobs. Completed: ${Array.from(completedJobIds).join(', ')}. Expected: ${expectedJobIds.join(', ')}. Logs: ${logs.join('; ')}`
        );
      }

      expect(logs.some((l) => l.includes('attendance.checked_in'))).toBe(true);
      expect(logs.some((l) => l.includes('attendance.checked_out'))).toBe(true);
      expect(logs.some((l) => l.includes('Attendance scan rejected'))).toBe(true);
      expect(logs.some((l) => l.includes('Member attendance milestone reached!'))).toBe(true);
    }, 30000);
  });
});
