import { PrismaClient, FeatureValueType, SaasSubscriptionStatus } from '@prisma/client';

const prisma = new PrismaClient();

const FEATURES = [
  // Core
  { key: 'core.branches.max', domain: 'core', name: 'Maximum Branches', valueType: FeatureValueType.NUMERIC, description: 'Maximum active branches the gym can operate.' },
  { key: 'core.branches.manage', domain: 'core', name: 'Branch Management', valueType: FeatureValueType.BOOLEAN, description: 'Ability to configure branch profiles and working hours.' },
  { key: 'core.staff.max', domain: 'core', name: 'Maximum Staff Accounts', valueType: FeatureValueType.NUMERIC, description: 'Maximum staff logins permitted.' },
  { key: 'core.staff.roles', domain: 'core', name: 'Custom Staff RBAC', valueType: FeatureValueType.BOOLEAN, description: 'Custom staff roles and branch assignments.' },
  { key: 'core.audit_logs.view', domain: 'core', name: 'Security Audit Logs', valueType: FeatureValueType.BOOLEAN, description: 'Access to system security audit trails.' },

  // Members
  { key: 'members.max_active', domain: 'members', name: 'Maximum Active Members', valueType: FeatureValueType.NUMERIC, description: 'Total active member capacity.' },
  { key: 'members.directory', domain: 'members', name: 'Member Directory', valueType: FeatureValueType.BOOLEAN, description: 'Member listing, profiles, and status.' },
  { key: 'members.import_export', domain: 'members', name: 'Bulk Import / Export', valueType: FeatureValueType.BOOLEAN, description: 'CSV bulk import and export.' },
  { key: 'members.documents', domain: 'members', name: 'Digital KYC & Waivers', valueType: FeatureValueType.BOOLEAN, description: 'Storage of member documents.' },
  { key: 'members.notes_medical', domain: 'members', name: 'Health & Medical Profiling', valueType: FeatureValueType.BOOLEAN, description: 'Member injury history and medical notes.' },

  // Memberships
  { key: 'memberships.plans.manage', domain: 'memberships', name: 'Membership Plan Creator', valueType: FeatureValueType.BOOLEAN, description: 'Create and price membership plans.' },
  { key: 'memberships.renewals', domain: 'memberships', name: 'Membership Renewals', valueType: FeatureValueType.BOOLEAN, description: 'Renewal tracking and contract extension.' },
  { key: 'memberships.freeze_thaw', domain: 'memberships', name: 'Contract Freeze & Thaw', valueType: FeatureValueType.BOOLEAN, description: 'Temporarily pause membership days.' },
  { key: 'memberships.transfer', domain: 'memberships', name: 'Membership Transfer', valueType: FeatureValueType.BOOLEAN, description: 'Transfer membership between members.' },

  // Attendance
  { key: 'attendance.reception_scanner', domain: 'attendance', name: 'Reception Camera Scanner', valueType: FeatureValueType.BOOLEAN, description: 'Front desk camera scanning member QR.' },
  { key: 'attendance.kiosk_qr', domain: 'attendance', name: 'Daily Counter Display QR', valueType: FeatureValueType.BOOLEAN, description: 'Reception tablet daily rotating QR for self check-in.' },
  { key: 'attendance.manual_checkin', domain: 'attendance', name: 'Staff Manual Check-in', valueType: FeatureValueType.BOOLEAN, description: 'Manual staff check-in entry.' },
  { key: 'attendance.badge_passcodes', domain: 'attendance', name: 'Physical 6-Digit Passcodes', valueType: FeatureValueType.BOOLEAN, description: 'Keypad / RFID check-in codes.' },
  { key: 'attendance.auto_checkout', domain: 'attendance', name: 'Distributed Auto-Checkout', valueType: FeatureValueType.BOOLEAN, description: 'Background worker closing open sessions.' },
  { key: 'attendance.export_csv', domain: 'attendance', name: 'Attendance History CSV', valueType: FeatureValueType.BOOLEAN, description: 'UTF-8 BOM compliant attendance logs export.' },
  { key: 'attendance.turnstile_api', domain: 'attendance', name: 'Hardware Turnstile Webhook', valueType: FeatureValueType.BOOLEAN, description: 'Integration with biometric turnstiles.' },

  // Billing
  { key: 'billing.invoices', domain: 'billing', name: 'Automated Tax Invoices', valueType: FeatureValueType.BOOLEAN, description: 'Generation of compliant tax invoices.' },
  { key: 'billing.payments', domain: 'billing', name: 'Payment Tracking & Receipts', valueType: FeatureValueType.BOOLEAN, description: 'Cash, UPI, and Card payment recording.' },
  { key: 'billing.dues_tracking', domain: 'billing', name: 'Aging Dues Tracking', valueType: FeatureValueType.BOOLEAN, description: 'Overdue tracking and collection management.' },
  { key: 'billing.credits', domain: 'billing', name: 'Member Credit Wallets', valueType: FeatureValueType.BOOLEAN, description: 'Advance payments and internal credit ledger.' },
  { key: 'billing.refunds', domain: 'billing', name: 'Partial & Full Refunds', valueType: FeatureValueType.BOOLEAN, description: 'Staff refund processing.' },
  { key: 'billing.online_gateway', domain: 'billing', name: 'Integrated Payment Gateway', valueType: FeatureValueType.BOOLEAN, description: 'Online payment links for dues.' },

  // Training
  { key: 'training.trainers.manage', domain: 'training', name: 'Trainer Management', valueType: FeatureValueType.BOOLEAN, description: 'Trainer roster and assignments.' },
  { key: 'training.workout_builder', domain: 'training', name: 'Workout Plan Builder', valueType: FeatureValueType.BOOLEAN, description: 'Routines and exercise database.' },
  { key: 'training.diet_builder', domain: 'training', name: 'Diet & Nutrition Creator', valueType: FeatureValueType.BOOLEAN, description: 'Macronutrient and meal planner.' },
  { key: 'training.client_logging', domain: 'training', name: 'Member Workout Logging', valueType: FeatureValueType.BOOLEAN, description: 'Members logging exercises in portal.' },

  // CRM
  { key: 'crm.leads.max', domain: 'crm', name: 'Maximum Stored Leads', valueType: FeatureValueType.NUMERIC, description: 'Maximum prospective member leads.' },
  { key: 'crm.pipeline', domain: 'crm', name: 'Visual Sales Kanban Pipeline', valueType: FeatureValueType.BOOLEAN, description: 'Drag-and-drop lead stages.' },
  { key: 'crm.followups', domain: 'crm', name: 'Follow-up Call Scheduling', valueType: FeatureValueType.BOOLEAN, description: 'Task queue for trials and leads.' },
  { key: 'crm.lead_sources', domain: 'crm', name: 'Attribution & Source ROI', valueType: FeatureValueType.BOOLEAN, description: 'Tracking lead acquisition channels.' },

  // Communication & WhatsApp
  { key: 'communication.email.notifications', domain: 'communication', name: 'Transactional Email', valueType: FeatureValueType.BOOLEAN, description: 'Automated receipts and welcome emails.' },
  { key: 'communication.whatsapp.official', domain: 'communication', name: 'WhatsApp Cloud API', valueType: FeatureValueType.BOOLEAN, description: 'Official WhatsApp connectivity.' },
  { key: 'communication.whatsapp.monthly_quota', domain: 'communication', name: 'Monthly WhatsApp Messages', valueType: FeatureValueType.NUMERIC, description: 'Included monthly WhatsApp messages.' },
  { key: 'communication.broadcasts', domain: 'communication', name: 'Promotional Campaigns', valueType: FeatureValueType.BOOLEAN, description: 'Mass broadcasts to members or leads.' },

  // Automation
  { key: 'automation.expiry_alerts', domain: 'automation', name: 'Expiry Reminders', valueType: FeatureValueType.BOOLEAN, description: 'Automated warnings prior to expiry.' },
  { key: 'automation.dues_reminders', domain: 'automation', name: 'Payment Reminders', valueType: FeatureValueType.BOOLEAN, description: 'Overdue invoice alerts.' },
  { key: 'automation.birthday_wishes', domain: 'automation', name: 'Birthday & Occasion Messages', valueType: FeatureValueType.BOOLEAN, description: 'Automated celebratory messages.' },
  { key: 'automation.custom_workflows', domain: 'automation', name: 'Visual Workflow Builder', valueType: FeatureValueType.BOOLEAN, description: 'Custom event-based workflow builder.' },

  // Reports
  { key: 'reports.basic_kpis', domain: 'reports', name: 'Operational KPI Dashboard', valueType: FeatureValueType.BOOLEAN, description: 'Check-ins, members, revenue overview.' },
  { key: 'reports.financial_advanced', domain: 'reports', name: 'Financial & Tax Reports', valueType: FeatureValueType.BOOLEAN, description: 'Cashflow and GST reports.' },
  { key: 'reports.retention_churn', domain: 'reports', name: 'Retention & Churn Analytics', valueType: FeatureValueType.BOOLEAN, description: 'Renewal rates and drop-off heatmaps.' },

  // AI
  { key: 'ai.member_engagement', domain: 'ai', name: 'AI Churn Predictor', valueType: FeatureValueType.BOOLEAN, description: 'AI predicting member churn before expiry.' },
  { key: 'ai.workout_generator', domain: 'ai', name: 'AI Workout Generator', valueType: FeatureValueType.BOOLEAN, description: 'AI personalized exercise routines.' },
  { key: 'ai.business_insights', domain: 'ai', name: 'Executive Revenue Copilot', valueType: FeatureValueType.BOOLEAN, description: 'AI business optimization insights.' },
];

async function seed() {
  console.log('Seeding Feature Catalog...');
  for (const f of FEATURES) {
    await prisma.featureCatalog.upsert({
      where: { key: f.key },
      update: { name: f.name, domain: f.domain, valueType: f.valueType, description: f.description },
      create: f,
    });
  }

  console.log('Seeding SaaS Plans...');
  // 1. Starter Plan
  const starter = await prisma.saasPlan.upsert({
    where: { code: 'starter' },
    update: { name: 'GymOS Starter', monthlyPrice: 1999, annualPrice: 19999 },
    create: {
      code: 'starter',
      name: 'GymOS Starter',
      description: 'Essential toolkit for single-branch fitness studios and small gyms.',
      monthlyPrice: 1999,
      annualPrice: 19999,
      currency: 'INR',
      sortOrder: 1,
    },
  });

  // 2. Pro Plan
  const pro = await prisma.saasPlan.upsert({
    where: { code: 'pro' },
    update: { name: 'GymOS Pro', monthlyPrice: 4999, annualPrice: 49999 },
    create: {
      code: 'pro',
      name: 'GymOS Pro',
      description: 'High-growth platform with Leads CRM, WhatsApp integration, and workout planners.',
      monthlyPrice: 4999,
      annualPrice: 49999,
      currency: 'INR',
      sortOrder: 2,
    },
  });

  // 3. Enterprise Plan
  const enterprise = await prisma.saasPlan.upsert({
    where: { code: 'enterprise' },
    update: { name: 'GymOS Enterprise', monthlyPrice: 9999, annualPrice: 99999 },
    create: {
      code: 'enterprise',
      name: 'GymOS Enterprise',
      description: 'Unlimited multi-branch franchise operating system with custom automations and AI suite.',
      monthlyPrice: 9999,
      annualPrice: 99999,
      currency: 'INR',
      sortOrder: 3,
    },
  });

  console.log('Configuring Plan Features & Quotas...');
  // Configure Starter: basic core + qr attendance + billing
  for (const f of FEATURES) {
    const isStarter = f.domain === 'core' || f.domain === 'attendance' || f.domain === 'members' || f.key === 'billing.invoices' || f.key === 'billing.payments' || f.key === 'reports.basic_kpis';
    let quota = null;
    if (f.key === 'core.branches.max') quota = 1;
    if (f.key === 'core.staff.max') quota = 3;
    if (f.key === 'members.max_active') quota = 250;
    if (f.key === 'crm.leads.max') quota = 100;
    if (f.key === 'communication.whatsapp.monthly_quota') quota = 0;

    await prisma.saasPlanFeature.upsert({
      where: { unique_plan_feature: { planId: starter.id, featureKey: f.key } },
      update: { isEnabled: isStarter, numericQuota: quota },
      create: { planId: starter.id, featureKey: f.key, isEnabled: isStarter, numericQuota: quota },
    });
  }

  // Configure Pro: everything except custom workflows and turnstile/ai
  for (const f of FEATURES) {
    const isPro = !f.key.startsWith('ai.') && f.key !== 'attendance.turnstile_api' && f.key !== 'automation.custom_workflows';
    let quota = null;
    if (f.key === 'core.branches.max') quota = 3;
    if (f.key === 'core.staff.max') quota = 10;
    if (f.key === 'members.max_active') quota = 1000;
    if (f.key === 'crm.leads.max') quota = 1000;
    if (f.key === 'communication.whatsapp.monthly_quota') quota = 500;

    await prisma.saasPlanFeature.upsert({
      where: { unique_plan_feature: { planId: pro.id, featureKey: f.key } },
      update: { isEnabled: isPro, numericQuota: quota },
      create: { planId: pro.id, featureKey: f.key, isEnabled: isPro, numericQuota: quota },
    });
  }

  // Configure Enterprise: all features enabled, high quotas
  for (const f of FEATURES) {
    let quota = null;
    if (f.key === 'core.branches.max') quota = 25;
    if (f.key === 'core.staff.max') quota = 100;
    if (f.key === 'members.max_active') quota = 10000;
    if (f.key === 'crm.leads.max') quota = 25000;
    if (f.key === 'communication.whatsapp.monthly_quota') quota = 5000;

    await prisma.saasPlanFeature.upsert({
      where: { unique_plan_feature: { planId: enterprise.id, featureKey: f.key } },
      update: { isEnabled: true, numericQuota: quota },
      create: { planId: enterprise.id, featureKey: f.key, isEnabled: true, numericQuota: quota },
    });
  }

  // Link existing organizations to Enterprise plan so no existing tests/gyms are broken
  console.log('Enrolling existing organizations in Enterprise subscription...');
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL app.is_super_admin = 'true';");
    const orgs = await tx.organization.findMany({ select: { id: true, name: true } });
    const start = new Date();
    const end = new Date();
    end.setFullYear(end.getFullYear() + 2); // 2 years valid subscription

    for (const org of orgs) {
      const existingSub = await tx.organizationSubscription.findFirst({
        where: { organizationId: org.id },
      });
      if (!existingSub) {
        await tx.organizationSubscription.create({
          data: {
            organizationId: org.id,
            planId: enterprise.id,
            status: SaasSubscriptionStatus.ACTIVE,
            currentPeriodStart: start,
            currentPeriodEnd: end,
            agreedPrice: 0,
            billingInterval: 'ANNUAL',
            notes: 'Auto-enrolled during Stage 2.8 Modular SaaS migration',
          },
        });
        console.log(`Enrolled ${org.name} (${org.id})`);
      }
    }
  });

  console.log('Seeding completed successfully!');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
