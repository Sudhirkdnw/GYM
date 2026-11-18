# GymOS Role-Based Access Control (RBAC) & Permissions

## 1. Architectural Principles

GymOS implements a centralized, declarative, deny-by-default authorization architecture. Rather than scattering arbitrary role-string comparisons across controller endpoints, controllers declare required **permissions** via `@RequirePermissions(...)`.

Key rules:
1. **Separation of Global & Tenant Scopes**: Global platform administrative rights (`SUPER_ADMIN`) are isolated from tenant-level operational roles (`GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST`, `TRAINER`, `MEMBER`).
2. **Deny-by-Default**: If a protected endpoint declares required permissions, access is denied unless the user's active context explicitly contains all required permissions.
3. **Decoupled Memberships**: A single user may be a `GYM_OWNER` in Gym A and a `MEMBER` in Gym B. Permissions are evaluated against the user's active organization context.

---

## 2. Role Taxonomy

### 2.1 Organization Roles
1. **`GYM_OWNER`**: Primary tenant authority. Holds full management permissions over gym settings, staff, finances, plans, members, and attendance.
2. **`GYM_ADMIN`**: Operational manager. Manages staff, members, attendance, plans, and memberships. Cannot modify organization-level master configurations or ownership.
3. **`RECEPTIONIST`**: Front-desk operations. Manages member check-ins, attendance logs, member profiles, and point-of-sale payments. Cannot manage gym settings or staff roster.
4. **`TRAINER`**: Fitness trainer. Accesses member profiles and manages attendance for assigned sessions. Cannot view or process financial transactions or billing.
5. **`MEMBER`**: Gym client / customer. Read-only access to their own member profile and personal attendance logs.

### 2.2 Global Platform Role
1. **`SUPER_ADMIN`**: SaaS platform operator. Global privileges across tenant provisioning, audit logs, and system health. Does not automatically receive unrestricted tenant database access without an authorized session.

---

## 3. RBAC Permissions Matrix

| Permission String | Description | `OWNER` | `ADMIN` | `RECEPTIONIST` | `TRAINER` | `MEMBER` | `SUPER_ADMIN` |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `platform.access` | Access platform operations | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `platform.organizations.read` | View all platform tenants | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `platform.organizations.manage` | Create, suspend, or configure tenants | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `platform.audit.read` | View global audit events | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `organization.dashboard.read` | View operational dashboard metrics | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `organization.settings.read` | View organization settings | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `organization.settings.manage` | Modify organization configuration | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `organization.members.read` | List and inspect gym members | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `organization.members.manage` | Add, update, or deactivate members | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `organization.memberships.read` | View membership plans and contracts | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `organization.memberships.manage` | Create or update membership tiers | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `organization.attendance.read` | View member attendance logs | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `organization.attendance.manage` | Check in members and log attendance | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `organization.payments.read` | View invoices, orders, and balances | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `organization.payments.manage` | Record payments and process refunds | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `organization.staff.read` | View staff members and assignments | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `organization.staff.manage` | Hire, assign, or remove staff roles | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `member.profile.read` | Read individual member details | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `member.profile.update` | Update individual member profile | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## 4. NestJS Implementation

### 4.1 Decorator Usage
Developers protect endpoints using `@RequirePermissions(...)`:

```typescript
@Get('settings')
@RequirePermissions(Permission.ORGANIZATION_SETTINGS_MANAGE)
async updateSettings(@CurrentUser() user: AuthenticatedUserContext) {
  // Only GYM_OWNER possesses ORGANIZATION_SETTINGS_MANAGE
}
```

### 4.2 Guard Evaluation Flow
`PermissionsGuard` executes after `JwtAuthGuard`:
1. Extracts required permissions from metadata.
2. If none required, request proceeds.
3. If user context is missing, throws `401 Unauthorized`.
4. Checks if all required permissions exist in `req.user.permissions`.
5. If any permission is missing, throws `403 Forbidden`:
   ```json
   {
     "success": false,
     "statusCode": 403,
     "error": "Forbidden",
     "message": "Forbidden: Insufficient permissions for this action (required: organization.settings.manage)",
     "correlationId": "api-1794980301186"
   }
   ```
