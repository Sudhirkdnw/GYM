export class WebsiteBrandingDto {
  platformName!: string;
  websiteName!: string;
  tagline?: string;
  companyLegalName?: string;
  websiteUrl?: string;
  companyAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  lightLogoUrl?: string;
  darkLogoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
  };
  footerCopyrightText?: string;
}

export class SmtpConfigDto {
  host!: string;
  port!: number;
  username!: string;
  password?: string;
  tlsMode!: 'STARTTLS' | 'SSL_TLS' | 'NONE';
  fromName!: string;
  fromEmail!: string;
  replyToEmail?: string;
}

export class TestSmtpDto {
  targetEmail!: string;
}

export class WhatsAppConfigDto {
  metaAppId!: string;
  wabaId!: string;
  phoneNumberId!: string;
  accessToken?: string;
  webhookVerifyToken?: string;
  apiVersion?: string;
}

export class TestWhatsAppDto {
  testPhoneNumber!: string;
  message?: string;
}

export class EmailTemplateUpdateDto {
  name?: string;
  subject!: string;
  htmlBody!: string;
  textBody?: string;
  isActive?: boolean;
}

export class TestEmailTemplateDto {
  targetEmail!: string;
  sampleVariables?: Record<string, string>;
}

export class AuditLogQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}

export class EmailLogQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'ALL' | 'SUCCESS' | 'FAILED';
  templateCode?: string;
  startDate?: string;
  endDate?: string;
}

