# GymOS Authentication Security Specification

## 1. Cryptographic Standards

### 1.1 Password Hashing (Argon2id)
GymOS enforces native `Argon2id` hashing for all user passwords. Argon2id is the primary password hashing recommendation of OWASP and the winner of the Password Hashing Competition (PHC).

Configuration parameters:
- **Type**: `argon2id` (hybrid of Argon2d and Argon2i, providing side-channel and GPU/ASIC resistance)
- **Memory Cost (`m`)**: 65,536 KiB (64 MiB)
- **Time Cost (`t`)**: 3 iterations
- **Parallelism (`p`)**: 4 threads
- **Salt**: 16 cryptographically random bytes generated automatically by Argon2 per hash

Plaintext passwords are never logged, never cached in memory, and never returned in API payloads.

---

## 2. Anti-Enumeration & Timing Attack Mitigations

1. **Generic Login Errors**: When authentication fails, the system returns `HTTP 401 Unauthorized` with the generic message `"Invalid email or password"`. No distinct responses are given for non-existent users versus incorrect passwords.
2. **Constant-Time Verification**: When an email is submitted that does not match any existing record in PostgreSQL, `AuthService` executes a dummy Argon2id verification against a static benchmark hash to prevent attackers from determining account presence via response latency analysis.
3. **Password Reset Enumeration Defense**: `POST /api/v1/auth/forgot-password` returns an identical success acknowledgment whether or not an account exists for the specified email:
   ```json
   {
     "message": "If an active account exists for this email, password reset instructions have been dispatched."
   }
   ```

---

## 3. Account Lifecycle & Status Enforcement

The `UserStatus` enum controls global authorization:
- `ACTIVE`: Fully authenticated, access permitted.
- `PENDING_VERIFICATION`: Account created, email verification token pending.
- `INACTIVE`: Account disabled by user or administrator; rejected with HTTP 401.
- `SUSPENDED`: Account suspended by platform administration; rejected with HTTP 401 (`"Account is suspended. Please contact support."`).

Account status is verified on both primary login and during refresh token rotation.

---

## 4. Single-Use Hashed Tokens

Both password reset tokens and email verification tokens follow zero-trust persistence:
1. The plaintext token is generated via `crypto.randomBytes(32).toString('hex')`.
2. The raw token is **never stored** in the database. Only its `SHA-256` hash is persisted.
3. Validation requires hashing the submitted client token and querying for an exact match.
4. Expiry rules are strictly enforced:
   - Password reset: 1 hour (`AUTH_CONFIG.PASSWORD_RESET_EXPIRY_HOURS`).
   - Email verification: 24 hours (`AUTH_CONFIG.EMAIL_VERIFICATION_EXPIRY_HOURS`).
5. Single-use enforcement: Once consumed, `usedAt` is timestamped in the same database transaction. Any subsequent attempt to reuse the token results in an immediate `HTTP 400 Bad Request`.
6. Immediate Session Revocation: On successful password reset, all active refresh tokens and sessions for that user across all devices are immediately revoked (`isRevoked: true`).

---

## 5. Refresh Token Security & Reuse Detection

Session refresh tokens implement strict **Token Family Rotation**:
- Each token issuance tree is assigned a unique `family` UUID.
- When token rotation occurs, the old token is marked `isRevoked: true` and replaced by a new token in the same family.
- **Reuse Detection**: If an attacker intercepts a previously consumed token and attempts to refresh with it, the backend identifies that `isRevoked: true`. The backend immediately triggers a high-severity security alert and invalidates **ALL** tokens sharing that `family` UUID:
  ```typescript
  await tx.refreshToken.updateMany({
    where: { family: existingToken.family },
    data: { isRevoked: true },
  });
  ```
- This immediately kicks out both the legitimate user and the attacker, forcing full credential re-authentication.

---

## 6. Tenant Context Verification

Client-supplied `organizationId` is never trusted. All tenant resolution operates through:
1. `TenantContextService.resolveMembership(userId, requestedOrgId)`:
   - Queries `organization_users` for the user's explicit relation.
   - Verifies the organization `status == ACTIVE`.
2. PostgreSQL Row-Level Security:
   - Queries within tenant context execute inside `withTenantContext()` setting `SET LOCAL app.current_tenant_id`.
   - Prevents SQL or API parameter manipulation from breaching tenant boundaries.
