# Multi-Branch Management API Reference

Base URI: `/api/v1`

---

## 1. Create Branch

- **Method**: `POST /api/v1/branches`
- **Permissions**: `organization.branches.create`
- **Request Body**:
```json
{
  "name": "Alpha Sector 18",
  "branchCode": "ALPHA-SEC18",
  "email": "sector18@alphafitness.com",
  "phone": "+91 9999900001",
  "website": "https://alphafitness.com/sec18",
  "addressLine1": "Plot 12, Sector 18",
  "city": "Noida",
  "state": "Uttar Pradesh",
  "country": "India",
  "postalCode": "201301",
  "timezone": "Asia/Kolkata"
}
```

### Response (201 Created)
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": "9371e4b1-cadd-4d86-8c1d-026c31bcea2c",
    "organizationId": "2bb4791e-7875-4f87-bb18-8eaad8d783f4",
    "name": "Alpha Sector 18",
    "slug": "alpha-sector-18",
    "branchCode": "ALPHA-SEC18",
    "status": "ACTIVE",
    "timezone": "Asia/Kolkata",
    "createdAt": "2026-11-18T10:00:00.000Z",
    "staffCount": 0
  }
}
```

### Errors
- `409 Conflict`: Branch code or slug already exists in this organization.

---

## 2. List Branches

- **Method**: `GET /api/v1/branches`
- **Permissions**: `organization.branches.read`
- **Query Parameters**:
  - `page`: Integer (default `1`)
  - `limit`: Integer (default `20`, max `100`)
  - `search`: String (searches name, code, city, state)
  - `status`: String (`ACTIVE`, `INACTIVE`, `CLOSED`)
  - `city`: String
  - `state`: String
  - `sortBy`: String (default `createdAt`)
  - `sortOrder`: String (`asc` or `desc`)

### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "id": "9371e4b1-cadd-4d86-8c1d-026c31bcea2c",
        "name": "Alpha Sector 18",
        "branchCode": "ALPHA-SEC18",
        "city": "Noida",
        "status": "ACTIVE",
        "staffCount": 4
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

## 3. Get Branch by ID

- **Method**: `GET /api/v1/branches/:branchId`
- **Permissions**: `organization.branches.read`

### Response (200 OK)
Returns complete `BranchData` object.

### Errors
- `404 Not Found`: Branch does not exist or belongs to another tenant.
- `403 Forbidden`: Non-owner staff member not assigned to this branch.

---

## 4. Update Branch

- **Method**: `PATCH /api/v1/branches/:branchId`
- **Permissions**: `organization.branches.update`

### Request Body
Accepts partial fields: `name`, `slug`, `branchCode`, `email`, `phone`, `website`, `addressLine1`, `addressLine2`, `city`, `state`, `country`, `postalCode`, `timezone`, `description`.

### Errors
- `400 Bad Request`: Cannot modify a `CLOSED` branch.
- `404 Not Found`: Branch not found.
- `409 Conflict`: New slug or branchCode conflicts with existing record in organization.

---

## 5. Update Branch Status

- **Method**: `PATCH /api/v1/branches/:branchId/status`
- **Permissions**: `organization.branches.status.manage`

### Request Body
```json
{
  "status": "INACTIVE"
}
```

Allowed transitions:
- `ACTIVE` -> `INACTIVE`
- `INACTIVE` -> `ACTIVE`
- `ACTIVE` or `INACTIVE` -> `CLOSED`
- `CLOSED` -> Any: **REJECTED (400 Bad Request)**

---

## 6. Assign Staff to Branch

- **Method**: `POST /api/v1/branches/:branchId/staff`
- **Permissions**: `organization.branch_staff.manage`

### Request Body
```json
{
  "organizationUserId": "ou-uuid-1"
}
```

### Errors
- `400 Bad Request`: Cannot assign staff to inactive or closed branch; or user belongs to different organization.
- `409 Conflict`: User is already actively assigned to this branch.

---

## 7. List Branch Staff

- **Method**: `GET /api/v1/branches/:branchId/staff`
- **Permissions**: `organization.branch_staff.read`

### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": "assignment-uuid-1",
      "branchId": "branch-uuid-1",
      "organizationUserId": "ou-uuid-1",
      "status": "ACTIVE",
      "assignedAt": "2026-11-18T10:15:00.000Z",
      "user": {
        "id": "u-uuid-1",
        "email": "trainer@gym.test",
        "firstName": "John",
        "lastName": "Doe",
        "role": "TRAINER"
      }
    }
  ]
}
```

---

## 8. Remove Branch Staff

- **Method**: `DELETE /api/v1/branches/:branchId/staff/:organizationUserId`
- **Permissions**: `organization.branch_staff.manage`

### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "success": true,
    "message": "Staff member removed from branch successfully"
  }
}
```

---

## 9. User Accessible Branches

- **Method**: `GET /api/v1/auth/organizations/current/branches`
- Returns all branches the user is authorized to access (all for owners/admins, assigned active branches for trainers/receptionists).

---

## 10. Select Branch Context

- **Method**: `POST /api/v1/auth/organizations/current/branches/select`
- **Request Body**:
```json
{
  "branchId": "branch-uuid-1"
}
```
- Validates membership and active status. Returns `{ selectedBranch: BranchData }`.

---

## 11. Current Selected Branch

- **Method**: `GET /api/v1/auth/organizations/current/branches/selected`
- Reads selection from `x-branch-id` header or returns primary active branch.
