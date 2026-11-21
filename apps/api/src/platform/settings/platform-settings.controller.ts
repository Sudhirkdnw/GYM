import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  Ip,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedUserContext } from '@gymos/shared-types';
import { PlatformSettingsService } from './platform-settings.service';
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
import { Response } from 'express';

@ApiTags('Platform Super Admin Settings')
@Controller('platform')
export class PlatformSettingsController {
  constructor(private readonly settingsService: PlatformSettingsService) {}

  // =========================================================================
  // PUBLIC UNPROTECTED ENDPOINTS
  // =========================================================================

  @Get('public/branding')
  @ApiOperation({ summary: 'Get safe public website branding configuration' })
  async getPublicBranding() {
    return this.settingsService.getBranding(true);
  }

  @Get('settings/whatsapp/webhook')
  @ApiOperation({ summary: 'Meta WhatsApp Cloud API Webhook Verification' })
  async verifyWhatsAppWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.settingsService.handleWhatsAppWebhookVerify(mode, token, challenge);
      return res.status(200).send(result);
    } catch {
      return res.status(403).send('Verification failed');
    }
  }

  @Post('settings/whatsapp/webhook')
  @ApiOperation({ summary: 'Meta WhatsApp Cloud API Webhook Event Receiver' })
  async handleWhatsAppWebhookEvent(@Body() _payload: any, @Res() res: Response) {
    // Acknowledge receipt to Meta immediately within 200 OK
    return res.status(200).json({ status: 'EVENT_RECEIVED' });
  }

  // =========================================================================
  // SUPER ADMIN PROTECTED ENDPOINTS
  // =========================================================================

  @Get('settings/overview')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Get overall status and connection health of platform services' })
  async getOverview() {
    return this.settingsService.getSettingsOverview();
  }

  // --- WEBSITE BRANDING ---
  @Get('settings/website')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Get full website branding configuration' })
  async getBranding() {
    return this.settingsService.getBranding(false);
  }

  @Put('settings/website')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Update website branding configuration' })
  async updateBranding(
    @Body() dto: WebsiteBrandingDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.settingsService.updateBranding(dto, user.id, ipAddress, userAgent);
  }

  // --- SMTP CONFIGURATION ---
  @Get('settings/email')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Get SMTP email configuration (secret masked)' })
  async getSmtpConfig() {
    return this.settingsService.getSmtpConfig();
  }

  @Put('settings/email')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Update SMTP configuration with encrypted password' })
  async updateSmtpConfig(
    @Body() dto: SmtpConfigDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.settingsService.updateSmtpConfig(dto, user.id, ipAddress, userAgent);
  }

  @Post('settings/email/test-connection')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Test socket connection to configured SMTP server' })
  async testSmtpConnection(
    @CurrentUser() user: AuthenticatedUserContext,
    @Ip() ipAddress: string,
  ) {
    return this.settingsService.testSmtpConnection(user.id, ipAddress);
  }

  @Post('settings/email/test-send')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Send verification test email' })
  async sendTestEmail(
    @Body() dto: TestSmtpDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Ip() ipAddress: string,
  ) {
    return this.settingsService.sendTestEmail(dto, user.id, ipAddress);
  }

  // --- WHATSAPP CLOUD API ---
  @Get('settings/whatsapp')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Get WhatsApp Cloud API configuration (secret masked)' })
  async getWhatsAppConfig() {
    return this.settingsService.getWhatsAppConfig();
  }

  @Put('settings/whatsapp')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Update WhatsApp Cloud API configuration with encrypted token' })
  async updateWhatsAppConfig(
    @Body() dto: WhatsAppConfigDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.settingsService.updateWhatsAppConfig(dto, user.id, ipAddress, userAgent);
  }

  @Post('settings/whatsapp/test-connection')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Verify Meta Graph API connection and Phone Number ID' })
  async verifyWhatsAppConnection(
    @CurrentUser() user: AuthenticatedUserContext,
    @Ip() ipAddress: string,
  ) {
    return this.settingsService.verifyWhatsAppConnection(user.id, ipAddress);
  }

  @Post('settings/whatsapp/test-send')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Send test WhatsApp message to authorized phone number' })
  async sendTestWhatsAppMessage(
    @Body() dto: TestWhatsAppDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Ip() ipAddress: string,
  ) {
    return this.settingsService.sendTestWhatsAppMessage(dto, user.id, ipAddress);
  }

  // --- EMAIL TEMPLATES ---
  @Get('settings/email-templates')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'List platform email templates' })
  async getEmailTemplates(
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.settingsService.getEmailTemplates(category, search);
  }

  @Get('settings/email-templates/:code')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Get specific email template by code' })
  async getEmailTemplateByCode(@Param('code') code: string) {
    return this.settingsService.getEmailTemplateByCode(code);
  }

  @Put('settings/email-templates/:code')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Update email template subject and HTML body' })
  async updateEmailTemplate(
    @Param('code') code: string,
    @Body() dto: EmailTemplateUpdateDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.settingsService.updateEmailTemplate(code, dto, user.id, ipAddress, userAgent);
  }

  @Post('settings/email-templates/:code/preview')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Render live preview of email template with variables' })
  async renderTemplatePreview(
    @Param('code') code: string,
    @Body() body: { sampleVariables?: Record<string, string> },
  ) {
    return this.settingsService.renderTemplatePreview(code, body?.sampleVariables);
  }

  @Post('settings/email-templates/:code/test-send')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Send rendered email template to target email' })
  async sendTestTemplateEmail(
    @Param('code') code: string,
    @Body() dto: TestEmailTemplateDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Ip() ipAddress: string,
  ) {
    return this.settingsService.sendTestTemplateEmail(code, dto, user.id, ipAddress);
  }

  // --- AUDIT LOGS ---
  @Get('settings/audit-logs')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Query platform audit logs' })
  async getPlatformAuditLogs(@Query() query: AuditLogQueryDto) {
    return this.settingsService.getPlatformAuditLogs(query);
  }
}
