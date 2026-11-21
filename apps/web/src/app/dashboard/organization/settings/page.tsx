"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import {
  Sliders,
  ArrowLeft,
  Save,
  Mail,
  MessageSquare,
  Bell,
  Building,
  CheckCircle2,
  XCircle,
  AlertCircle,
  PlugZap,
  Send,
  Lock,
  Server,
  ShieldCheck,
  Check,
  RotateCcw,
  Sparkles,
  X,
  ExternalLink,
} from "lucide-react";

interface GeneralForm {
  timezone: string;
  currency: string;
  taxId: string;
  invoicePrefix: string;
  receiptFooterNote: string;
  receptionPhone: string;
  receptionEmail: string;
}

interface SmtpForm {
  provider: "PLATFORM_DEFAULT" | "CUSTOM_SMTP";
  host: string;
  port: number;
  username: string;
  password?: string;
  tlsMode: "STARTTLS" | "SSL_TLS" | "NONE";
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  lastTestedAt?: string | null;
  testStatus?: "SUCCESS" | "FAILED" | "UNTESTED";
  testMessage?: string | null;
}

interface WhatsAppForm {
  provider: "PLATFORM_DEFAULT" | "CUSTOM_WHATSAPP";
  metaAppId: string;
  wabaId: string;
  phoneNumberId: string;
  accessToken?: string;
  webhookVerifyToken: string;
  apiVersion: string;
  lastTestedAt?: string | null;
  testStatus?: "SUCCESS" | "FAILED" | "UNTESTED";
  testMessage?: string | null;
}

interface NotificationsForm {
  emailWelcomeMember: boolean;
  emailPaymentReceipt: boolean;
  emailMembershipExpiry: boolean;
  emailDueReminder: boolean;
  whatsappWelcomeMember: boolean;
  whatsappPaymentReceipt: boolean;
  whatsappMembershipExpiry: boolean;
  whatsappDueReminder: boolean;
  whatsappAttendanceCheckin: boolean;
}

export default function GymOrganizationSettingsPage() {
  const { organization, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"general" | "email" | "whatsapp" | "notifications">("general");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // General Form
  const [generalData, setGeneralData] = useState<GeneralForm>({
    timezone: "Asia/Kolkata",
    currency: "INR",
    taxId: "",
    invoicePrefix: "INV",
    receiptFooterNote: "Thank you for training with us!",
    receptionPhone: "",
    receptionEmail: "",
  });

  // SMTP Form
  const [smtpData, setSmtpData] = useState<SmtpForm>({
    provider: "PLATFORM_DEFAULT",
    host: "",
    port: 587,
    username: "",
    password: "",
    tlsMode: "STARTTLS",
    fromName: "",
    fromEmail: "",
    replyToEmail: "",
    lastTestedAt: null,
    testStatus: "UNTESTED",
    testMessage: null,
  });

  // WhatsApp Form
  const [whatsappData, setWhatsappData] = useState<WhatsAppForm>({
    provider: "PLATFORM_DEFAULT",
    metaAppId: "",
    wabaId: "",
    phoneNumberId: "",
    accessToken: "",
    webhookVerifyToken: "gymos_custom_verify_token",
    apiVersion: "v21.0",
    lastTestedAt: null,
    testStatus: "UNTESTED",
    testMessage: null,
  });

  // Notifications Form
  const [notificationsData, setNotificationsData] = useState<NotificationsForm>({
    emailWelcomeMember: true,
    emailPaymentReceipt: true,
    emailMembershipExpiry: true,
    emailDueReminder: true,
    whatsappWelcomeMember: true,
    whatsappPaymentReceipt: true,
    whatsappMembershipExpiry: true,
    whatsappDueReminder: true,
    whatsappAttendanceCheckin: false,
  });

  // Testing & Modals
  const [isTestingSocket, setIsTestingSocket] = useState(false);
  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);
  const [isTestEmailModalOpen, setIsTestEmailModalOpen] = useState(false);
  const [isTestWhatsAppModalOpen, setIsTestWhatsAppModalOpen] = useState(false);
  const [targetTestEmail, setTargetTestEmail] = useState("");
  const [targetTestPhone, setTargetTestPhone] = useState("");
  const [isDispatchingTest, setIsDispatchingTest] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadAllSettings = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient<{
        organization: any;
        general: GeneralForm;
        smtp: SmtpForm;
        whatsapp: WhatsAppForm;
        notifications: NotificationsForm;
      }>("/organizations/current/settings/overview");

      if (res.general) setGeneralData(res.general);
      if (res.smtp) setSmtpData(res.smtp);
      if (res.whatsapp) setWhatsappData(res.whatsapp);
      if (res.notifications) setNotificationsData(res.notifications);
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to load gym settings",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (organization) {
      loadAllSettings();
    }
  }, [authLoading, isAuthenticated, organization]);

  // --- SAVE HANDLERS ---
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setStatusMessage(null);

      await apiClient("/organizations/current/settings/general", {
        method: "PATCH",
        body: JSON.stringify(generalData),
      });

      setStatusMessage({
        type: "success",
        text: "General gym configuration saved successfully!",
      });
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save general settings",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setStatusMessage(null);

      await apiClient("/organizations/current/settings/email", {
        method: "PATCH",
        body: JSON.stringify({
          ...smtpData,
          port: Number(smtpData.port),
        }),
      });

      setStatusMessage({
        type: "success",
        text: "Gym SMTP configuration saved and encrypted successfully!",
      });

      await loadAllSettings();
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save SMTP configuration",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setStatusMessage(null);

      await apiClient("/organizations/current/settings/whatsapp", {
        method: "PATCH",
        body: JSON.stringify(whatsappData),
      });

      setStatusMessage({
        type: "success",
        text: "Gym WhatsApp Cloud API credentials encrypted and saved successfully!",
      });

      await loadAllSettings();
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save WhatsApp configuration",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setStatusMessage(null);

      await apiClient("/organizations/current/settings/notifications", {
        method: "PATCH",
        body: JSON.stringify(notificationsData),
      });

      setStatusMessage({
        type: "success",
        text: "Automated communication trigger rules updated successfully!",
      });
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save notification rules",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // --- TEST HANDLERS ---
  const handleTestSmtpSocket = async () => {
    try {
      setIsTestingSocket(true);
      setStatusMessage(null);

      const res = await apiClient<{ success: boolean; message: string }>(
        "/organizations/current/settings/email/test-connection",
        { method: "POST" },
      );

      setStatusMessage({
        type: res.success ? "success" : "error",
        text: res.message,
      });

      await loadAllSettings();
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "SMTP socket test failed",
      });
    } finally {
      setIsTestingSocket(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTestEmail.trim()) return;

    try {
      setIsDispatchingTest(true);
      setStatusMessage(null);

      const res = await apiClient<{ success: boolean; message: string }>(
        "/organizations/current/settings/email/test-send",
        {
          method: "POST",
          body: JSON.stringify({ targetEmail: targetTestEmail.trim() }),
        },
      );

      setStatusMessage({
        type: "success",
        text: res.message,
      });
      setIsTestEmailModalOpen(false);
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to send test email",
      });
    } finally {
      setIsDispatchingTest(false);
    }
  };

  const handleVerifyWhatsApp = async () => {
    try {
      setIsTestingWhatsApp(true);
      setStatusMessage(null);

      const res = await apiClient<{ success: boolean; message: string }>(
        "/organizations/current/settings/whatsapp/test-connection",
        { method: "POST" },
      );

      setStatusMessage({
        type: res.success ? "success" : "error",
        text: res.message,
      });

      await loadAllSettings();
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Meta API verification failed",
      });
    } finally {
      setIsTestingWhatsApp(false);
    }
  };

  const handleSendTestWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTestPhone.trim()) return;

    try {
      setIsDispatchingTest(true);
      setStatusMessage(null);

      const res = await apiClient<{ success: boolean; message: string }>(
        "/organizations/current/settings/whatsapp/test-send",
        {
          method: "POST",
          body: JSON.stringify({
            testPhoneNumber: targetTestPhone.trim(),
            message: `Hello from ${organization?.name || "GymOS"}! This test message confirms custom WhatsApp messaging.`,
          }),
        },
      );

      setStatusMessage({
        type: "success",
        text: res.message,
      });
      setIsTestWhatsAppModalOpen(false);
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to send test message",
      });
    } finally {
      setIsDispatchingTest(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/[0.08] pb-6">
        <div>
          <Link
            href="/dashboard/organization"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Organization Profile</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Gym Settings & Integrations
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Personal configuration for <strong>{organization?.name || "Your Gym"}</strong>: custom SMTP, Meta WhatsApp Cloud API, billing defaults, and alerts.
              </p>
            </div>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-2.5 ${
            statusMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-white/[0.08] overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === "general"
              ? "border-violet-600 text-violet-600 dark:border-violet-400 dark:text-violet-400"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Building className="w-4 h-4" />
          <span>General & Billing</span>
        </button>

        <button
          onClick={() => setActiveTab("email")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === "email"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Email & Custom SMTP</span>
        </button>

        <button
          onClick={() => setActiveTab("whatsapp")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === "whatsapp"
              ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Meta WhatsApp Cloud API</span>
        </button>

        <button
          onClick={() => setActiveTab("notifications")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === "notifications"
              ? "border-amber-600 text-amber-600 dark:border-amber-400 dark:text-amber-400"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Automated Triggers</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: GENERAL & BILLING DEFAULTS */}
      {/* ========================================================================= */}
      {activeTab === "general" && (
        <form onSubmit={handleSaveGeneral} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 sm:p-6 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              Operating Locale & Fiscal Configuration
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Operating Currency
                </label>
                <select
                  value={generalData.currency}
                  onChange={(e) => setGeneralData({ ...generalData, currency: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="INR">INR (₹) — Indian Rupee</option>
                  <option value="USD">USD ($) — US Dollar</option>
                  <option value="EUR">EUR (€) — Euro</option>
                  <option value="GBP">GBP (£) — British Pound</option>
                  <option value="AED">AED (د.إ) — UAE Dirham</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Operating Timezone
                </label>
                <select
                  value={generalData.timezone}
                  onChange={(e) => setGeneralData({ ...generalData, timezone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Tax Registration / GSTIN Number
                </label>
                <input
                  type="text"
                  value={generalData.taxId}
                  onChange={(e) => setGeneralData({ ...generalData, taxId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono uppercase"
                  placeholder="e.g. 29AAAAA0000A1Z5"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Invoice Sequence Prefix
                </label>
                <input
                  type="text"
                  value={generalData.invoicePrefix}
                  onChange={(e) => setGeneralData({ ...generalData, invoicePrefix: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono uppercase"
                  placeholder="e.g. INV-ALPHA"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Reception Helpline Phone
                </label>
                <input
                  type="text"
                  value={generalData.receptionPhone}
                  onChange={(e) => setGeneralData({ ...generalData, receptionPhone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Reception Support Email
                </label>
                <input
                  type="email"
                  value={generalData.receptionEmail}
                  onChange={(e) => setGeneralData({ ...generalData, receptionEmail: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="frontdesk@yourgym.com"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Receipt / Invoice Footer Note
              </label>
              <textarea
                rows={2}
                value={generalData.receiptFooterNote}
                onChange={(e) => setGeneralData({ ...generalData, receiptFooterNote: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Message printed on member invoices and receipts"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Saving..." : "Save General Settings"}</span>
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EMAIL & CUSTOM SMTP */}
      {/* ========================================================================= */}
      {activeTab === "email" && (
        <form onSubmit={handleSaveSmtp} className="space-y-6">
          {/* Provider Selection Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Outgoing Email Provider</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Choose whether your gym dispatches emails via GymOS platform mailer or your own business SMTP.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Status:{" "}
                <span className={smtpData.testStatus === "SUCCESS" ? "text-emerald-500" : "text-amber-500"}>
                  {smtpData.provider === "PLATFORM_DEFAULT" ? "Platform Managed" : smtpData.testStatus || "UNTESTED"}
                </span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label
                onClick={() => setSmtpData({ ...smtpData, provider: "PLATFORM_DEFAULT" })}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  smtpData.provider === "PLATFORM_DEFAULT"
                    ? "border-blue-600 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/20"
                    : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    Platform Managed SMTP
                  </span>
                  {smtpData.provider === "PLATFORM_DEFAULT" && (
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                  Zero setup required. Deliver member receipts and welcome emails through high-deliverability GymOS platform infrastructure.
                </p>
              </label>

              <label
                onClick={() => setSmtpData({ ...smtpData, provider: "CUSTOM_SMTP" })}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  smtpData.provider === "CUSTOM_SMTP"
                    ? "border-blue-600 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/20"
                    : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    Custom Gym SMTP Server
                  </span>
                  {smtpData.provider === "CUSTOM_SMTP" && (
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                  Deliver emails from your own domain (e.g. <code>@yourgym.com</code>) via Google Workspace, SendGrid, or custom mail server.
                </p>
              </label>
            </div>
          </div>

          {/* Custom SMTP Credentials (Visible when CUSTOM_SMTP is selected) */}
          {smtpData.provider === "CUSTOM_SMTP" && (
            <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Custom SMTP Server Details</span>
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestSmtpSocket}
                    disabled={isTestingSocket}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-700 dark:text-zinc-300 hover:bg-slate-100"
                  >
                    <PlugZap className={`w-3.5 h-3.5 ${isTestingSocket ? "animate-pulse text-amber-500" : ""}`} />
                    <span>{isTestingSocket ? "Testing..." : "Test Connection"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTestEmailModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900 hover:bg-blue-100"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Test Email</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    SMTP Host <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={smtpData.host}
                    onChange={(e) => setSmtpData({ ...smtpData, host: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="smtp.gmail.com / smtp.office365.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    SMTP Port <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={smtpData.port}
                    onChange={(e) => setSmtpData({ ...smtpData, port: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="587"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    SMTP Username / Login Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={smtpData.username}
                    onChange={(e) => setSmtpData({ ...smtpData, username: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="notifications@yourgym.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                    <span>SMTP Password / App Password</span>
                    {smtpData.password === "••••••••" && (
                      <span className="text-[10px] text-emerald-500 font-normal">
                        (AES-256-GCM Encrypted)
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={smtpData.password || ""}
                    onChange={(e) => setSmtpData({ ...smtpData, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Leave blank to preserve existing password"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    From Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={smtpData.fromName}
                    onChange={(e) => setSmtpData({ ...smtpData, fromName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Iron Pulse Fitness"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    From Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={smtpData.fromEmail}
                    onChange={(e) => setSmtpData({ ...smtpData, fromEmail: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="info@yourgym.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Reply-To Email
                  </label>
                  <input
                    type="email"
                    value={smtpData.replyToEmail}
                    onChange={(e) => setSmtpData({ ...smtpData, replyToEmail: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="help@yourgym.com"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Saving..." : "Save Email Settings"}</span>
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: WHATSAPP CLOUD API */}
      {/* ========================================================================= */}
      {activeTab === "whatsapp" && (
        <form onSubmit={handleSaveWhatsApp} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>WhatsApp Cloud API Service</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Choose between GymOS managed WhatsApp dispatch or your gym's official Meta Business Account.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Status:{" "}
                <span className={whatsappData.testStatus === "SUCCESS" ? "text-emerald-500" : "text-amber-500"}>
                  {whatsappData.provider === "PLATFORM_DEFAULT" ? "Platform Managed" : whatsappData.testStatus || "UNTESTED"}
                </span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label
                onClick={() => setWhatsappData({ ...whatsappData, provider: "PLATFORM_DEFAULT" })}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  whatsappData.provider === "PLATFORM_DEFAULT"
                    ? "border-emerald-600 bg-emerald-50/50 dark:border-emerald-500 dark:bg-emerald-950/20"
                    : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    Platform Managed WhatsApp
                  </span>
                  {whatsappData.provider === "PLATFORM_DEFAULT" && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                  Automated notifications are sent via GymOS shared WhatsApp router with automated template management.
                </p>
              </label>

              <label
                onClick={() => setWhatsappData({ ...whatsappData, provider: "CUSTOM_WHATSAPP" })}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  whatsappData.provider === "CUSTOM_WHATSAPP"
                    ? "border-emerald-600 bg-emerald-50/50 dark:border-emerald-500 dark:bg-emerald-950/20"
                    : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    Custom Meta Cloud API
                  </span>
                  {whatsappData.provider === "CUSTOM_WHATSAPP" && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                  Connect your gym's official verified phone number and Meta Business Account directly.
                </p>
              </label>
            </div>
          </div>

          {whatsappData.provider === "CUSTOM_WHATSAPP" && (
            <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Meta Business Credentials</span>
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleVerifyWhatsApp}
                    disabled={isTestingWhatsApp}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-700 dark:text-zinc-300 hover:bg-slate-100"
                  >
                    <PlugZap className={`w-3.5 h-3.5 ${isTestingWhatsApp ? "animate-pulse text-amber-500" : ""}`} />
                    <span>{isTestingWhatsApp ? "Verifying..." : "Verify Connection"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTestWhatsAppModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 hover:bg-emerald-100"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Test Message</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Meta App ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={whatsappData.metaAppId}
                    onChange={(e) => setWhatsappData({ ...whatsappData, metaAppId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    placeholder="e.g. 109283746592837"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    WhatsApp Business Account ID (WABA) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={whatsappData.wabaId}
                    onChange={(e) => setWhatsappData({ ...whatsappData, wabaId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    placeholder="e.g. 209384756281938"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Phone Number ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={whatsappData.phoneNumberId}
                    onChange={(e) => setWhatsappData({ ...whatsappData, phoneNumberId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    placeholder="e.g. 309485726192837"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    API Version
                  </label>
                  <input
                    type="text"
                    value={whatsappData.apiVersion}
                    onChange={(e) => setWhatsappData({ ...whatsappData, apiVersion: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    placeholder="v21.0"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                  <span>Permanent System User Access Token</span>
                  {whatsappData.accessToken === "••••••••" && (
                    <span className="text-[10px] text-emerald-500 font-normal">
                      (AES-256-GCM Encrypted)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={whatsappData.accessToken || ""}
                  onChange={(e) => setWhatsappData({ ...whatsappData, accessToken: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  placeholder="Leave blank to preserve current token"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Saving..." : "Save WhatsApp Settings"}</span>
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: AUTOMATED NOTIFICATION TRIGGERS */}
      {/* ========================================================================= */}
      {activeTab === "notifications" && (
        <form onSubmit={handleSaveNotifications} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 sm:p-6 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              Communication Rules & Event Dispatches
            </h3>

            {/* Email Triggers */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-500" />
                <span>Automated Email Notifications</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[#0b0c12] cursor-pointer">
                  <span>Welcome email on new member signup</span>
                  <input
                    type="checkbox"
                    checked={notificationsData.emailWelcomeMember}
                    onChange={(e) => setNotificationsData({ ...notificationsData, emailWelcomeMember: e.target.checked })}
                    className="w-4 h-4 rounded text-violet-600"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[#0b0c12] cursor-pointer">
                  <span>Invoice & payment confirmation receipts</span>
                  <input
                    type="checkbox"
                    checked={notificationsData.emailPaymentReceipt}
                    onChange={(e) => setNotificationsData({ ...notificationsData, emailPaymentReceipt: e.target.checked })}
                    className="w-4 h-4 rounded text-violet-600"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[#0b0c12] cursor-pointer">
                  <span>Membership expiry warnings (7 days prior)</span>
                  <input
                    type="checkbox"
                    checked={notificationsData.emailMembershipExpiry}
                    onChange={(e) => setNotificationsData({ ...notificationsData, emailMembershipExpiry: e.target.checked })}
                    className="w-4 h-4 rounded text-violet-600"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[#0b0c12] cursor-pointer">
                  <span>Fee due & past due reminders</span>
                  <input
                    type="checkbox"
                    checked={notificationsData.emailDueReminder}
                    onChange={(e) => setNotificationsData({ ...notificationsData, emailDueReminder: e.target.checked })}
                    className="w-4 h-4 rounded text-violet-600"
                  />
                </label>
              </div>
            </div>

            {/* WhatsApp Triggers */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                <span>Automated WhatsApp Alerts</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[#0b0c12] cursor-pointer">
                  <span>WhatsApp Welcome card with Member ID</span>
                  <input
                    type="checkbox"
                    checked={notificationsData.whatsappWelcomeMember}
                    onChange={(e) => setNotificationsData({ ...notificationsData, whatsappWelcomeMember: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[#0b0c12] cursor-pointer">
                  <span>Instant payment receipt on successful fee collection</span>
                  <input
                    type="checkbox"
                    checked={notificationsData.whatsappPaymentReceipt}
                    onChange={(e) => setNotificationsData({ ...notificationsData, whatsappPaymentReceipt: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[#0b0c12] cursor-pointer">
                  <span>WhatsApp Membership renewal alerts</span>
                  <input
                    type="checkbox"
                    checked={notificationsData.whatsappMembershipExpiry}
                    onChange={(e) => setNotificationsData({ ...notificationsData, whatsappMembershipExpiry: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[#0b0c12] cursor-pointer">
                  <span>Instant check-in confirmation ping (QR Scan)</span>
                  <input
                    type="checkbox"
                    checked={notificationsData.whatsappAttendanceCheckin}
                    onChange={(e) => setNotificationsData({ ...notificationsData, whatsappAttendanceCheckin: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Saving..." : "Save Notification Rules"}</span>
            </button>
          </div>
        </form>
      )}

      {/* Modal: Send Test Email */}
      {isTestEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#12131a] border border-slate-200 dark:border-white/[0.1] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Send Gym Test Email
                </h3>
              </div>
              <button
                onClick={() => setIsTestEmailModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendTestEmail} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Recipient Test Email
                </label>
                <input
                  type="email"
                  required
                  value={targetTestEmail}
                  onChange={(e) => setTargetTestEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="owner@yourgym.com"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTestEmailModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-zinc-300 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDispatchingTest}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isDispatchingTest ? "Sending..." : "Send Test"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Send Test WhatsApp */}
      {isTestWhatsAppModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#12131a] border border-slate-200 dark:border-white/[0.1] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Send Gym Test WhatsApp
                </h3>
              </div>
              <button
                onClick={() => setIsTestWhatsAppModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendTestWhatsApp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Recipient Phone Number (with Country Code)
                </label>
                <input
                  type="text"
                  required
                  value={targetTestPhone}
                  onChange={(e) => setTargetTestPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  placeholder="+919876543210"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTestWhatsAppModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-zinc-300 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDispatchingTest}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isDispatchingTest ? "Sending..." : "Send Test"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
