# Organization Management API Reference

Base URI: `/api/v1/organizations`

All endpoints require a valid JWT Access Token carrying an authenticated `organizationId`.

---

## 1. Get Current Organization Profile

- **Method**: `GET /api/v1/organizations/current`
- **Permissions**: `organization.profile.read` (or `organization.dashboard.read`)
- **Headers**:
  - `Authorization: Bearer <jwt_access_token>`

### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "2bb4791e-7875-4f87-bb18-8eaad8d783f4",
    "name": "Alpha Fitness Flagship",
    "slug": "alpha-fitness-1234",
    "legalName": "Alpha Fitness Pvt. Ltd.",
    "businessEmail": "contact@alphafitness.com",
    "businessPhone": "+91 9876543210",
    "website": "https://alphafitness.com",
    "logoUrl": null,
    "description": "Premier fitness club network in North India.",
    "addressLine1": "Plot 12, Sector 18",
    "addressLine2": "Metro Station Road",
    "city": "Noida",
    "state": "Uttar Pradesh",
    "country": "India",
    "postalCode": "201301",
    "timezone": "Asia/Kolkata",
    "currency": "INR",
    "status": "ACTIVE",
    "createdAt": "2026-11-18T10:00:00.000Z",
    "updatedAt": "2026-11-18T10:05:00.000Z",
    "stats": {
      "totalBranches": 3,
      "activeBranches": 2,
      "inactiveBranches": 1,
      "totalStaff": 12
    }
  },
  "timestamp": "2026-11-18T10:05:01.000Z",
  "correlationId": "corr-uuid"
}
```

---

## 2. Update Current Organization Profile

- **Method**: `PATCH /api/v1/organizations/current`
- **Permissions**: `organization.profile.update`
- **Request Body**:
```json
{
  "name": "Alpha Fitness Enterprise",
  "legalName": "Alpha Fitness Holdings Pvt. Ltd.",
  "businessEmail": "info@alphafitness.com",
  "businessPhone": "+91 9999900000",
  "website": "https://alphafitness.com",
  "description": "Updated enterprise description",
  "city": "Noida",
  "state": "Uttar Pradesh",
  "timezone": "Asia/Kolkata",
  "currency": "INR"
}
```

### Response (200 OK)
Returns the updated `OrganizationProfile` object.

### Error Responses
- `400 Bad Request`: Validation failure or reserved slug attempted.
- `403 Forbidden`: User lacks `organization.profile.update` permission.
- `409 Conflict`: Organization slug is already in use by another tenant.

---

## 3. Get Organization Settings

- **Method**: `GET /api/v1/organizations/current/settings`
- **Permissions**: `organization.settings.read`

### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "timezone": "Asia/Kolkata",
    "currency": "INR"
  }
}
```

---

## 4. Update Organization Settings

- **Method**: `PATCH /api/v1/organizations/current/settings`
- **Permissions**: `organization.settings.update`

### Request Body
```json
{
  "timezone": "UTC",
  "currency": "USD"
}
```

### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "timezone": "UTC",
    "currency": "USD"
  }
}
```

---

## 5. List Organization Members (Staff)

- **Method**: `GET /api/v1/organizations/current/members`
- **Permissions**: `organization.branch_staff.read`

### Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": "ou-uuid-1",
      "userId": "u-uuid-1",
      "role": "TRAINER",
      "email": "trainer@alphafitness.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  ]
}
```
