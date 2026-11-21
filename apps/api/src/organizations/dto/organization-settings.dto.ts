export class GeneralSettingsDto {
  timezone?: string;
  currency?: string;
  taxId?: string;
  invoicePrefix?: string;
  receiptFooterNote?: string;
  receptionPhone?: string;
  receptionEmail?: string;
}

export class GymSmtpConfigDto {
  provider!: 'PLATFORM_DEFAULT' | 'CUSTOM_SMTP';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  tlsMode?: 'STARTTLS' | 'SSL_TLS' | 'NONE';
  fromName?: string;
  fromEmail?: string;
  replyToEmail?: string;
}

export class GymWhatsAppConfigDto {
  provider!: 'PLATFORM_DEFAULT' | 'CUSTOM_WHATSAPP';
  metaAppId?: string;
  wabaId?: string;
  phoneNumberId?: string;
  accessToken?: string;
  webhookVerifyToken?: string;
  apiVersion?: string;
}

export class GymNotificationSettingsDto {
  emailWelcomeMember?: boolean;
  emailPaymentReceipt?: boolean;
  emailMembershipExpiry?: boolean;
  emailDueReminder?: boolean;
  whatsappWelcomeMember?: boolean;
  whatsappPaymentReceipt?: boolean;
  whatsappMembershipExpiry?: boolean;
  whatsappDueReminder?: boolean;
  whatsappAttendanceCheckin?: boolean;
}

export class TestOrgSmtpDto {
  targetEmail!: string;
}

export class TestOrgWhatsAppDto {
  testPhoneNumber!: string;
  message?: string;
}
