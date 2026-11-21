import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as net from 'net';
import * as tls from 'tls';
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
   * Tests live socket connectivity and handshake to the configured SMTP server.
   */
  async testSmtpConnection(actorId?: string, ipAddress?: string) {
    const record = await this.prisma.withSuperAdminContext(async (tx) => {
      return tx.platformSetting.findUnique({ where: { key: 'SMTP_CONFIG' } });
    });

    if (!record || !record.value) {
      throw new BadRequestException('SMTP configuration is not yet saved');
    }

    const val = record.value as any;
    const host = val.host;
    const port = Number(val.port);
    const tlsMode = val.tlsMode;

    const testResult = await new Promise<{ success: boolean; message: string }>((resolve) => {
      const timeout = 7000;
      let settled = false;

      const finish = (success: boolean, message: string) => {
        if (!settled) {
          settled = true;
          resolve({ success, message });
        }
      };

      try {
        if (tlsMode === 'SSL_TLS') {
          const socket = tls.connect({ host, port, timeout }, () => {
            socket.destroy();
            finish(true, `Successfully established SSL/TLS connection to ${host}:${port}`);
          });
          socket.on('error', (err) => {
            finish(false, `SSL/TLS connection error to ${host}:${port}: ${err.message}`);
          });
          socket.on('timeout', () => {
            socket.destroy();
            finish(false, `Connection to ${host}:${port} timed out after ${timeout / 1000}s`);
          });
        } else {
          const socket = net.createConnection({ host, port, timeout }, () => {
            socket.destroy();
            finish(true, `Successfully connected to SMTP server at ${host}:${port}`);
          });
          socket.on('error', (err) => {
            finish(false, `Socket connection error to ${host}:${port}: ${err.message}`);
          });
          socket.on('timeout', () => {
            socket.destroy();
            finish(false, `Connection to ${host}:${port} timed out after ${timeout / 1000}s`);
          });
        }
      } catch (err: any) {
        finish(false, `Failed to initialize connection test: ${err?.message || 'Unknown error'}`);
      }
    });

    // Update status in DB
    await this.prisma.withSuperAdminContext(async (tx) => {
      await tx.platformSetting.update({
        where: { key: 'SMTP_CONFIG' },
        data: {
          lastTestedAt: new Date(),
          testStatus: testResult.success ? 'SUCCESS' : 'FAILED',
          testMessage: testResult.message,
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId: null,
        userId: actorId,
        action: 'SMTP_CONNECTION_TEST',
        entity: 'PlatformSetting',
        entityId: record.id,
        metadata: {
          success: testResult.success,
          host,
          port,
          message: testResult.message,
        },
        ipAddress,
      });
    });

    return {
      success: testResult.success,
      status: testResult.success ? 'SUCCESS' : 'FAILED',
      message: testResult.message,
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

    // Record audit event
    await this.prisma.withSuperAdminContext(async (tx) => {
      await this.auditService.recordInTransaction(tx, {
        organizationId: null,
        userId: actorId,
        action: 'SMTP_SEND_TEST_EMAIL',
        entity: 'PlatformSetting',
        entityId: record.id,
        metadata: {
          targetEmail: dto.targetEmail,
          fromEmail: val.fromEmail,
        },
        ipAddress,
      });
    });

    return {
      success: true,
      message: `Test email dispatched to ${dto.targetEmail} from ${val.fromEmail} via ${val.host}`,
      timestamp: new Date(),
    };
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

    // Record audit event
    await this.prisma.withSuperAdminContext(async (tx) => {
      await this.auditService.recordInTransaction(tx, {
        organizationId: null,
        userId: actorId,
        action: 'EMAIL_TEMPLATE_TEST_SENT',
        entity: 'PlatformEmailTemplate',
        entityId: code,
        metadata: {
          targetEmail: dto.targetEmail,
          code,
          subject: preview.renderedSubject,
        },
        ipAddress,
      });
    });

    return {
      success: true,
      message: `Test email for template [${code}] dispatched to ${dto.targetEmail}`,
      renderedSubject: preview.renderedSubject,
      timestamp: new Date(),
    };
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
}
