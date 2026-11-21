import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { PlatformEncryptionService } from './platform-encryption.service';
import {
  WebsiteBrandingDto,
  SmtpConfigDto,
  TestSmtpDto,
  WhatsAppConfigDto,
  TestWhatsAppDto,
  EmailTemplateUpdateDto,
  TestEmailTemplateDto,
  AuditLogQueryDto,
  EmailLogQueryDto,
} from './dto/platform-settings.dto';
import { INITIAL_EMAIL_TEMPLATES } from './initial-templates';

@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly encryptionService: PlatformEncryptionService,
  ) {}

  // =========================================================================
  // 1. SETTINGS OVERVIEW (Status of all platform services)
  // =========================================================================

  async getSettingsOverview() {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const settings = await tx.platformSetting.findMany({
        where: {
          key: { in: ['WEBSITE_BRANDING', 'SMTP_CONFIG', 'WHATSAPP_CONFIG'] },
        },
      });

      const templatesCount = await tx.platformEmailTemplate.count();

      const websiteRecord = settings.find((s) => s.key === 'WEBSITE_BRANDING');
      const smtpRecord = settings.find((s) => s.key === 'SMTP_CONFIG');
      const whatsappRecord = settings.find((s) => s.key === 'WHATSAPP_CONFIG');

      return {
        website: {
          isConfigured: !!websiteRecord?.value,
          updatedAt: websiteRecord?.updatedAt || null,
        },
        smtp: {
          isConfigured: !!smtpRecord?.value,
          status: smtpRecord?.testStatus || 'UNTESTED',
          lastTestedAt: smtpRecord?.lastTestedAt || null,
          testMessage: smtpRecord?.testMessage || null,
          fromEmail: (smtpRecord?.value as any)?.fromEmail || null,
          host: (smtpRecord?.value as any)?.host || null,
        },
        whatsapp: {
          isConfigured: !!whatsappRecord?.value,
          status: whatsappRecord?.testStatus || 'UNTESTED',
          lastTestedAt: whatsappRecord?.lastTestedAt || null,
          testMessage: whatsappRecord?.testMessage || null,
          phoneNumberId: (whatsappRecord?.value as any)?.phoneNumberId || null,
        },
        templates: {
          totalCount: templatesCount,
        },
      };
    });
  }

  // =========================================================================
  // 2. WEBSITE BRANDING CONFIGURATION
  // =========================================================================

  async getBranding(_publicOnly = false) {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const record = await tx.platformSetting.findUnique({
        where: { key: 'WEBSITE_BRANDING' },
      });

      const fallbackBranding: WebsiteBrandingDto = {
        platformName: 'GymOS Platform',
        websiteName: 'GymOS — The Operating System for Modern Gyms',
        tagline: 'Multi-branch operations, automated billing, and smart attendance.',
        companyLegalName: 'GymOS Technologies Inc.',
        websiteUrl: 'http://localhost:3000',
        companyAddress: 'Bengaluru, Karnataka, India',
        contactEmail: 'contact@gymos.com',
        contactPhone: '+91 98765 43210',
        lightLogoUrl: '',
        darkLogoUrl: '',
        faviconUrl: '',
        primaryColor: '#7c3aed',
        secondaryColor: '#4f46e5',
        accentColor: '#10b981',
        socialLinks: {
          facebook: 'https://facebook.com/gymos',
          twitter: 'https://twitter.com/gymos',
          instagram: 'https://instagram.com/gymos',
          linkedin: 'https://linkedin.com/company/gymos',
          youtube: 'https://youtube.com/gymos',
        },
        footerCopyrightText: '© 2026 GymOS Platform Inc. All rights reserved.',
      };

      if (!record || !record.value) {
        return fallbackBranding;
      }

      return {
        ...fallbackBranding,
        ...(record.value as object),
      };
    });
  }

  async updateBranding(
    dto: WebsiteBrandingDto,
    actorId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const updated = await tx.platformSetting.upsert({
        where: { key: 'WEBSITE_BRANDING' },
        create: {
          category: 'WEBSITE',
          key: 'WEBSITE_BRANDING',
          value: dto as any,
          updatedBy: actorId || null,
        },
        update: {
          value: dto as any,
          updatedBy: actorId || null,
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId: null,
        userId: actorId,
        action: 'PLATFORM_BRANDING_UPDATED',
        entity: 'PlatformSetting',
        entityId: updated.id,
        metadata: {
          platformName: dto.platformName,
          primaryColor: dto.primaryColor,
          updatedFields: Object.keys(dto),
        },
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        message: 'Platform branding updated successfully',
        branding: updated.value,
      };
    });
  }

  // =========================================================================
  // 3. SMTP EMAIL CONFIGURATION
  // =========================================================================

  async getSmtpConfig() {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const record = await tx.platformSetting.findUnique({
        where: { key: 'SMTP_CONFIG' },
      });

      if (!record || !record.value) {
        return {
          host: '',
          port: 587,
          username: '',
          password: '',
          tlsMode: 'STARTTLS' as const,
          fromName: 'GymOS Platform',
          fromEmail: 'noreply@gymos.com',
          replyToEmail: 'support@gymos.com',
          lastTestedAt: null,
          testStatus: 'UNTESTED',
          testMessage: null,
          isConfigured: false,
        };
      }

      const val = record.value as any;
      return {
        host: val.host || '',
        port: val.port || 587,
        username: val.username || '',
        password: record.encryptedValue ? '••••••••' : '',
        tlsMode: val.tlsMode || 'STARTTLS',
        fromName: val.fromName || 'GymOS Platform',
        fromEmail: val.fromEmail || 'noreply@gymos.com',
        replyToEmail: val.replyToEmail || 'support@gymos.com',
        lastTestedAt: record.lastTestedAt,
        testStatus: record.testStatus || 'UNTESTED',
        testMessage: record.testMessage,
        isConfigured: true,
      };
    });
  }

  async updateSmtpConfig(
    dto: SmtpConfigDto,
    actorId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const existing = await tx.platformSetting.findUnique({
        where: { key: 'SMTP_CONFIG' },
      });

      let encryptedValue = existing?.encryptedValue || null;
      if (dto.password && dto.password.trim() !== '' && dto.password !== '••••••••') {
        encryptedValue = this.encryptionService.encrypt(dto.password.trim());
      }

      const safeValue = {
        host: dto.host.trim(),
        port: Number(dto.port),
        username: dto.username.trim(),
        tlsMode: dto.tlsMode,
        fromName: dto.fromName.trim(),
        fromEmail: dto.fromEmail.trim().toLowerCase(),
        replyToEmail: dto.replyToEmail?.trim().toLowerCase() || null,
      };

      const updated = await tx.platformSetting.upsert({
        where: { key: 'SMTP_CONFIG' },
        create: {
          category: 'EMAIL',
          key: 'SMTP_CONFIG',
          value: safeValue as any,
          encryptedValue,
          updatedBy: actorId || null,
        },
        update: {
          value: safeValue as any,
          encryptedValue,
          updatedBy: actorId || null,
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId: null,
        userId: actorId,
        action: 'SMTP_CONFIG_UPDATED',
        entity: 'PlatformSetting',
        entityId: updated.id,
        metadata: {
          host: dto.host,
          port: dto.port,
          fromEmail: dto.fromEmail,
          passwordProvided: !!dto.password && dto.password !== '••••••••',
        },
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        message: 'SMTP configuration saved successfully',
      };
    });
  }

  /**
   * Helper to construct a configured Nodemailer Transporter
   */
  private createTransporter(val: any, decryptedPassword?: string) {
    const host = val.host?.trim();
    const port = Number(val.port) || 587;
    const tlsMode = val.tlsMode || 'STARTTLS';
    const isSecure = tlsMode === 'SSL_TLS' || port === 465;

    return nodemailer.createTransport({
      host,
      port,
      secure: isSecure,
      auth: {
        user: val.username?.trim(),
        pass: decryptedPassword || '',
      },
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  /**
   * Tests live SMTP handshake and authentication against configured credentials.
   */
  async testSmtpConnection(actorId?: string, ipAddress?: string) {
    const record = await this.prisma.withSuperAdminContext(async (tx) => {
      return tx.platformSetting.findUnique({ where: { key: 'SMTP_CONFIG' } });
    });

    if (!record || !record.value) {
      throw new BadRequestException('SMTP configuration is not yet saved');
    }

    const val = record.value as any;
    const host = val.host?.trim();
    const port = Number(val.port) || 587;
    const decryptedPassword = record.encryptedValue
      ? this.encryptionService.decrypt(record.encryptedValue)
      : '';

    const transporter = this.createTransporter(val, decryptedPassword);

    let success = false;
    let message = '';

    try {
      await transporter.verify();
      success = true;
      message = `SMTP handshake and authentication successful with ${host}:${port} (${val.username})`;
    } catch (err: any) {
      success = false;
      const rawError = err?.message || 'SMTP Authentication / Connection failed';
      if (
        rawError.includes('535') ||
        rawError.toLowerCase().includes('badcredentials') ||
        rawError.toLowerCase().includes('username and password not accepted')
      ) {
        message = `Authentication Failed (535): Invalid SMTP username or password. For Gmail, you must generate a 16-character App Password from Google Account Security (requires 2-Step Verification).`;
      } else if (rawError.includes('ETIMEDOUT') || rawError.includes('timeout')) {
        message = `Connection timed out connecting to ${host}:${port}. Please verify the host, port and network/firewall settings.`;
      } else if (rawError.includes('ECONNREFUSED')) {
        message = `Connection refused by ${host}:${port}. Please verify that the SMTP server and port are reachable.`;
      } else {
        message = `SMTP Verification Error: ${rawError}`;
      }
    }

    // Update status in DB
    await this.prisma.withSuperAdminContext(async (tx) => {
      await tx.platformSetting.update({
        where: { key: 'SMTP_CONFIG' },
        data: {
          lastTestedAt: new Date(),
          testStatus: success ? 'SUCCESS' : 'FAILED',
          testMessage: message,
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId: null,
        userId: actorId,
        action: 'SMTP_CONNECTION_TEST',
        entity: 'PlatformSetting',
        entityId: record.id,
        metadata: {
          success,
          host,
          port,
          message,
        },
        ipAddress,
      });
    });

    return {
      success,
      status: success ? 'SUCCESS' : 'FAILED',
      message,
      testedAt: new Date(),
    };
  }

  async sendTestEmail(dto: TestSmtpDto, actorId?: string, ipAddress?: string) {
    const record = await this.prisma.withSuperAdminContext(async (tx) => {
      return tx.platformSetting.findUnique({ where: { key: 'SMTP_CONFIG' } });
    });

    if (!record || !record.value) {
      throw new BadRequestException('SMTP configuration is not yet saved');
    }

    const val = record.value as any;
    if (!record.encryptedValue) {
      throw new BadRequestException('SMTP password is not configured');
    }

    const decryptedPassword = this.encryptionService.decrypt(record.encryptedValue);
    const fromName = val.fromName?.trim() || 'GymOS Platform';
    const fromEmail = val.fromEmail?.trim() || 'noreply@gymos.com';
    const replyTo = val.replyToEmail?.trim() || fromEmail;
    const targetEmail = dto.targetEmail.trim().toLowerCase();

    const transporter = this.createTransporter(val, decryptedPassword);

    const subject = `[GymOS] Platform SMTP Test Email (${new Date().toLocaleTimeString()})`;
    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; padding: 10px 24px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; border-radius: 8px; font-weight: 700; font-size: 20px; letter-spacing: -0.5px;">
            GymOS Platform
          </div>
        </div>
        <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin-bottom: 12px; text-align: center;">
          SMTP Test Verification Succeeded
        </h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; text-align: center;">
          Congratulations! This email confirms that your outgoing SMTP credentials and connection are properly configured and operational on the <strong>GymOS Platform</strong>.
        </p>
        <div style="margin: 24px 0; background-color: #f8fafc; border-radius: 8px; padding: 18px; border: 1px solid #e2e8f0;">
          <table style="width: 100%; font-size: 13px; color: #334155; line-height: 1.8;">
            <tr><td style="font-weight: 600; width: 140px; color: #64748b;">SMTP Server:</td><td style="font-weight: 500;">${val.host}:${val.port}</td></tr>
            <tr><td style="font-weight: 600; color: #64748b;">Encryption:</td><td style="font-weight: 500;">${val.tlsMode}</td></tr>
            <tr><td style="font-weight: 600; color: #64748b;">Dispatched From:</td><td style="font-weight: 500;">${fromName} &lt;${fromEmail}&gt;</td></tr>
            <tr><td style="font-weight: 600; color: #64748b;">Recipient:</td><td style="font-weight: 500;">${targetEmail}</td></tr>
            <tr><td style="font-weight: 600; color: #64748b;">Dispatched At:</td><td style="font-weight: 500;">${new Date().toISOString()}</td></tr>
          </table>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          GymOS Enterprise Multi-Tenant Platform &bull; Automated System Verification
        </p>
      </div>
    `;

    const textBody = `GymOS Platform SMTP Test Verification\n\n` +
      `Your outgoing SMTP credentials and connection are properly configured.\n\n` +
      `SMTP Host: ${val.host}:${val.port}\n` +
      `TLS Mode: ${val.tlsMode}\n` +
      `Dispatched From: ${fromName} <${fromEmail}>\n` +
      `Dispatched At: ${new Date().toISOString()}\n`;

    try {
      const sendInfo = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: targetEmail,
        replyTo,
        subject,
        html: htmlBody,
        text: textBody,
      });

      // Record successful delivery log
      await this.prisma.withSuperAdminContext(async (tx) => {
        await tx.platformEmailLog.create({
          data: {
            recipient: targetEmail,
            sender: fromEmail,
            subject,
            templateCode: 'SMTP_TEST',
            status: 'SUCCESS',
            messageId: sendInfo.messageId || null,
            response: sendInfo.response || null,
            metadata: {
              host: val.host,
              port: val.port,
              tlsMode: val.tlsMode,
            },
            sentBy: actorId || null,
          },
        });

        await this.auditService.recordInTransaction(tx, {
          organizationId: null,
          userId: actorId,
          action: 'SMTP_SEND_TEST_EMAIL',
          entity: 'PlatformSetting',
          entityId: record.id,
          metadata: {
            targetEmail,
            fromEmail,
            messageId: sendInfo.messageId,
            success: true,
          },
          ipAddress,
        });
      });

      return {
        success: true,
        message: `Test email successfully delivered to ${targetEmail}! (Message ID: ${sendInfo.messageId || 'OK'})`,
        timestamp: new Date(),
      };
    } catch (err: any) {
      const errorMessage = err?.message || 'Unknown SMTP dispatch error';

      // Log failure in platform_email_logs
      await this.prisma.withSuperAdminContext(async (tx) => {
        await tx.platformEmailLog.create({
          data: {
            recipient: targetEmail,
            sender: fromEmail,
            subject,
            templateCode: 'SMTP_TEST',
            status: 'FAILED',
            errorMessage,
            metadata: {
              host: val.host,
              port: val.port,
              tlsMode: val.tlsMode,
              code: err?.code,
              command: err?.command,
            },
            sentBy: actorId || null,
          },
        });

        await this.auditService.recordInTransaction(tx, {
          organizationId: null,
          userId: actorId,
          action: 'SMTP_SEND_TEST_EMAIL_FAILED',
          entity: 'PlatformSetting',
          entityId: record.id,
          metadata: {
            targetEmail,
            fromEmail,
            error: errorMessage,
            success: false,
          },
          ipAddress,
        });
      });

      let hint = '';
      if (
        errorMessage.includes('535') ||
        errorMessage.toLowerCase().includes('badcredentials') ||
        errorMessage.toLowerCase().includes('username and password not accepted')
      ) {
        hint =
          ' Hint: Invalid username or password (535). For Gmail, you must generate a 16-character App Password under Google Account Security (requires 2-Step Verification).';
      }

      throw new BadRequestException(`Failed to dispatch email: ${errorMessage}.${hint}`);
    }
  }

  // =========================================================================
  // 4. WHATSAPP CLOUD API CONFIGURATION
  // =========================================================================

  async getWhatsAppConfig() {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const record = await tx.platformSetting.findUnique({
        where: { key: 'WHATSAPP_CONFIG' },
      });

      if (!record || !record.value) {
        return {
          metaAppId: '',
          wabaId: '',
          phoneNumberId: '',
          accessToken: '',
          webhookVerifyToken: '',
          apiVersion: 'v21.0',
          lastTestedAt: null,
          testStatus: 'UNTESTED',
          testMessage: null,
          isConfigured: false,
        };
      }

      const val = record.value as any;
      return {
        metaAppId: val.metaAppId || '',
        wabaId: val.wabaId || '',
        phoneNumberId: val.phoneNumberId || '',
        accessToken: record.encryptedValue ? '••••••••' : '',
        webhookVerifyToken: val.webhookVerifyToken || '',
        apiVersion: val.apiVersion || 'v21.0',
        lastTestedAt: record.lastTestedAt,
        testStatus: record.testStatus || 'UNTESTED',
        testMessage: record.testMessage,
        isConfigured: true,
      };
    });
  }

  async updateWhatsAppConfig(
    dto: WhatsAppConfigDto,
    actorId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const existing = await tx.platformSetting.findUnique({
        where: { key: 'WHATSAPP_CONFIG' },
      });

      let encryptedValue = existing?.encryptedValue || null;
      if (dto.accessToken && dto.accessToken.trim() !== '' && dto.accessToken !== '••••••••') {
        encryptedValue = this.encryptionService.encrypt(dto.accessToken.trim());
      }

      const safeValue = {
        metaAppId: dto.metaAppId.trim(),
        wabaId: dto.wabaId.trim(),
        phoneNumberId: dto.phoneNumberId.trim(),
        webhookVerifyToken: dto.webhookVerifyToken?.trim() || null,
        apiVersion: dto.apiVersion?.trim() || 'v21.0',
      };

      const updated = await tx.platformSetting.upsert({
        where: { key: 'WHATSAPP_CONFIG' },
        create: {
          category: 'WHATSAPP',
          key: 'WHATSAPP_CONFIG',
          value: safeValue as any,
          encryptedValue,
          updatedBy: actorId || null,
        },
        update: {
          value: safeValue as any,
          encryptedValue,
          updatedBy: actorId || null,
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId: null,
        userId: actorId,
        action: 'WHATSAPP_CONFIG_UPDATED',
        entity: 'PlatformSetting',
        entityId: updated.id,
        metadata: {
          metaAppId: dto.metaAppId,
          phoneNumberId: dto.phoneNumberId,
          tokenUpdated: !!dto.accessToken && dto.accessToken !== '••••••••',
        },
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        message: 'WhatsApp Cloud API configuration saved successfully',
      };
    });
  }

  async verifyWhatsAppConnection(actorId?: string, ipAddress?: string) {
    const record = await this.prisma.withSuperAdminContext(async (tx) => {
      return tx.platformSetting.findUnique({ where: { key: 'WHATSAPP_CONFIG' } });
    });

    if (!record || !record.value) {
      throw new BadRequestException('WhatsApp Cloud API configuration is not saved');
    }

    if (!record.encryptedValue) {
      throw new BadRequestException('WhatsApp Access Token is not set');
    }

    const val = record.value as any;
    const decryptedToken = this.encryptionService.decrypt(record.encryptedValue);
    const phoneNumberId = val.phoneNumberId;
    const apiVersion = val.apiVersion || 'v21.0';

    let success = false;
    let message = '';

    try {
      const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${decryptedToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = (await response.json().catch(() => ({}))) as any;

      if (response.ok && data?.id) {
        success = true;
        message = `Meta Graph API Verified! Connected Phone Number ID: ${data.id} (${data.verified_name || data.display_phone_number || 'Active'})`;
      } else {
        success = false;
        const errDetail = data?.error?.message || `HTTP ${response.status} ${response.statusText}`;
        message = `Meta API Error: ${errDetail}`;
      }
    } catch (err: any) {
      success = false;
      message = `Network error connecting to Meta Graph API: ${err?.message || 'Connection failed'}`;
    }

    await this.prisma.withSuperAdminContext(async (tx) => {
      await tx.platformSetting.update({
        where: { key: 'WHATSAPP_CONFIG' },
        data: {
          lastTestedAt: new Date(),
          testStatus: success ? 'SUCCESS' : 'FAILED',
          testMessage: message,
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId: null,
        userId: actorId,
        action: 'WHATSAPP_CONNECTION_VERIFIED',
        entity: 'PlatformSetting',
        entityId: record.id,
        metadata: {
          success,
          message,
          phoneNumberId,
        },
        ipAddress,
      });
    });

    return {
      success,
      status: success ? 'SUCCESS' : 'FAILED',
      message,
      testedAt: new Date(),
    };
  }

  async sendTestWhatsAppMessage(dto: TestWhatsAppDto, actorId?: string, ipAddress?: string) {
    const record = await this.prisma.withSuperAdminContext(async (tx) => {
      return tx.platformSetting.findUnique({ where: { key: 'WHATSAPP_CONFIG' } });
    });

    if (!record || !record.encryptedValue) {
      throw new BadRequestException('WhatsApp API is not configured with an access token');
    }

    const val = record.value as any;
    const decryptedToken = this.encryptionService.decrypt(record.encryptedValue);
    const phoneNumberId = val.phoneNumberId;
    const apiVersion = val.apiVersion || 'v21.0';

    const testBody = dto.message || 'Hello from GymOS Platform Super Admin! This is a verification test message.';

    let success = false;
    let message = '';
    let metaMessageId = null;

    try {
      const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${decryptedToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: dto.testPhoneNumber.replace(/[^0-9]/g, ''),
          type: 'text',
          text: { preview_url: false, body: testBody },
        }),
      });

      const data = (await response.json().catch(() => ({}))) as any;

      if (response.ok && data?.messages?.[0]?.id) {
        success = true;
        metaMessageId = data.messages[0].id;
        message = `Test message sent successfully to ${dto.testPhoneNumber}! Meta Message ID: ${metaMessageId}`;
      } else {
        success = false;
        const errDetail = data?.error?.message || `HTTP ${response.status}`;
        message = `Meta WhatsApp Error: ${errDetail}`;
      }
    } catch (err: any) {
      success = false;
      message = `Network error sending message via Meta: ${err?.message || 'Request failed'}`;
    }

    await this.prisma.withSuperAdminContext(async (tx) => {
      await this.auditService.recordInTransaction(tx, {
        organizationId: null,
        userId: actorId,
        action: 'WHATSAPP_SEND_TEST_MESSAGE',
        entity: 'PlatformSetting',
        entityId: record.id,
        metadata: {
          success,
          targetPhone: dto.testPhoneNumber,
          metaMessageId,
          message,
        },
        ipAddress,
      });
    });

    return {
      success,
      message,
      metaMessageId,
      timestamp: new Date(),
    };
  }

  handleWhatsAppWebhookVerify(mode?: string, token?: string, challenge?: string) {
    if (!mode || !token) {
      throw new BadRequestException('Missing webhook query parameters');
    }

    return this.prisma.withSuperAdminContext(async (tx) => {
      const record = await tx.platformSetting.findUnique({
        where: { key: 'WHATSAPP_CONFIG' },
      });
      const expectedToken = (record?.value as any)?.webhookVerifyToken;

      if (mode === 'subscribe' && token === expectedToken) {
        return challenge;
      }
      throw new BadRequestException('Webhook verification token mismatch');
    });
  }

  // =========================================================================
  // 5. EMAIL TEMPLATES MANAGEMENT
  // =========================================================================

  async ensureTemplatesSeeded() {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const count = await tx.platformEmailTemplate.count();
      if (count === 0) {
        this.logger.log('Seeding initial 10 platform email templates...');
        for (const tpl of INITIAL_EMAIL_TEMPLATES) {
          await tx.platformEmailTemplate.create({
            data: {
              code: tpl.code,
              name: tpl.name,
              category: tpl.category,
              subject: tpl.subject,
              htmlBody: tpl.htmlBody,
              textBody: tpl.textBody,
              availableVariables: tpl.availableVariables as any,
              sampleVariables: tpl.sampleVariables as any,
              isActive: true,
              version: 1,
            },
          });
        }
      }
    });
  }

  async getEmailTemplates(category?: string, search?: string) {
    await this.ensureTemplatesSeeded();

    return this.prisma.withSuperAdminContext(async (tx) => {
      const where: any = {};
      if (category && category !== 'ALL') {
        where.category = category;
      }
      if (search && search.trim() !== '') {
        where.OR = [
          { name: { contains: search.trim(), mode: 'insensitive' } },
          { code: { contains: search.trim(), mode: 'insensitive' } },
          { subject: { contains: search.trim(), mode: 'insensitive' } },
        ];
      }

      return tx.platformEmailTemplate.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });
    });
  }

  async getEmailTemplateByCode(code: string) {
    await this.ensureTemplatesSeeded();

    return this.prisma.withSuperAdminContext(async (tx) => {
      const template = await tx.platformEmailTemplate.findUnique({
        where: { code: code.toUpperCase() },
      });

      if (!template) {
        throw new NotFoundException(`Email template with code "${code}" not found`);
      }

      return template;
    });
  }

  /**
   * Safe HTML Sanitizer: Removes executable scripts, onload, onerror, javascript: URIs.
   */
  private sanitizeHtml(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\s*on\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
      .replace(/javascript:/gi, 'blocked-javascript:');
  }

  /**
   * Variable Interpolation Engine: Safe replacement of {{key}}
   */
  private interpolateVariables(content: string, variables: Record<string, string>): string {
    return content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`;
    });
  }

  async updateEmailTemplate(
    code: string,
    dto: EmailTemplateUpdateDto,
    actorId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const existing = await tx.platformEmailTemplate.findUnique({
        where: { code: code.toUpperCase() },
      });

      if (!existing) {
        throw new NotFoundException(`Email template with code "${code}" not found`);
      }

      const sanitizedHtml = this.sanitizeHtml(dto.htmlBody);
      const newVersion = existing.version + 1;

      // Preserve previous version in history array
      const currentHistory = (existing.history as any[]) || [];
      const historyEntry = {
        version: existing.version,
        subject: existing.subject,
        htmlBody: existing.htmlBody,
        textBody: existing.textBody,
        updatedBy: existing.updatedBy,
        updatedAt: existing.updatedAt,
      };

      const updated = await tx.platformEmailTemplate.update({
        where: { id: existing.id },
        data: {
          name: dto.name?.trim() || existing.name,
          subject: dto.subject.trim(),
          htmlBody: sanitizedHtml,
          textBody: dto.textBody !== undefined ? dto.textBody : existing.textBody,
          isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
          version: newVersion,
          history: [...currentHistory, historyEntry],
          updatedBy: actorId || null,
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId: null,
        userId: actorId,
        action: 'EMAIL_TEMPLATE_UPDATED',
        entity: 'PlatformEmailTemplate',
        entityId: updated.id,
        metadata: {
          code: updated.code,
          version: newVersion,
          subject: updated.subject,
        },
        ipAddress,
        userAgent,
      });

      return {
        success: true,
        message: `Template "${updated.name}" updated to version ${newVersion}`,
        template: updated,
      };
    });
  }

  async renderTemplatePreview(code: string, customVariables?: Record<string, string>) {
    const template = await this.getEmailTemplateByCode(code);
    const variables = {
      ...((template.sampleVariables as Record<string, string>) || {}),
      ...(customVariables || {}),
    };

    const renderedSubject = this.interpolateVariables(template.subject, variables);
    const renderedHtml = this.interpolateVariables(template.htmlBody, variables);
    const renderedText = template.textBody
      ? this.interpolateVariables(template.textBody, variables)
      : '';

    return {
      templateCode: template.code,
      templateName: template.name,
      renderedSubject,
      renderedHtml,
      renderedText,
      variables,
    };
  }

  async sendTestTemplateEmail(
    code: string,
    dto: TestEmailTemplateDto,
    actorId?: string,
    ipAddress?: string,
  ) {
    const preview = await this.renderTemplatePreview(code, dto.sampleVariables);

    // Fetch SMTP config
    const smtpSetting = await this.prisma.withSuperAdminContext(async (tx) => {
      return tx.platformSetting.findUnique({ where: { key: 'SMTP_CONFIG' } });
    });

    if (!smtpSetting || !smtpSetting.value || !smtpSetting.encryptedValue) {
      throw new BadRequestException(
        'Platform SMTP is not configured or missing password. Please configure SMTP in Platform Settings first.',
      );
    }

    const val = smtpSetting.value as any;
    const decryptedPassword = this.encryptionService.decrypt(smtpSetting.encryptedValue);
    const fromName = val.fromName?.trim() || 'GymOS Platform';
    const fromEmail = val.fromEmail?.trim() || 'noreply@gymos.com';
    const replyTo = val.replyToEmail?.trim() || fromEmail;
    const targetEmail = dto.targetEmail.trim().toLowerCase();

    const transporter = this.createTransporter(val, decryptedPassword);

    try {
      const sendInfo = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: targetEmail,
        replyTo,
        subject: preview.renderedSubject,
        html: preview.renderedHtml,
        text: preview.renderedText || undefined,
      });

      // Record successful delivery log
      await this.prisma.withSuperAdminContext(async (tx) => {
        await tx.platformEmailLog.create({
          data: {
            recipient: targetEmail,
            sender: fromEmail,
            subject: preview.renderedSubject,
            templateCode: code,
            status: 'SUCCESS',
            messageId: sendInfo.messageId || null,
            response: sendInfo.response || null,
            metadata: {
              code,
              templateName: preview.templateName,
              sampleVariables: dto.sampleVariables,
            },
            sentBy: actorId || null,
          },
        });

        await this.auditService.recordInTransaction(tx, {
          organizationId: null,
          userId: actorId,
          action: 'EMAIL_TEMPLATE_TEST_SENT',
          entity: 'PlatformEmailTemplate',
          entityId: code,
          metadata: {
            targetEmail,
            code,
            subject: preview.renderedSubject,
            messageId: sendInfo.messageId,
            success: true,
          },
          ipAddress,
        });
      });

      return {
        success: true,
        message: `Template [${code}] email successfully delivered to ${targetEmail}! (Message ID: ${sendInfo.messageId || 'OK'})`,
        renderedSubject: preview.renderedSubject,
        timestamp: new Date(),
      };
    } catch (err: any) {
      const errorMessage = err?.message || 'SMTP Template dispatch failed';

      await this.prisma.withSuperAdminContext(async (tx) => {
        await tx.platformEmailLog.create({
          data: {
            recipient: targetEmail,
            sender: fromEmail,
            subject: preview.renderedSubject,
            templateCode: code,
            status: 'FAILED',
            errorMessage,
            metadata: {
              code,
              templateName: preview.templateName,
              sampleVariables: dto.sampleVariables,
            },
            sentBy: actorId || null,
          },
        });

        await this.auditService.recordInTransaction(tx, {
          organizationId: null,
          userId: actorId,
          action: 'EMAIL_TEMPLATE_TEST_FAILED',
          entity: 'PlatformEmailTemplate',
          entityId: code,
          metadata: {
            targetEmail,
            code,
            subject: preview.renderedSubject,
            error: errorMessage,
            success: false,
          },
          ipAddress,
        });
      });

      throw new BadRequestException(`Failed to dispatch template email: ${errorMessage}`);
    }
  }

  // =========================================================================
  // 6. PLATFORM AUDIT LOGS
  // =========================================================================

  async getPlatformAuditLogs(query: AuditLogQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    return this.prisma.withSuperAdminContext(async (tx) => {
      const where: any = {
        OR: [
          { organizationId: null },
          {
            entity: {
              in: [
                'PlatformSetting',
                'PlatformEmailTemplate',
                'PLATFORM',
                'SaasPlan',
                'FeatureCatalog',
              ],
            },
          },
        ],
      };

      if (query.action && query.action !== 'ALL') {
        where.action = query.action;
      }

      if (query.search && query.search.trim() !== '') {
        const s = query.search.trim();
        where.AND = [
          {
            OR: [
              { action: { contains: s, mode: 'insensitive' } },
              { entity: { contains: s, mode: 'insensitive' } },
              { ipAddress: { contains: s, mode: 'insensitive' } },
              { user: { email: { contains: s, mode: 'insensitive' } } },
            ],
          },
        ];
      }

      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate) {
          where.createdAt.gte = new Date(query.startDate);
        }
        if (query.endDate) {
          where.createdAt.lte = new Date(query.endDate);
        }
      }

      const [total, logs] = await Promise.all([
        tx.auditLog.count({ where }),
        tx.auditLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                isSuperAdmin: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
      ]);

      return {
        data: logs,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  // =========================================================================
  // 7. PLATFORM EMAIL DELIVERY LOGS
  // =========================================================================

  async getPlatformEmailLogs(query: EmailLogQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    return this.prisma.withSuperAdminContext(async (tx) => {
      const where: any = {};

      if (query.status && query.status !== 'ALL') {
        where.status = query.status;
      }

      if (query.templateCode && query.templateCode.trim()) {
        where.templateCode = query.templateCode.trim();
      }

      if (query.search && query.search.trim()) {
        const s = query.search.trim();
        where.OR = [
          { recipient: { contains: s, mode: 'insensitive' } },
          { sender: { contains: s, mode: 'insensitive' } },
          { subject: { contains: s, mode: 'insensitive' } },
          { templateCode: { contains: s, mode: 'insensitive' } },
          { errorMessage: { contains: s, mode: 'insensitive' } },
        ];
      }

      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate) {
          where.createdAt.gte = new Date(query.startDate);
        }
        if (query.endDate) {
          where.createdAt.lte = new Date(query.endDate);
        }
      }

      const [total, items, successCount, failedCount] = await Promise.all([
        tx.platformEmailLog.count({ where }),
        tx.platformEmailLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        tx.platformEmailLog.count({ where: { status: 'SUCCESS' } }),
        tx.platformEmailLog.count({ where: { status: 'FAILED' } }),
      ]);

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        summary: {
          total: successCount + failedCount,
          success: successCount,
          failed: failedCount,
        },
      };
    });
  }

  async resendEmailLog(logId: string, actorId?: string, ipAddress?: string) {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const log = await tx.platformEmailLog.findUnique({ where: { id: logId } });
      if (!log) {
        throw new NotFoundException(`Email log with ID ${logId} not found`);
      }

      const record = await tx.platformSetting.findUnique({ where: { key: 'SMTP_CONFIG' } });
      if (!record || !record.value || !record.encryptedValue) {
        throw new BadRequestException('SMTP is not properly configured');
      }

      const val = record.value as any;
      const decryptedPassword = this.encryptionService.decrypt(record.encryptedValue);

      const transporter = this.createTransporter(val, decryptedPassword);

      try {
        const sendInfo = await transporter.sendMail({
          from: `"${val.fromName || 'GymOS Platform'}" <${val.fromEmail}>`,
          to: log.recipient,
          subject: log.subject.startsWith('[Resent]') ? log.subject : `[Resent] ${log.subject}`,
          html: `<div style="font-family: sans-serif; padding: 20px;">
            <p style="color: #2563eb; font-weight: bold;">[Resent Dispatch from GymOS Platform]</p>
            <p><strong>Subject:</strong> ${log.subject}</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
            <p>This message was manually re-triggered by the platform administrator.</p>
          </div>`,
          text: `[Resent Dispatch from GymOS Platform]\nSubject: ${log.subject}\n\nThis message was manually re-triggered by the platform administrator.\n`,
        });

        const newLog = await tx.platformEmailLog.create({
          data: {
            recipient: log.recipient,
            sender: val.fromEmail,
            subject: log.subject.startsWith('[Resent]') ? log.subject : `[Resent] ${log.subject}`,
            templateCode: log.templateCode,
            status: 'SUCCESS',
            messageId: sendInfo.messageId || null,
            response: sendInfo.response || null,
            metadata: {
              originalLogId: log.id,
              host: val.host,
              port: val.port,
            },
            sentBy: actorId || null,
          },
        });

        await this.auditService.recordInTransaction(tx, {
          organizationId: null,
          userId: actorId,
          action: 'SMTP_RESEND_EMAIL',
          entity: 'PlatformEmailLog',
          entityId: newLog.id,
          metadata: {
            recipient: log.recipient,
            originalLogId: log.id,
            success: true,
          },
          ipAddress,
        });

        return {
          success: true,
          message: `Email successfully resent to ${log.recipient}! (Message ID: ${sendInfo.messageId || 'OK'})`,
          logId: newLog.id,
        };
      } catch (err: any) {
        const errorMsg = err?.message || 'SMTP resend failed';

        await tx.platformEmailLog.create({
          data: {
            recipient: log.recipient,
            sender: val.fromEmail,
            subject: log.subject.startsWith('[Resent]') ? log.subject : `[Resent] ${log.subject}`,
            templateCode: log.templateCode,
            status: 'FAILED',
            errorMessage: errorMsg,
            metadata: {
              originalLogId: log.id,
              host: val.host,
              port: val.port,
            },
            sentBy: actorId || null,
          },
        });

        await this.auditService.recordInTransaction(tx, {
          organizationId: null,
          userId: actorId,
          action: 'SMTP_RESEND_EMAIL_FAILED',
          entity: 'PlatformEmailLog',
          entityId: log.id,
          metadata: {
            recipient: log.recipient,
            originalLogId: log.id,
            error: errorMsg,
            success: false,
          },
          ipAddress,
        });

        throw new BadRequestException(`Failed to resend email: ${errorMsg}`);
      }
    });
  }

  async clearEmailLogs(actorId?: string, ipAddress?: string) {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const count = await tx.platformEmailLog.deleteMany();

      await this.auditService.recordInTransaction(tx, {
        organizationId: null,
        userId: actorId,
        action: 'SMTP_CLEAR_EMAIL_LOGS',
        entity: 'PlatformEmailLog',
        entityId: 'all',
        metadata: {
          deletedCount: count.count,
        },
        ipAddress,
      });

      return {
        success: true,
        message: `Successfully cleared ${count.count} platform email delivery logs`,
      };
    });
  }
}
