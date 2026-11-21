# GymOS Platform Settings Center — API Reference

All protected endpoints require a valid Bearer JWT from an authenticated user whose `isSuperAdmin === true`. Unauthorized calls are rejected with `401 Unauthorized` or `403 Forbidden` (`SUPER_ADMIN_REQUIRED`).

---

## 1. Overview & Health

### `GET /api/v1/platform/settings/overview`
Returns health, configuration, and verification status across all platform services.

**Response (200 OK):**
```json
{
  "website": {
    "isConfigured": true,
    "updatedAt": "2026-11-21T09:30:00.000Z"
  },
  "smtp": {
    "isConfigured": true,
    "status": "SUCCESS",
    "lastTestedAt": "2026-11-21T09:35:00.000Z",
    "testMessage": "Successfully connected to SMTP server at smtp.gmail.com:587",
    "fromEmail": "noreply@gymos.com",
    "host": "smtp.gmail.com"
  },
  "whatsapp": {
    "isConfigured": true,
    "status": "SUCCESS",
    "lastTestedAt": "2026-11-21T09:36:00.000Z",
    "testMessage": "Meta Graph API Verified! Connected Phone Number ID: 10928374",
    "phoneNumberId": "10928374"
  },
  "templates": {
    "totalCount": 10
  }
}
```

---

## 2. Website Branding

### `GET /api/v1/platform/public/branding` *(Public, Unauthenticated)*
Returns safe public branding information for client landing pages.

### `GET /api/v1/platform/settings/website` *(Super Admin)*
Returns complete platform branding configuration including corporate metadata.

### `PUT /api/v1/platform/settings/website` *(Super Admin)*
Updates branding configuration and updates audit trail.

**Request Body:**
```json
{
  "platformName": "GymOS Platform",
  "websiteName": "GymOS — The Operating System for Modern Gyms",
  "tagline": "Multi-branch operations, automated billing, and smart attendance.",
  "companyLegalName": "GymOS Technologies Inc.",
  "websiteUrl": "https://gymos.com",
  "companyAddress": "Bengaluru, Karnataka, India",
  "contactEmail": "contact@gymos.com",
  "contactPhone": "+91 98765 43210",
  "lightLogoUrl": "https://gymos.com/assets/logo-light.svg",
  "darkLogoUrl": "https://gymos.com/assets/logo-dark.svg",
  "faviconUrl": "https://gymos.com/favicon.ico",
  "primaryColor": "#7c3aed",
  "secondaryColor": "#4f46e5",
  "accentColor": "#10b981",
  "socialLinks": {
    "facebook": "https://facebook.com/gymos",
    "twitter": "https://twitter.com/gymos",
    "instagram": "https://instagram.com/gymos"
  },
  "footerCopyrightText": "© 2026 GymOS Platform Inc. All rights reserved."
}
```

---

## 3. Email & SMTP Configuration

### `GET /api/v1/platform/settings/email` *(Super Admin)*
Returns SMTP settings. The password is masked as `••••••••`.

### `PUT /api/v1/platform/settings/email` *(Super Admin)*
Updates SMTP settings. If `password` is omitted or left as `••••••••`, the existing encrypted password is preserved.

### `POST /api/v1/platform/settings/email/test-connection` *(Super Admin)*
Executes live TCP socket or TLS handshake verification to host:port.

### `POST /api/v1/platform/settings/email/test-send` *(Super Admin)*
**Request Body:**
```json
{
  "targetEmail": "admin@gymos.com"
}
```

---

## 4. Meta WhatsApp Cloud API

### `GET /api/v1/platform/settings/whatsapp` *(Super Admin)*
Returns WhatsApp settings. Access token is masked as `••••••••`.

### `PUT /api/v1/platform/settings/whatsapp` *(Super Admin)*
Encrypts and stores WhatsApp Cloud API credentials.

### `POST /api/v1/platform/settings/whatsapp/test-connection` *(Super Admin)*
Queries Meta Graph API to verify Phone Number ID and token authorization.

### `POST /api/v1/platform/settings/whatsapp/test-send` *(Super Admin)*
**Request Body:**
```json
{
  "testPhoneNumber": "+919876543210",
  "message": "Test verification from GymOS"
}
```

### `GET /api/v1/platform/settings/whatsapp/webhook` *(Public)*
Handles Meta Webhook validation (`hub.mode`, `hub.verify_token`, `hub.challenge`).

### `POST /api/v1/platform/settings/whatsapp/webhook` *(Public)*
Handles incoming Meta WhatsApp Cloud API event delivery.

---

## 5. Email Templates

### `GET /api/v1/platform/settings/email-templates?category=BILLING&search=invoice`
List email templates with optional filters.

### `GET /api/v1/platform/settings/email-templates/:code`
Get detailed template content, version, and history.

### `PUT /api/v1/platform/settings/email-templates/:code`
Updates subject, HTML body, plain text fallback, and active status. Automatically increments version and creates a history checkpoint.

### `POST /api/v1/platform/settings/email-templates/:code/preview`
Renders template HTML and subject using provided or sample variables.

### `POST /api/v1/platform/settings/email-templates/:code/test-send`
**Request Body:**
```json
{
  "targetEmail": "test@gymos.com",
  "sampleVariables": {
    "recipient_name": "Test User"
  }
}
```

---

## 6. Platform Audit Logs

### `GET /api/v1/platform/settings/audit-logs`
Query platform-scoped audit logs with pagination, search, action filter, and date ranges.

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `search` (string)
- `action` (string)
- `startDate` (ISO string)
- `endDate` (ISO string)
