"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import {
  Mail,
  ArrowLeft,
  Save,
  Send,
  PlugZap,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  Server,
  Lock,
  RefreshCw,
  X,
} from "lucide-react";

interface SmtpConfigForm {
  host: string;
  port: number;
  username: string;
  password?: string;
  tlsMode: "STARTTLS" | "SSL_TLS" | "NONE";
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
  lastTestedAt?: string | null;
  testStatus?: "SUCCESS" | "FAILED" | "UNTESTED";
  testMessage?: string | null;
  isConfigured?: boolean;
}

export default function SmtpSettingsPage() {
  const [formData, setFormData] = useState<SmtpConfigForm>({
    host: "",
    port: 587,
    username: "",
    password: "",
    tlsMode: "STARTTLS",
    fromName: "GymOS Platform",
    fromEmail: "noreply@gymos.com",
    replyToEmail: "support@gymos.com",
    lastTestedAt: null,
    testStatus: "UNTESTED",
    testMessage: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingSocket, setIsTestingSocket] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [targetTestEmail, setTargetTestEmail] = useState("");

  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient<SmtpConfigForm>("/platform/settings/email");
      setFormData(res);
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to load SMTP configuration",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleChange = (field: keyof SmtpConfigForm, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setStatusMessage(null);

      await apiClient("/platform/settings/email", {
        method: "PUT",
        body: JSON.stringify({
          ...formData,
          port: Number(formData.port),
        }),
      });

      setStatusMessage({
        type: "success",
        text: "SMTP configuration and encrypted password saved successfully!",
      });

      await loadConfig();
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save SMTP configuration",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setIsTestingSocket(true);
      setStatusMessage(null);

      const res = await apiClient<{
        success: boolean;
        status: string;
        message: string;
        testedAt: string;
      }>("/platform/settings/email/test-connection", {
        method: "POST",
      });

      setStatusMessage({
        type: res.success ? "success" : "error",
        text: res.message,
      });

      await loadConfig();
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "SMTP connection test failed",
      });
    } finally {
      setIsTestingSocket(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTestEmail.trim()) return;

    try {
      setIsSendingTest(true);
      setStatusMessage(null);

      const res = await apiClient<{ success: boolean; message: string }>(
        "/platform/settings/email/test-send",
        {
          method: "POST",
          body: JSON.stringify({ targetEmail: targetTestEmail.trim() }),
        },
      );

      setStatusMessage({
        type: "success",
        text: res.message,
      });
      setIsTestModalOpen(false);
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to dispatch test email",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/[0.08] pb-6">
        <div>
          <Link
            href="/platform/settings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Settings Hub</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Email & SMTP Configuration
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Configure outgoing platform SMTP host, TLS modes, credentials, and verification tests.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTestingSocket || isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#12131a] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-700 dark:text-zinc-300 transition-colors shadow-sm disabled:opacity-50"
          >
            <PlugZap className={`w-3.5 h-3.5 ${isTestingSocket ? "animate-pulse text-amber-500" : ""}`} />
            <span>{isTestingSocket ? "Testing Socket..." : "Test Connection"}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsTestModalOpen(true)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Test Email</span>
          </button>
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

      {/* Live Status Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                SMTP Server Status:{" "}
                <span
                  className={
                    formData.testStatus === "SUCCESS"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : formData.testStatus === "FAILED"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-amber-600 dark:text-amber-400"
                  }
                >
                  {formData.testStatus || "UNTESTED"}
                </span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                {formData.lastTestedAt
                  ? `Last verified at: ${new Date(formData.lastTestedAt).toLocaleString()}`
                  : "No verification test performed yet"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
              {formData.host ? `${formData.host}:${formData.port}` : "No host"}
            </span>
          </div>
        </div>

        {formData.testMessage && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0b0c12] border border-slate-200 dark:border-white/[0.06] text-xs font-mono text-slate-700 dark:text-zinc-300">
            {formData.testMessage}
          </div>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Server & Credentials</span>
            </h3>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              AES-256-GCM Encrypted
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                SMTP Host <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.host}
                onChange={(e) => handleChange("host", e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="smtp.gmail.com / smtp.mailgun.org"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                SMTP Port <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                max={65535}
                value={formData.port}
                onChange={(e) => handleChange("port", e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="587"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                SMTP Username / API Key <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => handleChange("username", e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="apikey / your-email@domain.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                <span>SMTP Password / Secret</span>
                {formData.password === "••••••••" && (
                  <span className="text-[10px] text-emerald-500 font-normal">
                    (Encrypted on server)
                  </span>
                )}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Leave blank to keep existing password"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              TLS / Security Mode
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(["STARTTLS", "SSL_TLS", "NONE"] as const).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => handleChange("tlsMode", mode)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                    formData.tlsMode === mode
                      ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
                      : "border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                  }`}
                >
                  {mode === "STARTTLS"
                    ? "STARTTLS (Port 587)"
                    : mode === "SSL_TLS"
                    ? "SSL / TLS (Port 465)"
                    : "Plaintext (No TLS)"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sender Identity */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 sm:p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-white/[0.06]">
            Sender Identity & Routing
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                From Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.fromName}
                onChange={(e) => handleChange("fromName", e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="GymOS Platform"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                From Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.fromEmail}
                onChange={(e) => handleChange("fromEmail", e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="noreply@gymos.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Reply-To Email Address
              </label>
              <input
                type="email"
                value={formData.replyToEmail || ""}
                onChange={(e) => handleChange("replyToEmail", e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="support@gymos.com"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Saving..." : "Save SMTP Configuration"}</span>
          </button>
        </div>
      </form>

      {/* Modal: Send Test Email */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#12131a] border border-slate-200 dark:border-white/[0.1] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Send Verification Test Email
                </h3>
              </div>
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Enter an email address to receive a live verification email from your configured SMTP server ({formData.host || "host"}).
            </p>

            <form onSubmit={handleSendTestEmail} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  required
                  value={targetTestEmail}
                  onChange={(e) => setTargetTestEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="admin@yourgym.com"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingTest}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingTest ? "Sending..." : "Dispatch Test"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
