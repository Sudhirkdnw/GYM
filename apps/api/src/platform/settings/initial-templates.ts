export interface InitialTemplateDefinition {
  code: string;
  name: string;
  category: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  availableVariables: string[];
  sampleVariables: Record<string, string>;
}

export const INITIAL_EMAIL_TEMPLATES: InitialTemplateDefinition[] = [
  {
    code: 'WELCOME_EMAIL',
    name: 'Welcome Email',
    category: 'ONBOARDING',
    subject: 'Welcome to {{platform_name}}!',
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .content { padding: 32px 24px; font-size: 15px; line-height: 1.6; }
    .btn { display: inline-block; background: #7c3aed; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f1f5f9; padding: 16px 24px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>{{platform_name}}</h1>
    </div>
    <div class="content">
      <h2>Welcome, {{recipient_name}}!</h2>
      <p>Thank you for joining {{platform_name}}. Your enterprise gym management platform is ready to help you manage branches, automate memberships, track member attendance, and streamline recurring billing.</p>
      <p><a href="{{login_url}}" class="btn">Launch Dashboard</a></p>
      <p>If you have any questions, our support team is available at <a href="mailto:{{support_email}}">{{support_email}}</a>.</p>
      <p>Best regards,<br>The {{platform_name}} Team</p>
    </div>
    <div class="footer">
      &copy; {{current_year}} {{platform_name}}. All rights reserved.
    </div>
  </div>
</body>
</html>`,
    textBody: `Welcome to {{platform_name}}, {{recipient_name}}!

Thank you for joining us. You can access your operations dashboard here: {{login_url}}

If you have any questions, contact us at {{support_email}}.

Best regards,
The {{platform_name}} Team`,
    availableVariables: ['platform_name', 'recipient_name', 'login_url', 'support_email', 'current_year'],
    sampleVariables: {
      platform_name: 'GymOS Platform',
      recipient_name: 'Rahul Sharma',
      login_url: 'https://gymos.com/login',
      support_email: 'support@gymos.com',
      current_year: '2026',
    },
  },
  {
    code: 'EMAIL_VERIFICATION_OTP',
    name: 'Email Verification OTP',
    category: 'AUTHENTICATION',
    subject: '{{otp_code}} is your verification code for {{platform_name}}',
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0f172a; padding: 28px 24px; text-align: center; color: #ffffff; }
    .content { padding: 32px 24px; font-size: 15px; line-height: 1.6; }
    .otp-box { font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #7c3aed; background: #f3e8ff; padding: 18px; border-radius: 12px; text-align: center; margin: 24px 0; font-family: monospace; }
    .footer { background: #f1f5f9; padding: 16px 24px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0;">{{platform_name}} Security</h2>
    </div>
    <div class="content">
      <p>Hello {{recipient_name}},</p>
      <p>Please use the following One-Time Password (OTP) to verify your email address. This code is valid for <strong>{{validity_minutes}} minutes</strong>.</p>
      <div class="otp-box">{{otp_code}}</div>
      <p>If you did not request this verification, please safely ignore this email.</p>
    </div>
    <div class="footer">
      &copy; {{current_year}} {{platform_name}}. Confidential and automated message.
    </div>
  </div>
</body>
</html>`,
    textBody: `Hello {{recipient_name}},

Your verification code for {{platform_name}} is: {{otp_code}}
This code is valid for {{validity_minutes}} minutes.

If you did not request this, please ignore this email.`,
    availableVariables: ['platform_name', 'recipient_name', 'otp_code', 'validity_minutes', 'current_year'],
    sampleVariables: {
      platform_name: 'GymOS Platform',
      recipient_name: 'Aman Verma',
      otp_code: '492817',
      validity_minutes: '15',
      current_year: '2026',
    },
  },
  {
    code: 'PASSWORD_RESET',
    name: 'Password Reset',
    category: 'AUTHENTICATION',
    subject: 'Reset your password for {{platform_name}}',
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #0f172a; padding: 28px 24px; text-align: center; color: #ffffff; }
    .content { padding: 32px 24px; font-size: 15px; line-height: 1.6; }
    .btn { display: inline-block; background: #7c3aed; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f1f5f9; padding: 16px 24px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0;">{{platform_name}}</h2>
    </div>
    <div class="content">
      <p>Hello {{recipient_name}},</p>
      <p>We received a request to reset the password for your account. Click the button below to choose a new password:</p>
      <p><a href="{{reset_url}}" class="btn">Reset Password</a></p>
      <p>This password reset link will expire in <strong>{{validity_minutes}} minutes</strong>.</p>
      <p>If you did not request a password reset, no further action is required.</p>
    </div>
    <div class="footer">
      &copy; {{current_year}} {{platform_name}}. All rights reserved.
    </div>
  </div>
</body>
</html>`,
    textBody: `Hello {{recipient_name}},

To reset your {{platform_name}} password, please visit: {{reset_url}}
This link expires in {{validity_minutes}} minutes.

If you did not request this, please ignore this email.`,
    availableVariables: ['platform_name', 'recipient_name', 'reset_url', 'validity_minutes', 'current_year'],
    sampleVariables: {
      platform_name: 'GymOS Platform',
      recipient_name: 'Pooja Singh',
      reset_url: 'https://gymos.com/reset-password?token=sample123',
      validity_minutes: '60',
      current_year: '2026',
    },
  },
  {
    code: 'GYM_REGISTRATION_CONFIRMATION',
    name: 'Gym Registration Confirmation',
    category: 'ONBOARDING',
    subject: 'Your Gym "{{gym_name}}" has been registered on {{platform_name}}',
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .content { padding: 32px 24px; font-size: 15px; line-height: 1.6; }
    .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .info-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .btn { display: inline-block; background: #059669; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
    .footer { background: #f1f5f9; padding: 16px 24px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 style="margin:0; font-size:24px;">Registration Confirmed!</h1>
    </div>
    <div class="content">
      <p>Congratulations {{owner_name}},</p>
      <p>Your gym organization <strong>{{gym_name}}</strong> has been successfully registered on {{platform_name}}.</p>
      <table class="info-table">
        <tr><td><strong>Gym Name:</strong></td><td>{{gym_name}}</td></tr>
        <tr><td><strong>Primary Branch:</strong></td><td>{{branch_name}} (Code: {{branch_code}})</td></tr>
        <tr><td><strong>Assigned Plan:</strong></td><td>{{subscription_plan}}</td></tr>
        <tr><td><strong>Owner Login:</strong></td><td>{{owner_email}}</td></tr>
      </table>
      <p><a href="{{login_url}}" class="btn">Login to Gym Dashboard</a></p>
      <p>Need assistance? Contact our platform specialists at <a href="mailto:{{support_email}}">{{support_email}}</a>.</p>
    </div>
    <div class="footer">
      &copy; {{current_year}} {{platform_name}}. All rights reserved.
    </div>
  </div>
</body>
</html>`,
    textBody: `Congratulations {{owner_name}},

Your gym organization {{gym_name}} is now registered on {{platform_name}}.
- Branch: {{branch_name}} ({{branch_code}})
- Plan: {{subscription_plan}}
- Login: {{owner_email}}

Login here: {{login_url}}

Support: {{support_email}}`,
    availableVariables: ['platform_name', 'owner_name', 'gym_name', 'branch_name', 'branch_code', 'subscription_plan', 'owner_email', 'login_url', 'support_email', 'current_year'],
    sampleVariables: {
      platform_name: 'GymOS Platform',
      owner_name: 'Vikas Patel',
      gym_name: 'Iron Pulse Fitness',
      branch_name: 'Main HQ Branch',
      branch_code: 'HQ01',
      subscription_plan: 'Pro Tier (Annual)',
      owner_email: 'vikas@ironpulse.com',
      login_url: 'https://gymos.com/login',
      support_email: 'support@gymos.com',
      current_year: '2026',
    },
  },
  {
    code: 'SAAS_SUBSCRIPTION_ACTIVATED',
    name: 'SaaS Subscription Activated',
    category: 'BILLING',
    subject: 'GymOS Subscription Activated: {{subscription_plan}}',
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .content { padding: 32px 24px; font-size: 15px; line-height: 1.6; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
    .footer { background: #f1f5f9; padding: 16px 24px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0;">Subscription Activated</h2>
    </div>
    <div class="content">
      <p>Hello {{recipient_name}},</p>
      <p>Your subscription to <strong>{{subscription_plan}}</strong> for <strong>{{gym_name}}</strong> is now active!</p>
      <p>All entitled features including multi-branch operations, QR attendance, and automated member billing are unlocked for your team.</p>
      <p><strong>Renewal Date:</strong> {{expiry_date}}</p>
      <p><a href="{{dashboard_url}}" class="btn">Go to Dashboard</a></p>
    </div>
    <div class="footer">
      &copy; {{current_year}} {{platform_name}}. All rights reserved.
    </div>
  </div>
</body>
</html>`,
    textBody: `Hello {{recipient_name}},

Your subscription to {{subscription_plan}} for {{gym_name}} is now active.
Renewal Date: {{expiry_date}}

Dashboard: {{dashboard_url}}`,
    availableVariables: ['platform_name', 'recipient_name', 'gym_name', 'subscription_plan', 'expiry_date', 'dashboard_url', 'current_year'],
    sampleVariables: {
      platform_name: 'GymOS Platform',
      recipient_name: 'Ananya Roy',
      gym_name: 'FitStudio',
      subscription_plan: 'Enterprise Multi-Branch',
      expiry_date: '2027-11-20',
      dashboard_url: 'https://gymos.com/dashboard',
      current_year: '2026',
    },
  },
  {
    code: 'SUBSCRIPTION_EXPIRY_REMINDER',
    name: 'Subscription Expiry Reminder',
    category: 'BILLING',
    subject: 'Urgent: Your GymOS Subscription for {{gym_name}} expires on {{expiry_date}}',
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #d97706; padding: 28px 24px; text-align: center; color: #ffffff; }
    .content { padding: 32px 24px; font-size: 15px; line-height: 1.6; }
    .btn { display: inline-block; background: #d97706; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
    .footer { background: #f1f5f9; padding: 16px 24px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0;">Renewal Reminder</h2>
    </div>
    <div class="content">
      <p>Hello {{recipient_name}},</p>
      <p>This is a reminder that your <strong>{{subscription_plan}}</strong> subscription for <strong>{{gym_name}}</strong> will expire on <strong>{{expiry_date}}</strong>.</p>
      <p>To avoid any disruption to member check-ins, staff attendance scanning, and billing schedules, please renew your subscription before the expiration date.</p>
      <p><a href="{{billing_url}}" class="btn">Renew Subscription Now</a></p>
    </div>
    <div class="footer">
      &copy; {{current_year}} {{platform_name}}. All rights reserved.
    </div>
  </div>
</body>
</html>`,
    textBody: `Hello {{recipient_name}},

Your {{subscription_plan}} subscription for {{gym_name}} will expire on {{expiry_date}}.
To avoid service disruption, please renew your plan at {{billing_url}}.`,
    availableVariables: ['platform_name', 'recipient_name', 'gym_name', 'subscription_plan', 'expiry_date', 'billing_url', 'current_year'],
    sampleVariables: {
      platform_name: 'GymOS Platform',
      recipient_name: 'Sunil Rao',
      gym_name: 'Metro Fitness',
      subscription_plan: 'Pro Plan',
      expiry_date: '2026-12-01',
      billing_url: 'https://gymos.com/dashboard/organization/billing',
      current_year: '2026',
    },
  },
  {
    code: 'PAYMENT_SUCCESS',
    name: 'Payment Success',
    category: 'BILLING',
    subject: 'Receipt: Payment Received for {{gym_name}} (Invoice #{{invoice_number}})',
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #059669; padding: 28px 24px; text-align: center; color: #ffffff; }
    .content { padding: 32px 24px; font-size: 15px; line-height: 1.6; }
    .receipt { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .footer { background: #f1f5f9; padding: 16px 24px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0;">Payment Confirmed</h2>
    </div>
    <div class="content">
      <p>Hello {{recipient_name}},</p>
      <p>We have successfully processed your payment for <strong>{{gym_name}}</strong>.</p>
      <div class="receipt">
        <p style="margin:4px 0;"><strong>Invoice Number:</strong> {{invoice_number}}</p>
        <p style="margin:4px 0;"><strong>Amount Paid:</strong> {{currency}} {{amount_paid}}</p>
        <p style="margin:4px 0;"><strong>Date:</strong> {{payment_date}}</p>
        <p style="margin:4px 0;"><strong>Payment Method:</strong> {{payment_method}}</p>
      </div>
      <p>Thank you for choosing {{platform_name}}!</p>
    </div>
    <div class="footer">
      &copy; {{current_year}} {{platform_name}}. All rights reserved.
    </div>
  </div>
</body>
</html>`,
    textBody: `Hello {{recipient_name}},

Your payment of {{currency}} {{amount_paid}} for {{gym_name}} (Invoice #{{invoice_number}}) has been processed successfully on {{payment_date}}.

Thank you for your business!`,
    availableVariables: ['platform_name', 'recipient_name', 'gym_name', 'invoice_number', 'amount_paid', 'currency', 'payment_date', 'payment_method', 'current_year'],
    sampleVariables: {
      platform_name: 'GymOS Platform',
      recipient_name: 'Priya Nair',
      gym_name: 'Pulse Club',
      invoice_number: 'INV-2026-0941',
      amount_paid: '4,999.00',
      currency: 'INR',
      payment_date: '2026-11-21',
      payment_method: 'UPI / NetBanking',
      current_year: '2026',
    },
  },
  {
    code: 'PAYMENT_FAILED',
    name: 'Payment Failed',
    category: 'BILLING',
    subject: 'Action Required: Payment Failed for {{gym_name}}',
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #dc2626; padding: 28px 24px; text-align: center; color: #ffffff; }
    .content { padding: 32px 24px; font-size: 15px; line-height: 1.6; }
    .btn { display: inline-block; background: #dc2626; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
    .footer { background: #f1f5f9; padding: 16px 24px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0;">Payment Unsuccessful</h2>
    </div>
    <div class="content">
      <p>Hello {{recipient_name}},</p>
      <p>We were unable to process your recent payment of <strong>{{currency}} {{amount_due}}</strong> for <strong>{{gym_name}}</strong>.</p>
      <p>Reason: <em>{{failure_reason}}</em></p>
      <p>Please update your payment method or retry the transaction to prevent service suspension.</p>
      <p><a href="{{retry_url}}" class="btn">Retry Payment</a></p>
    </div>
    <div class="footer">
      &copy; {{current_year}} {{platform_name}}. All rights reserved.
    </div>
  </div>
</body>
</html>`,
    textBody: `Hello {{recipient_name}},

We were unable to process your payment of {{currency}} {{amount_due}} for {{gym_name}}.
Reason: {{failure_reason}}

Please retry your payment at: {{retry_url}}`,
    availableVariables: ['platform_name', 'recipient_name', 'gym_name', 'amount_due', 'currency', 'failure_reason', 'retry_url', 'current_year'],
    sampleVariables: {
      platform_name: 'GymOS Platform',
      recipient_name: 'Karan Mehra',
      gym_name: 'Alpha Gym',
      amount_due: '2,499.00',
      currency: 'INR',
      failure_reason: 'Card expired or insufficient balance',
      retry_url: 'https://gymos.com/dashboard/organization/billing/pay',
      current_year: '2026',
    },
  },
  {
    code: 'GYM_ACCOUNT_SUSPENDED',
    name: 'Gym Account Suspended',
    category: 'ONBOARDING',
    subject: 'Urgent: Gym Organization "{{gym_name}}" has been suspended',
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #475569; padding: 28px 24px; text-align: center; color: #ffffff; }
    .content { padding: 32px 24px; font-size: 15px; line-height: 1.6; }
    .footer { background: #f1f5f9; padding: 16px 24px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0;">Notice of Suspension</h2>
    </div>
    <div class="content">
      <p>Hello {{owner_name}},</p>
      <p>Your gym organization <strong>{{gym_name}}</strong> has been suspended on {{platform_name}}.</p>
      <p><strong>Reason for suspension:</strong> {{suspension_reason}}</p>
      <p>During suspension, member check-ins and staff operations are temporarily paused. If you believe this is an error or wish to reactivate your workspace, please contact us immediately.</p>
      <p>Contact Support: <a href="mailto:{{support_email}}">{{support_email}}</a></p>
    </div>
    <div class="footer">
      &copy; {{current_year}} {{platform_name}}. All rights reserved.
    </div>
  </div>
</body>
</html>`,
    textBody: `Hello {{owner_name}},

Your gym organization {{gym_name}} has been suspended on {{platform_name}}.
Reason: {{suspension_reason}}

Please contact support at {{support_email}} to resolve this issue.`,
    availableVariables: ['platform_name', 'owner_name', 'gym_name', 'suspension_reason', 'support_email', 'current_year'],
    sampleVariables: {
      platform_name: 'GymOS Platform',
      owner_name: 'Dinesh Karthik',
      gym_name: 'Titanium Fitness',
      suspension_reason: 'Non-payment of SaaS subscription invoices past 30 days grace period',
      support_email: 'compliance@gymos.com',
      current_year: '2026',
    },
  },
  {
    code: 'SUBSCRIPTION_RENEWAL_REMINDER',
    name: 'Subscription Renewal Reminder',
    category: 'BILLING',
    subject: 'Upcoming Automatic Renewal for {{gym_name}} ({{subscription_plan}})',
    htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #4338ca; padding: 28px 24px; text-align: center; color: #ffffff; }
    .content { padding: 32px 24px; font-size: 15px; line-height: 1.6; }
    .footer { background: #f1f5f9; padding: 16px 24px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0;">Upcoming Renewal</h2>
    </div>
    <div class="content">
      <p>Hello {{recipient_name}},</p>
      <p>Your subscription for <strong>{{gym_name}}</strong> will renew automatically on <strong>{{renewal_date}}</strong>.</p>
      <p><strong>Plan:</strong> {{subscription_plan}}<br><strong>Renewal Amount:</strong> {{currency}} {{renewal_amount}}</p>
      <p>Thank you for continuing with {{platform_name}}.</p>
    </div>
    <div class="footer">
      &copy; {{current_year}} {{platform_name}}. All rights reserved.
    </div>
  </div>
</body>
</html>`,
    textBody: `Hello {{recipient_name}},

Your subscription for {{gym_name}} ({{subscription_plan}}) will renew on {{renewal_date}} for {{currency}} {{renewal_amount}}.

Thank you for partnering with {{platform_name}}.`,
    availableVariables: ['platform_name', 'recipient_name', 'gym_name', 'subscription_plan', 'renewal_date', 'currency', 'renewal_amount', 'current_year'],
    sampleVariables: {
      platform_name: 'GymOS Platform',
      recipient_name: 'Simran Kaur',
      gym_name: 'Gold Line Fitness',
      subscription_plan: 'Annual Pro Gym Tier',
      renewal_date: '2026-12-15',
      currency: 'INR',
      renewal_amount: '29,999.00',
      current_year: '2026',
    },
  },
];
