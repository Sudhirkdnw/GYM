"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import {
  Settings,
  Globe,
  Mail,
  MessageSquare,
  FileText,
  History,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Server,
  Zap,
} from "lucide-react";

interface SettingsOverviewResponse {
  website: {
    isConfigured: boolean;
    updatedAt: string | null;
  };
  smtp: {
    isConfigured: boolean;
    status: "SUCCESS" | "FAILED" | "UNTESTED";
    lastTestedAt: string | null;
    testMessage: string | null;
    fromEmail: string | null;
    host: string | null;
  };
  whatsapp: {
    isConfigured: boolean;
    status: "SUCCESS" | "FAILED" | "UNTESTED";
    lastTestedAt: string | null;
    testMessage: string | null;
    phoneNumberId: string | null;
  };
  templates: {
    totalCount: number;
  };
}

export default function PlatformSettingsOverviewPage() {
  const [data, setData] = useState<SettingsOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiClient<SettingsOverviewResponse>("/platform/settings/overview");
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load settings overview");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const getStatusBadge = (status?: string, isConfigured?: boolean) => {
    if (!isConfigured) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-zinc-400">
          <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
          Unconfigured
        </span>
      );
    }
    if (status === "SUCCESS") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          Connected & Verified
        </span>
      );
    }
    if (status === "FAILED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
          <XCircle className="w-3.5 h-3.5 text-rose-500" />
          Connection Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
        Configured (Untested)
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Settings className="w-4 h-4" />
            <span>Platform Operations Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Platform Settings Center
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Control platform-wide branding, transactional email delivery, Meta WhatsApp Cloud API, and security audit logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadOverview}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#12131a] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-700 dark:text-zinc-200 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh Health</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Security Architecture Banner */}
      <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-violet-600/10 via-indigo-600/10 to-transparent border border-violet-200 dark:border-violet-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-violet-600 text-white shrink-0 shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Enterprise Envelope Encryption Active
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5 leading-relaxed">
              All credentials (SMTP passwords, Meta WhatsApp access tokens) are sealed at rest using <strong>AES-256-GCM</strong> authenticated encryption. Plaintext secrets are never logged or exposed in API payloads.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0 self-start md:self-auto">
          <CheckCircle2 className="w-3.5 h-3.5" />
          RLS Enforced
        </span>
      </div>

      {/* Connection Health Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Website Branding Status */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400">
                <Globe className="w-5 h-5" />
              </div>
              {getStatusBadge("SUCCESS", data?.website.isConfigured)}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Website Branding
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Public logos, colors, and legal details
              </p>
            </div>
          </div>
          <Link
            href="/platform/settings/website"
            className="flex items-center justify-between text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline pt-2 border-t border-slate-100 dark:border-white/[0.05]"
          >
            <span>Configure Branding</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* SMTP Status */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                <Mail className="w-5 h-5" />
              </div>
              {getStatusBadge(data?.smtp.status, data?.smtp.isConfigured)}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                SMTP Email Delivery
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                {data?.smtp.fromEmail ? `From: ${data.smtp.fromEmail}` : "No sender configured"}
              </p>
            </div>
          </div>
          <Link
            href="/platform/settings/email"
            className="flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline pt-2 border-t border-slate-100 dark:border-white/[0.05]"
          >
            <span>Manage SMTP</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* WhatsApp Cloud API */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <MessageSquare className="w-5 h-5" />
              </div>
              {getStatusBadge(data?.whatsapp.status, data?.whatsapp.isConfigured)}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                WhatsApp Cloud API
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                {data?.whatsapp.phoneNumberId ? `Phone ID: ${data.whatsapp.phoneNumberId}` : "Not connected to Meta"}
              </p>
            </div>
          </div>
          <Link
            href="/platform/settings/whatsapp"
            className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline pt-2 border-t border-slate-100 dark:border-white/[0.05]"
          >
            <span>Connect Meta API</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Email Templates */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                <FileText className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
                {data?.templates.totalCount || 10} System Templates
              </span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Email Template Studio
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                HTML & plain-text with live variables
              </p>
            </div>
          </div>
          <Link
            href="/platform/settings/email-templates"
            className="flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline pt-2 border-t border-slate-100 dark:border-white/[0.05]"
          >
            <span>Customize Templates</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Configuration Modules
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Website Branding */}
          <Link
            href="/platform/settings/website"
            className="group rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-6 hover:border-violet-500/40 dark:hover:border-violet-500/40 transition-all hover:shadow-lg hover:shadow-violet-500/5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-violet-100 dark:bg-violet-600/20 text-violet-600 dark:text-violet-300">
                <Globe className="w-6 h-6" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-violet-500 transition-all" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Website & Brand Identity
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Configure platform logos, favicon, primary/secondary brand colors, legal entity, address, and live branding preview.
            </p>
          </Link>

          {/* Card 2: SMTP Configuration */}
          <Link
            href="/platform/settings/email"
            className="group rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-6 hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all hover:shadow-lg hover:shadow-blue-500/5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-300">
                <Mail className="w-6 h-6" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-blue-500 transition-all" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Email & SMTP Delivery
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Setup custom SMTP server (Gmail, SendGrid, Mailgun), TLS encryption modes, test connection socket, and send verification email.
            </p>
          </Link>

          {/* Card 3: WhatsApp Cloud API */}
          <Link
            href="/platform/settings/whatsapp"
            className="group rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-6 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all hover:shadow-lg hover:shadow-emerald-500/5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-300">
                <MessageSquare className="w-6 h-6" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-emerald-500 transition-all" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Meta WhatsApp Cloud API
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Official Meta Graph API integration with encrypted access tokens, webhook callbacks, connection tester, and test messaging.
            </p>
          </Link>

          {/* Card 4: Email Templates */}
          <Link
            href="/platform/settings/email-templates"
            className="group rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-6 hover:border-amber-500/40 dark:hover:border-amber-500/40 transition-all hover:shadow-lg hover:shadow-amber-500/5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-600/20 text-amber-600 dark:text-amber-300">
                <FileText className="w-6 h-6" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-amber-500 transition-all" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Email Template Studio
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Manage 10 initial system templates: Welcome, Verification OTP, Password Reset, Gym Confirmation, Payment receipts, and Expiry notices.
            </p>
          </Link>

          {/* Card 5: Platform Audit Logs */}
          <Link
            href="/platform/settings/audit-logs"
            className="group rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-6 hover:border-violet-500/40 dark:hover:border-violet-500/40 transition-all hover:shadow-lg hover:shadow-violet-500/5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-600/20 text-purple-600 dark:text-purple-300">
                <History className="w-6 h-6" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-purple-500 transition-all" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Platform Audit Logs
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Immutable append-only records of all Super Admin configuration changes, test events, IP addresses, and metadata diffs.
            </p>
          </Link>

          {/* Card 6: Email Delivery Logs */}
          <Link
            href="/platform/settings/email-logs"
            className="group rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-6 hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all hover:shadow-lg hover:shadow-blue-500/5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-300">
                <Send className="w-6 h-6" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 group-hover:text-blue-500 transition-all" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Email Delivery Logs
            </h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Real-time monitoring of all dispatched transactional emails, delivery statuses, SMTP error traces, and manual resend actions.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
