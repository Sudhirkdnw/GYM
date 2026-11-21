# GymOS Platform Settings Center — Security Architecture & Threat Model

## 1. Threat Mitigation & Architectural Principles

### 1.1 Multi-Tenant Isolation & Zero RLS Bypass
- The Platform Settings Center strictly provisions configuration for the **GymOS platform itself**, distinct from tenant databases.
- Database tables `platform_settings` and `platform_email_templates` are governed by:
  ```sql
  ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
  ALTER TABLE platform_settings FORCE ROW LEVEL SECURITY;
  
  CREATE POLICY platform_settings_super_admin_policy ON platform_settings
    FOR ALL
    USING (current_setting('app.is_super_admin', true) = 'true')
    WITH CHECK (current_setting('app.is_super_admin', true) = 'true');
  ```
- Normal gym owners, branch managers, trainers, and gym members executing database queries without `app.is_super_admin = 'true'` receive 0 rows, preventing any cross-tenant data leakage or platform configuration tampering.

### 1.2 Authenticated Envelope Encryption (AES-256-GCM)
- Integration credentials (SMTP passwords, Meta WhatsApp System User Access Tokens) are encrypted at rest using **AES-256-GCM**.
- Envelope format: `enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`.
  - IV: 96-bit cryptographically secure pseudorandom bytes generated per encryption operation.
  - Auth Tag: 128-bit authentication tag ensuring ciphertext integrity and authenticity.
- Encryption keys are derived via SHA-256 from environment variables (`PLATFORM_SECRET_MASTER_KEY`). **The encryption key is never stored in the database.**

### 1.3 Masked Secret Presentation
- `GET` endpoints for SMTP and WhatsApp configurations return masked placeholders (`••••••••`).
- During partial updates (e.g. updating SMTP host without changing the password), omitting or submitting `••••••••` retains the existing encrypted secret without overwriting.

### 1.4 HTML Sanitization & Injection Prevention
- The Email Template Studio performs sanitization on incoming template HTML:
  - Eliminates `<script>` tags and JavaScript execution vectors.
  - Strips inline DOM event listeners (`onload`, `onerror`, `onclick`).
  - Blocks `javascript:` URIs.
- Template variable replacement (`{{variable}}`) employs regex substitution that never evaluates arbitrary JavaScript expressions (no `eval`, `Function`, or unsafe template engines).

### 1.5 Immutable Append-Only Audit Trail
- All Super Admin actions generate append-only audit entries in `audit_logs`.
- Raw passwords, tokens, API secrets, and sensitive customer data are scrubbed before writing to metadata.
- Audit records capture the actor's user ID, IP address, user agent, and timestamp.
