/**
 * GymOS — Database Seeder
 *
 * Seeds:
 * 1. Head Platform SuperAdmin (Platform Owner)
 * 2. Platform HQ Organization
 * 3. Multiple Gym Organizations with their respective Gym Admins/Owners, Trainers, and Branches.
 *
 * Usage:
 *   npx prisma db seed
 *   npm run seed
 */

import {
  PrismaClient,
  UserStatus,
  TenantStatus,
  UserRole,
  BranchStatus,
  AssignmentStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const ARGON2_OPTIONS = {
  type: argon2.argon2id as 0 | 1 | 2,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

async function main() {
  console.log('\n================================================================');
  console.log('🏋️  GymOS — Database Seeder (Platform SuperAdmin & Organizations)');
  console.log('================================================================\n');

  const defaultPassword = 'Password@123';
  const superAdminPassword = 'SuperAdmin@123';

  const defaultPasswordHash = await argon2.hash(defaultPassword, ARGON2_OPTIONS);
  const superAdminPasswordHash = await argon2.hash(superAdminPassword, ARGON2_OPTIONS);

  // Wrap all seeding in a transaction with SuperAdmin RLS bypass context
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.is_super_admin = 'true';`);

    // -------------------------------------------------------------
    // 1. HEAD PLATFORM SUPERADMIN (The Head / Master Admin)
    // -------------------------------------------------------------
    const superAdminEmail = 'superadmin@gymos.com';
    let superAdmin = await tx.user.findUnique({
      where: { email: superAdminEmail },
    });

    if (!superAdmin) {
      superAdmin = await tx.user.create({
        data: {
          email: superAdminEmail,
          passwordHash: superAdminPasswordHash,
          firstName: 'Platform',
          lastName: 'Head',
          isSuperAdmin: true,
          status: UserStatus.ACTIVE,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
      console.log(`✅ [SuperAdmin] Created Master Head: ${superAdminEmail}`);
    } else {
      superAdmin = await tx.user.update({
        where: { id: superAdmin.id },
        data: {
          isSuperAdmin: true,
          status: UserStatus.ACTIVE,
          emailVerified: true,
          passwordHash: superAdminPasswordHash,
        },
      });
      console.log(`ℹ️ [SuperAdmin] Updated Master Head: ${superAdminEmail}`);
    }

    // -------------------------------------------------------------
    // 2. PLATFORM HQ TENANT (Default Organization for SuperAdmin)
    // -------------------------------------------------------------
    let hqOrg = await tx.organization.findUnique({
      where: { slug: 'gymos-hq' },
    });

    if (!hqOrg) {
      hqOrg = await tx.organization.create({
        data: {
          name: 'GymOS Platform HQ',
          slug: 'gymos-hq',
          legalName: 'GymOS Global SaaS Inc.',
          businessEmail: 'headquarters@gymos.com',
          businessPhone: '+91 99999 00000',
          city: 'New Delhi',
          state: 'Delhi',
          country: 'India',
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          status: TenantStatus.ACTIVE,
        },
      });
      console.log(`✅ [Organization] Created HQ: ${hqOrg.name}`);
    }

    // Link SuperAdmin to HQ Organization as GYM_OWNER
    const existingHqMembership = await tx.organizationUser.findUnique({
      where: {
        unique_org_user: {
          organizationId: hqOrg.id,
          userId: superAdmin.id,
        },
      },
    });

    if (!existingHqMembership) {
      await tx.organizationUser.create({
        data: {
          organizationId: hqOrg.id,
          userId: superAdmin.id,
          role: UserRole.GYM_OWNER,
        },
      });
      console.log(`✅ [Membership] Linked SuperAdmin to ${hqOrg.name}`);
    }

    // -------------------------------------------------------------
    // 3. SAMPLE ORGANIZATIONS & TENANT ADMINS
    // -------------------------------------------------------------
    const sampleTenants = [
      {
        name: 'Apex Fitness Club',
        slug: 'apex-fitness',
        legalName: 'Apex Fitness Private Limited',
        businessEmail: 'contact@apexfitness.com',
        businessPhone: '+91 98765 43210',
        city: 'New Delhi',
        state: 'Delhi',
        country: 'India',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        owner: {
          email: 'owner@apexfitness.com',
          firstName: 'Vikram',
          lastName: 'Malhotra',
        },
        trainer: {
          email: 'trainer@apexfitness.com',
          firstName: 'Rahul',
          lastName: 'Sharma',
        },
        branches: [
          {
            name: 'Apex Sector 18 (Main Branch)',
            slug: 'apex-sector-18',
            branchCode: 'APX-DEL-01',
            city: 'Noida',
            state: 'Uttar Pradesh',
            country: 'India',
            addressLine1: 'Block K, Sector 18 Commercial Hub',
            phone: '+91 98765 43211',
            email: 'sector18@apexfitness.com',
            timezone: 'Asia/Kolkata',
          },
          {
            name: 'Apex Cyber City Hub',
            slug: 'apex-cyber-city',
            branchCode: 'APX-GGN-01',
            city: 'Gurugram',
            state: 'Haryana',
            country: 'India',
            addressLine1: 'Building 10B, DLF Cyber City',
            phone: '+91 98765 43212',
            email: 'cybercity@apexfitness.com',
            timezone: 'Asia/Kolkata',
          },
        ],
      },
      {
        name: 'Iron Strong Gym',
        slug: 'iron-strong',
        legalName: 'Iron Strong Fitness LLP',
        businessEmail: 'info@ironstrong.com',
        businessPhone: '+91 98111 22334',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        owner: {
          email: 'owner@ironstrong.com',
          firstName: 'Sameer',
          lastName: 'Khan',
        },
        trainer: {
          email: 'trainer@ironstrong.com',
          firstName: 'Karan',
          lastName: 'Patel',
        },
        branches: [
          {
            name: 'Iron Strong Bandra West',
            slug: 'iron-strong-bandra',
            branchCode: 'IRN-BOM-01',
            city: 'Mumbai',
            state: 'Maharashtra',
            country: 'India',
            addressLine1: 'Hill Road, Near Bandra Station',
            phone: '+91 98111 22335',
            email: 'bandra@ironstrong.com',
            timezone: 'Asia/Kolkata',
          },
        ],
      },
      {
        name: 'Zenith CrossFit & Yoga',
        slug: 'zenith-crossfit',
        legalName: 'Zenith Holistic Wellness Studios',
        businessEmail: 'hello@zenithcrossfit.com',
        businessPhone: '+91 98222 33445',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        owner: {
          email: 'owner@zenithcrossfit.com',
          firstName: 'Ananya',
          lastName: 'Iyer',
        },
        trainer: {
          email: 'trainer@zenithcrossfit.com',
          firstName: 'Deepak',
          lastName: 'Rao',
        },
        branches: [
          {
            name: 'Zenith Indiranagar Arena',
            slug: 'zenith-indiranagar',
            branchCode: 'ZNT-BLR-01',
            city: 'Bengaluru',
            state: 'Karnataka',
            country: 'India',
            addressLine1: '100 Feet Road, Indiranagar',
            phone: '+91 98222 33446',
            email: 'indiranagar@zenithcrossfit.com',
            timezone: 'Asia/Kolkata',
          },
        ],
      },
    ];

    for (const t of sampleTenants) {
      // 1. Organization
      let org = await tx.organization.findUnique({
        where: { slug: t.slug },
      });

      if (!org) {
        org = await tx.organization.create({
          data: {
            name: t.name,
            slug: t.slug,
            legalName: t.legalName,
            businessEmail: t.businessEmail,
            businessPhone: t.businessPhone,
            city: t.city,
            state: t.state,
            country: t.country,
            timezone: t.timezone,
            currency: t.currency,
            status: TenantStatus.ACTIVE,
          },
        });
        console.log(`\n🏢 [Organization] Created Tenant: ${org.name} (${org.slug})`);
      } else {
        console.log(`\n🏢 [Organization] Existing Tenant: ${org.name}`);
      }

      // 2. Gym Owner (Admin of this gym)
      let ownerUser = await tx.user.findUnique({
        where: { email: t.owner.email },
      });

      if (!ownerUser) {
        ownerUser = await tx.user.create({
          data: {
            email: t.owner.email,
            passwordHash: defaultPasswordHash,
            firstName: t.owner.firstName,
            lastName: t.owner.lastName,
            status: UserStatus.ACTIVE,
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
        });
        console.log(`  👤 [Owner] Created Gym Admin: ${t.owner.email}`);
      }

      // Link Owner as GYM_OWNER
      const existingOwnerMembership = await tx.organizationUser.findUnique({
        where: {
          unique_org_user: {
            organizationId: org.id,
            userId: ownerUser.id,
          },
        },
      });

      if (!existingOwnerMembership) {
        await tx.organizationUser.create({
          data: {
            organizationId: org.id,
            userId: ownerUser.id,
            role: UserRole.GYM_OWNER,
          },
        });
        console.log(`  🔗 [Membership] Assigned GYM_OWNER role to ${t.owner.email}`);
      }

      // 3. Trainer / Staff
      let trainerUser = await tx.user.findUnique({
        where: { email: t.trainer.email },
      });

      if (!trainerUser) {
        trainerUser = await tx.user.create({
          data: {
            email: t.trainer.email,
            passwordHash: defaultPasswordHash,
            firstName: t.trainer.firstName,
            lastName: t.trainer.lastName,
            status: UserStatus.ACTIVE,
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
        });
        console.log(`  🏋️ [Staff] Created Trainer: ${t.trainer.email}`);
      }

      // Link Trainer as TRAINER
      let trainerMembership = await tx.organizationUser.findUnique({
        where: {
          unique_org_user: {
            organizationId: org.id,
            userId: trainerUser.id,
          },
        },
      });

      if (!trainerMembership) {
        trainerMembership = await tx.organizationUser.create({
          data: {
            organizationId: org.id,
            userId: trainerUser.id,
            role: UserRole.TRAINER,
          },
        });
        console.log(`  🔗 [Membership] Assigned TRAINER role to ${t.trainer.email}`);
      }

      // 4. Branches
      for (const b of t.branches) {
        let branch = await tx.branch.findUnique({
          where: {
            unique_org_branch_code: {
              organizationId: org.id,
              branchCode: b.branchCode,
            },
          },
        });

        if (!branch) {
          branch = await tx.branch.create({
            data: {
              organizationId: org.id,
              name: b.name,
              slug: b.slug,
              branchCode: b.branchCode,
              city: b.city,
              state: b.state,
              country: b.country,
              addressLine1: b.addressLine1,
              phone: b.phone,
              email: b.email,
              timezone: b.timezone,
              status: BranchStatus.ACTIVE,
            },
          });
          console.log(`  📍 [Branch] Created: ${b.name} (${b.branchCode})`);

          // Assign Trainer to the first branch
          const existingAssignment = await tx.branchStaffAssignment.findUnique({
            where: {
              unique_branch_org_user: {
                branchId: branch.id,
                organizationUserId: trainerMembership.id,
              },
            },
          });

          if (!existingAssignment) {
            await tx.branchStaffAssignment.create({
              data: {
                organizationId: org.id,
                branchId: branch.id,
                organizationUserId: trainerMembership.id,
                status: AssignmentStatus.ACTIVE,
                assignedBy: ownerUser.id,
              },
            });
            console.log(`  🤝 [Assignment] Assigned ${t.trainer.firstName} to ${b.name}`);
          }
        }
      }
    }
  });

  console.log('\n================================================================');
  console.log('🎉 SEEDING COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
  console.log('\n👑 1. PLATFORM SUPERADMIN (Master SaaS Head):');
  console.log('   Email:     superadmin@gymos.com');
  console.log('   Password:  SuperAdmin@123');
  console.log('   Access:    Full platform access, all organizations, cross-tenant switch');

  console.log('\n🏢 2. GYM ADMINS / TENANT OWNERS (Password for all: Password@123):');
  console.log('   • Apex Fitness Club:       owner@apexfitness.com (2 Branches: Noida, Gurugram)');
  console.log('   • Iron Strong Gym:         owner@ironstrong.com  (1 Branch: Bandra)');
  console.log('   • Zenith CrossFit & Yoga:  owner@zenithcrossfit.com (1 Branch: Indiranagar)');

  console.log('\n🏋️ 3. TRAINERS / STAFF (Password for all: Password@123):');
  console.log('   • trainer@apexfitness.com');
  console.log('   • trainer@ironstrong.com');
  console.log('   • trainer@zenithcrossfit.com');

  console.log('\n🔗 Login URL: http://localhost:3000/login');
  console.log('================================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeder encountered an error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
