# GymOS — Member Management Test Plan (Stage 2.4 Planning)

## 1. Test Strategy Overview

All Stage 2.4 tests will run as real integration/E2E tests against live PostgreSQL 18 with the non-superuser application role `gymos_user`. Mocked database calls are strictly prohibited for security verification.

---

## 2. Test Suites Matrix

### Suite 1: Member Registration & Concurrency
- `MEM-REG-01`: Valid registration generates continuous unique member numbers (`MEM-00001`, `MEM-00002`).
- `MEM-REG-02`: Concurrent member registrations (10 parallel requests) complete without race conditions or duplicate key violations.
- `MEM-REG-03`: Registration without email succeeds (email is optional for walk-ins).
- `MEM-REG-04`: Duplicate phone number in same organization is permitted (family members).
- `MEM-REG-05`: Registration with invalid branch ID format returns `400 Bad Request`.
- `MEM-REG-06`: Registration at inactive or closed branch returns `400 Bad Request`.
- `MEM-REG-07`: Registration at cross-tenant branch returns `404 Not Found`.

### Suite 2: Directory Search, Filtering & Pagination
- `MEM-DIR-01`: Owner can view all members across all branches.
- `MEM-DIR-02`: Search by member number substring matches correctly.
- `MEM-DIR-03`: Search by phone number substring matches correctly.
- `MEM-DIR-04`: Filter by branchId returns only members of that branch.
- `MEM-DIR-05`: Filter by status (`ACTIVE`, `SUSPENDED`) works accurately.
- `MEM-DIR-06`: Pagination metadata (`total`, `page`, `limit`, `totalPages`) is exact.

### Suite 3: Profile Updates & Status Transitions
- `MEM-UPD-01`: Authorized owner/receptionist can update contact and emergency details.
- `MEM-UPD-02`: Status change from `ACTIVE` to `SUSPENDED` succeeds and is logged in audit trail.
- `MEM-UPD-03`: Status change from `SUSPENDED` back to `ACTIVE` succeeds.
- `MEM-UPD-04`: Status change to `ARCHIVED` marks member archived with timestamp.
- `MEM-UPD-05`: Archived member cannot be transferred or reactivated without special admin authorization.

### Suite 4: Branch Transfer Workflow
- `MEM-TRN-01`: Authorized owner transfers member from Branch A to Branch B within same organization.
- `MEM-TRN-02`: Transfer record is created in `member_transfers` table with valid actor ID.
- `MEM-TRN-03`: Member number is preserved intact after branch transfer.
- `MEM-TRN-04`: Transfer to branch in another organization is rejected with `404 Not Found`.
- `MEM-TRN-05`: Transfer to an inactive or closed branch is rejected with `400 Bad Request`.

### Suite 5: Security, RBAC & RLS Penetration Tests
- `MEM-SEC-01`: Unauthenticated request returns `401 Unauthorized`.
- `MEM-SEC-02`: Trainer attempting to create a member returns `403 Forbidden` (`member.create` required).
- `MEM-SEC-03`: Receptionist assigned to Branch 1 is `403 Forbidden` from viewing/creating members at Branch 2.
- `MEM-SEC-04`: Cross-tenant penetration: User in Org Alpha cannot retrieve Member in Org Beta (`404 Not Found`).
- `MEM-SEC-05`: Database RLS: Direct SQL query by `gymos_user` in Org Alpha context returns 0 rows for Org Beta members.
- `MEM-SEC-06`: Database RLS: Direct SQL insert by `gymos_user` for foreign `organization_id` fails with PostgreSQL RLS violation.
