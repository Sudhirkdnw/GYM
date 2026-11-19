# GymOS API Reference — Member Management (Stage 2.4)

## Overview
The Member Management module handles gym customer records within a multi-tenant, multi-branch architecture. Members are distinct from staff/users (`organization_users`) and represent paying or prospect customers.

All member endpoints require an active JWT session (`JwtAuthGuard`) and tenant context (`PermissionsGuard`).

---

## Endpoints

### 1. Register Member
`POST /api/v1/members`

Registers a new member with an automatically generated, concurrency-safe member number (`MEM-XXXXX`).

- **Permissions Required:** `MEMBER_CREATE`
- **Branch Context:** Validated via `BranchContextGuard`. Requires `branchId` in body or `x-branch-id` header.
- **Request Body:**
```json
{
  "branchId": "uuid",
  "firstName": "Ramesh",
  "lastName": "Kumar",
  "preferredName": "Ram",
  "gender": "MALE",
  "dateOfBirth": "1990-05-15",
  "phone": "+919876543210",
  "email": "ramesh.kumar@example.com",
  "addressLine1": "123 Gym Street",
  "city": "Mumbai",
  "state": "Maharashtra",
  "country": "India",
  "postalCode": "400001",
  "emergencyContactName": "Anita Kumar",
  "emergencyContactPhone": "+919876543211",
  "emergencyContactRelationship": "Spouse",
  "notes": "Prefers morning workout sessions",
  "joinedAt": "2026-11-20"
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": "uuid",
    "organizationId": "uuid",
    "branchId": "uuid",
    "branchName": "Downtown Branch",
    "memberNumber": "MEM-00001",
    "firstName": "Ramesh",
    "lastName": "Kumar",
    "status": "ACTIVE",
    "phone": "+919876543210",
    "email": "ramesh.kumar@example.com",
    "joinedAt": "2026-11-20T00:00:00.000Z",
    "createdAt": "2026-11-20T00:00:00.000Z",
    "updatedAt": "2026-11-20T00:00:00.000Z"
  }
}
```

---

### 2. List Members
`GET /api/v1/members`

Retrieves a paginated list of members for the current tenant.

- **Permissions Required:** `MEMBER_READ`
- **Query Parameters:**
  - `page`: number (default: 1)
  - `limit`: number (default: 20, max: 100)
  - `search`: string (case-insensitive substring match on name, phone, email, memberNumber)
  - `status`: `ACTIVE` | `INACTIVE` | `SUSPENDED` | `ARCHIVED`
  - `branchId`: UUID (filter by specific branch)
  - `sortBy`: `createdAt` | `firstName` | `lastName` | `memberNumber` | `joinedAt` (default: `createdAt`)
  - `sortOrder`: `asc` | `desc` (default: `desc`)
- **Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "id": "uuid",
        "memberNumber": "MEM-00001",
        "firstName": "Ramesh",
        "lastName": "Kumar",
        "status": "ACTIVE",
        "phone": "+919876543210",
        "branchId": "uuid",
        "branchName": "Downtown Branch",
        "joinedAt": "2026-11-20T00:00:00.000Z"
      }
    ],
    "meta": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
}
```

---

### 3. Get Member Profile
`GET /api/v1/members/:id`

Retrieves full member profile including contact details and branch transfer history.

- **Permissions Required:** `MEMBER_READ`
- **Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "uuid",
    "memberNumber": "MEM-00001",
    "firstName": "Ramesh",
    "lastName": "Kumar",
    "phone": "+919876543210",
    "status": "ACTIVE",
    "transfers": [
      {
        "id": "uuid",
        "fromBranchId": "uuid",
        "fromBranchName": "Downtown Branch",
        "toBranchId": "uuid",
        "toBranchName": "Uptown Branch",
        "reason": "Relocated",
        "transferredAt": "2026-11-20T00:00:00.000Z"
      }
    ]
  }
}
```

---

### 4. Update Member Details
`PATCH /api/v1/members/:id`

Updates personal and contact details. Archived members cannot be updated.

- **Permissions Required:** `MEMBER_UPDATE`
- **Request Body:** Partial update fields matching `updateMemberSchema`.

---

### 5. Update Member Status
`PATCH /api/v1/members/:id/status`

Transitions member lifecycle status (`ACTIVE`, `INACTIVE`, `SUSPENDED`).

- **Permissions Required:** `MEMBER_STATUS_MANAGE`
- **Request Body:**
```json
{
  "status": "SUSPENDED",
  "reason": "Temporary medical freeze"
}
```
- **Rules:** Status transitions from `ARCHIVED` are rejected as terminal.

---

### 6. Transfer Member to Branch
`POST /api/v1/members/:id/transfer`

Transfers a member from their current branch to a target branch within the same organization.

- **Permissions Required:** `MEMBER_TRANSFER`
- **Request Body:**
```json
{
  "targetBranchId": "uuid",
  "reason": "Moved to neighborhood branch"
}
```
- **Rules:** Rejects cross-tenant transfer, transfer to current branch, transfer to inactive branch, or transfer of archived members.

---

### 7. Archive Member
`POST /api/v1/members/:id/archive`

Permanently marks a member as archived.

- **Permissions Required:** `MEMBER_ARCHIVE`
- **Request Body:**
```json
{
  "reason": "Customer relocated abroad"
}
```
- **Rules:** Sets `status = 'ARCHIVED'` and `archivedAt = NOW()`.
