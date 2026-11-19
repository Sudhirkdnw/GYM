# GymOS — Member Database Design Specification (Stage 2.4 Planning)

## 1. Architectural Principles & Tenet Alignment

In strict alignment with the approved GymOS multi-tenant baseline:
- **Tenant Boundary**: `organizations` table (`organization_id`). Every member record is strictly owned by an Organization.
- **Physical Facility**: `branches` table (`branch_id`). Every member is assigned to a home branch within their organization.
- **Identity Decoupling**: Gym members are **NOT** `organization_users`. A gym member is a customer entity and does **NOT** require a GymOS staff login account or password.
- **Optional Portal Linkage**: Gym members may optionally link to a global `users` record (`user_id UUID NULL`) for future mobile app / self-service access, without polluting staff/RBAC identities.

---

## 2. Proposed Database Schema: `members` Table

```prisma
enum MemberStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
  ARCHIVED

  @@map("member_status")
}

enum Gender {
  MALE
  FEMALE
  OTHER
  PREFER_NOT_TO_SAY

  @@map("gender")
}

/// Gym Member represents a customer enrolled in a Gym Tenant
model Member {
  id                           String        @id @default(uuid()) @map("id") @db.Uuid
  organizationId               String        @map("organization_id") @db.Uuid
  branchId                     String        @map("branch_id") @db.Uuid
  userId                       String?       @map("user_id") @db.Uuid
  memberNumber                 String        @map("member_number") @db.VarChar(50)
  
  // Personal Details
  firstName                    String        @map("first_name") @db.VarChar(100)
  lastName                     String        @map("last_name") @db.VarChar(100)
  preferredName                String?       @map("preferred_name") @db.VarChar(100)
  gender                       Gender?       @map("gender")
  dateOfBirth                  DateTime?     @map("date_of_birth") @db.Date
  
  // Contact Details (Normalized E.164 phone & lowercase email)
  email                        String?       @map("email") @db.VarChar(255)
  phone                        String        @map("phone") @db.VarChar(50)
  
  // Address Details (Optional)
  addressLine1                 String?       @map("address_line_1") @db.VarChar(255)
  addressLine2                 String?       @map("address_line_2") @db.VarChar(255)
  city                         String?       @map("city") @db.VarChar(100)
  state                        String?       @map("state") @db.VarChar(100)
  country                      String?       @map("country") @db.VarChar(100)
  postalCode                   String?       @map("postal_code") @db.VarChar(20)
  
  // Emergency Contact Details
  emergencyContactName         String        @map("emergency_contact_name") @db.VarChar(100)
  emergencyContactPhone        String        @map("emergency_contact_phone") @db.VarChar(50)
  emergencyContactRelationship String        @map("emergency_contact_relationship") @db.VarChar(50)
  
  // Operational & Profile
  profilePhotoKey              String?       @map("profile_photo_key") @db.VarChar(500)
  notes                        String?       @map("notes") @db.Text
  status                       MemberStatus  @default(ACTIVE) @map("status")
  joinedAt                     DateTime      @default(now()) @map("joined_at") @db.Timestamptz
  
  // Audit Trail & Archival
  createdAt                    DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt                    DateTime      @updatedAt @map("updated_at") @db.Timestamptz
  createdBy                    String?       @map("created_by") @db.Uuid
  updatedBy                    String?       @map("updated_by") @db.Uuid
  archivedAt                   DateTime?     @map("archived_at") @db.Timestamptz
  archivedBy                   String?       @map("archived_by") @db.Uuid

  // Relations
  organization                 Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  branch                       Branch        @relation(fields: [branchId], references: [id], onDelete: Restrict)
  user                         User?         @relation(fields: [userId], references: [id], onDelete: SetNull)

  // Multi-Tenant Composite Constraints & Indexes
  @@unique([organizationId, memberNumber], name: "unique_org_member_number")
  @@index([organizationId], map: "idx_members_org_id")
  @@index([branchId], map: "idx_members_branch_id")
  @@index([organizationId, branchId], map: "idx_members_org_branch")
  @@index([status], map: "idx_members_status")
  @@index([phone], map: "idx_members_phone")
  @@index([email], map: "idx_members_email")
  @@index([organizationId, id], map: "idx_members_org_composite")
  @@map("members")
}
```

---

## 3. Supporting Table: `member_transfers` (Branch Transfer History)

To maintain an immutable, audit-compliant record of branch transfers:

```prisma
model MemberTransfer {
  id             String    @id @default(uuid()) @map("id") @db.Uuid
  organizationId String    @map("organization_id") @db.Uuid
  memberId       String    @map("member_id") @db.Uuid
  fromBranchId   String    @map("from_branch_id") @db.Uuid
  toBranchId     String    @map("to_branch_id") @db.Uuid
  reason         String?   @map("reason") @db.VarChar(255)
  transferredBy  String    @map("transferred_by") @db.Uuid
  transferredAt  DateTime  @default(now()) @map("transferred_at") @db.Timestamptz

  // Foreign keys with composite tenant integrity
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  member         Member       @relation(fields: [memberId], references: [id], onDelete: Cascade)
  fromBranch     Branch       @relation("TransferFromBranch", fields: [fromBranchId], references: [id], onDelete: Restrict)
  toBranch       Branch       @relation("TransferToBranch", fields: [toBranchId], references: [id], onDelete: Restrict)

  @@index([organizationId], map: "idx_member_transfers_org_id")
  @@index([memberId], map: "idx_member_transfers_member_id")
  @@index([organizationId, id], map: "idx_member_transfers_org_composite")
  @@map("member_transfers")
}
```

---

## 4. Multi-Tenant Database Constraints & Composite Foreign Keys

To prevent cross-tenant corruption at the PostgreSQL engine level, the following constraints are defined:

1. **Composite Foreign Key: Member Branch Integrity**
   ```sql
   ALTER TABLE "members" ADD CONSTRAINT "fk_members_branch_org"
     FOREIGN KEY ("organization_id", "branch_id")
     REFERENCES "branches"("organization_id", "id")
     ON DELETE RESTRICT;
   ```
   *Guarantees: A member in Organization A can NEVER be assigned to a branch in Organization B.*

2. **Composite Foreign Key: Member Transfer Branch Integrity**
   ```sql
   ALTER TABLE "member_transfers" ADD CONSTRAINT "fk_transfers_from_branch_org"
     FOREIGN KEY ("organization_id", "from_branch_id")
     REFERENCES "branches"("organization_id", "id")
     ON DELETE RESTRICT;

   ALTER TABLE "member_transfers" ADD CONSTRAINT "fk_transfers_to_branch_org"
     FOREIGN KEY ("organization_id", "to_branch_id")
     REFERENCES "branches"("organization_id", "id")
     ON DELETE RESTRICT;
   ```

3. **Composite Unique Constraint: Organization Member Number**
   ```sql
   ALTER TABLE "members" ADD CONSTRAINT "unique_org_member_number"
     UNIQUE ("organization_id", "member_number");
   ```
   *Guarantees: Member numbers are unique within each gym enterprise. Different gyms can safely have member `MEM-0001` without conflict.*

---

## 5. Sequence-Backed Concurrency-Safe Member Number Generation

### The Concurrency Problem
Using simple `SELECT COUNT(*) + 1` or `MAX(member_number) + 1` causes race conditions under concurrent member registrations, leading to duplicate key violations or lost sequence numbers.

### Solution: Dedicated PostgreSQL Sequence Per Organization Table
We introduce a dedicated sequence tracking table:

```prisma
model OrganizationMemberSequence {
  organizationId String   @id @map("organization_id") @db.Uuid
  currentValue   Int      @default(0) @map("current_value")
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@map("organization_member_sequences")
}
```

### Atomic Sequence Increment Pattern
```sql
INSERT INTO organization_member_sequences (organization_id, current_value, updated_at)
VALUES ($1, 1, NOW())
ON CONFLICT (organization_id)
DO UPDATE SET current_value = organization_member_sequences.current_value + 1, updated_at = NOW()
RETURNING current_value;
```
- **Atomicity**: Handled inside the database row lock on `organization_member_sequences`.
- **Zero Gaps/Collisions**: Parallel requests are serialized atomically per organization.
- **Format**: `MEM-${String(seq).padStart(5, '0')}` (e.g. `MEM-00001`, `MEM-00002`).
- **Custom Prefix Support**: Tenants can optionally customize the prefix (e.g. `APX-00001`) in future settings.

---

## 6. Duplicate Contact Data Rules

| Field | Uniqueness Policy | Rationale |
|---|---|---|
| `member_number` | **Strictly Unique per Organization** | Primary human/barcode identifier. |
| `phone` | **Non-Unique** (Indexed) | Multiple family members (parent, spouse, child) frequently share a primary contact number. Duplicate phone is permitted, with a warning prompt in the UI. |
| `email` | **Non-Unique** (Indexed, Nullable) | Minors or family members often share an email address; email is also optional for gym members who only provide phone. |
| `user_id` | **Unique per Organization when not null** | One global user can link to at most one member record within a single gym organization. |

---

## 7. Migration Execution Plan (Pending User Approval)
- Single migration: `20261120000000_member_management_foundation`
- Includes table creation, enums, indexes, composite foreign keys, RLS enablement, and RLS policies.
