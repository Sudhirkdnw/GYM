# GymOS — Member API Contract Specification (Stage 2.4 Planning)

## 1. Overview & Protocol Standards

- **Base URL**: `/api/v1/members`
- **Authentication**: `Authorization: Bearer <jwt>` or HTTP-Only cookie `gymos_access_token`
- **Tenant Context**: Inferred from verified JWT session / optional `x-organization-id` header
- **Branch Scope**: Optional / Enforced `x-branch-id` header or body `branchId`
- **Response Format**: Standard `{ success: true, data: ..., meta?: ... }`

---

## 2. API Endpoints Summary

| Method | Path | Required Permission | Description |
|---|---|---|---|
| `POST` | `/api/v1/members` | `member.create` | Register new member at a branch |
| `GET` | `/api/v1/members` | `member.read` | List members with pagination, search & filters |
| `GET` | `/api/v1/members/:id` | `member.read` | Retrieve detailed member profile |
| `PATCH` | `/api/v1/members/:id` | `member.update` | Update member personal/contact details |
| `PATCH` | `/api/v1/members/:id/status` | `member.status.manage` | Update member status (Active, Inactive, Suspended) |
| `POST` | `/api/v1/members/:id/transfer` | `member.transfer` | Transfer member to a different branch |
| `POST` | `/api/v1/members/:id/archive` | `member.archive` | Soft-archive member record |

---

## 3. Endpoint Specifications

### 3.1 `POST /api/v1/members` (Register Member)

#### Request Headers:
`x-branch-id: <uuid>` (Optional if `branchId` is passed in body)

#### Request Body (`createMemberSchema`):
```json
{
  "branchId": "02124db8-e219-4dca-9e05-c4cca129276c",
  "firstName": "Aarav",
  "lastName": "Kapoor",
  "preferredName": "Aari",
  "gender": "MALE",
  "dateOfBirth": "1995-08-15",
  "phone": "+919876543210",
  "email": "aarav.kapoor@example.com",
  "addressLine1": "Flat 402, Lotus Towers",
  "city": "Noida",
  "state": "Uttar Pradesh",
  "country": "India",
  "postalCode": "201301",
  "emergencyContactName": "Pooja Kapoor",
  "emergencyContactPhone": "+919876543219",
  "emergencyContactRelationship": "Spouse",
  "notes": "Prefers morning workout sessions."
}
```

#### Response (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "e4a7b1c2-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
    "organizationId": "2e5f7748-e96c-4c1b-8b9e-96780bdaea22",
    "branchId": "02124db8-e219-4dca-9e05-c4cca129276c",
    "branchName": "Apex Sector 18 (HQ)",
    "memberNumber": "MEM-00001",
    "firstName": "Aarav",
    "lastName": "Kapoor",
    "preferredName": "Aari",
    "gender": "MALE",
    "dateOfBirth": "1995-08-15",
    "phone": "+919876543210",
    "email": "aarav.kapoor@example.com",
    "status": "ACTIVE",
    "emergencyContactName": "Pooja Kapoor",
    "emergencyContactPhone": "+919876543219",
    "emergencyContactRelationship": "Spouse",
    "joinedAt": "2026-11-20T00:00:00.000Z",
    "createdAt": "2026-11-20T00:00:00.000Z",
    "updatedAt": "2026-11-20T00:00:00.000Z"
  }
}
```

---

### 3.2 `GET /api/v1/members` (Directory Search & Listing)

#### Query Parameters (`memberQuerySchema`):
- `page`: number (default: 1)
- `limit`: number (default: 20, max: 100)
- `search`: string (matches name, phone, email, or memberNumber)
- `branchId`: UUID (optional filter by branch)
- `status`: `ACTIVE` | `INACTIVE` | `SUSPENDED` | `ARCHIVED`
- `sortBy`: `createdAt` | `firstName` | `lastName` | `memberNumber` | `joinedAt` (default: `createdAt`)
- `sortOrder`: `asc` | `desc` (default: `desc`)

#### Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "e4a7b1c2-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
      "memberNumber": "MEM-00001",
      "firstName": "Aarav",
      "lastName": "Kapoor",
      "phone": "+919876543210",
      "email": "aarav.kapoor@example.com",
      "branchId": "02124db8-e219-4dca-9e05-c4cca129276c",
      "branchName": "Apex Sector 18 (HQ)",
      "status": "ACTIVE",
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
```

---

### 3.3 `POST /api/v1/members/:id/transfer` (Branch Transfer)

#### Request Body (`transferMemberSchema`):
```json
{
  "targetBranchId": "430adc9e-b203-40aa-85d2-1338b701c2f5",
  "reason": "Relocated closer to Greater Noida facility"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "memberId": "e4a7b1c2-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
    "previousBranchId": "02124db8-e219-4dca-9e05-c4cca129276c",
    "newBranchId": "430adc9e-b203-40aa-85d2-1338b701c2f5",
    "newBranchName": "Apex Greater Noida",
    "transferredAt": "2026-11-20T02:30:00.000Z"
  }
}
```

---

### 3.4 `POST /api/v1/members/:id/archive` (Soft Archive)

#### Request Body (`archiveMemberSchema`):
```json
{
  "reason": "Member moved permanently to another state"
}
```

#### Response (200 OK):
```json
{
  "success": true,
  "data": {
    "memberId": "e4a7b1c2-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
    "status": "ARCHIVED",
    "archivedAt": "2026-11-20T03:00:00.000Z"
  }
}
```
