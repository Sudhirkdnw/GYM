/**
 * GymOS - SuperAdmin Creation & Seeding CLI
 *
 * Usage:
 *   node scripts/create-superadmin.js [email] [password] [firstName] [lastName] [gymName]
 *
 * Examples:
 *   node scripts/create-superadmin.js
 *   node scripts/create-superadmin.js myadmin@gymos.com MySecurePassword123!
 */

const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

async function main() {
  const email = (process.argv[2] || 'admin@gymos.com').toLowerCase().trim();
  const password = process.argv[3] || 'SuperAdmin@123';
  const firstName = process.argv[4] || 'System';
  const lastName = process.argv[5] || 'Admin';
  const gymName = process.argv[6] || 'GymOS Flagship HQ';

  console.log('----------------------------------------------------');
  console.log('🏋️  GymOS — SuperAdmin Account Provisioning');
  console.log('----------------------------------------------------');
  console.log(`Email:      ${email}`);
  console.log(`Password:   ${password}`);
  console.log(`Name:       ${firstName} ${lastName}`);
  console.log(`Tenant Org: ${gymName}`);
  console.log('----------------------------------------------------');

  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

  await prisma.$transaction(async (tx) => {
    // Elevate transaction to SuperAdmin context for RLS bypass
    await tx.$executeRawUnsafe(`SET LOCAL app.is_super_admin = 'true';`);

    // Upsert user
    let user = await tx.user.findUnique({
      where: { email },
    });

    if (user) {
      user = await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          firstName,
          lastName,
          isSuperAdmin: true,
          status: 'ACTIVE',
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
      console.log(`✅ Existing user '${email}' updated to SuperAdmin with new password.`);
    } else {
      user = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          isSuperAdmin: true,
          status: 'ACTIVE',
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
      console.log(`✅ SuperAdmin user '${email}' created successfully!`);
    }

    // Ensure user has at least one active organization membership for seamless dashboard entry
    let membership = await tx.organizationUser.findFirst({
      where: { userId: user.id },
      include: { organization: true },
    });

    if (!membership) {
      const slug = 'gymos-hq-' + Date.now().toString().slice(-4);
      const org = await tx.organization.create({
        data: {
          name: gymName,
          slug,
          status: 'ACTIVE',
          legalName: 'GymOS SaaS HQ',
          businessEmail: email,
          city: 'Delhi',
          country: 'India',
          currency: 'INR',
          timezone: 'Asia/Kolkata',
        },
      });

      membership = await tx.organizationUser.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: 'GYM_OWNER',
        },
        include: { organization: true },
      });

      console.log(`✅ Default Organization '${gymName}' (${slug}) created and linked with GYM_OWNER role.`);
    } else {
      console.log(`ℹ️ User is already linked to Organization '${membership.organization.name}'.`);
    }
  });

  console.log('\n====================================================');
  console.log('🎉 SuperAdmin Credentials Ready for Login:');
  console.log(`   🔗 Web Login URL:  http://localhost:3000/login`);
  console.log(`   📧 Email:          ${email}`);
  console.log(`   🔑 Password:       ${password}`);
  console.log(`   🛡️ Role:           SuperAdmin + Gym Owner`);
  console.log('====================================================\n');
}

main()
  .catch((err) => {
    console.error('❌ Failed to provision SuperAdmin:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
