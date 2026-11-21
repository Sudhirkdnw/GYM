"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import {
  MessageSquare,
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
  Copy,
  Check,
  X,
  ExternalLink,
} from "lucide-react";

interface WhatsAppConfigForm {
  metaAppId: string;
  wabaId: string;
  phoneNumberId: string;
  accessToken?: string;
  webhookVerifyToken?: string;
  apiVersion?: string;
  lastTestedAt?: string | null;
  testStatus?: "SUCCESS" | "FAILED" | "UNTESTED";
  testMessage?: string | null;
  isConfigured?: boolean;
}

export default function WhatsAppSettingsPage() {
  const [formData, setFormData] = useState<WhatsAppConfigForm>({
    metaAppId: "",
    wabaId: "",
    phoneNumberId: "",
    accessToken: "",
    webhookVerifyToken: "gymos_meta_webhook_secret_2026",
    apiVersion: "v21.0",
    lastTestedAt: null,
    testStatus: "UNTESTED",
    testMessage: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [customMessage, setCustomMessage] = useState(
    "Hello from GymOS Platform Super Admin! This is a test message confirming your Meta WhatsApp Cloud API integration.",
  );
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const webhookCallbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/v1/platform/settings/whatsapp/webhook`
      : "https://gymos.com/api/v1/platform/settings/whatsapp/webhook";

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient<WhatsAppConfigForm>("/platform/settings/whatsapp");
      setFormData(res);
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to load WhatsApp configuration",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleChange = (field: keyof WhatsAppConfigForm, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookCallbackUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setStatusMessage(null);

      await apiClient("/platform/settings/whatsapp", {
        method: "PUT",
        body: JSON.stringify(formData),
      });

      setStatusMessage({
        type: "success",
        text: "WhatsApp Cloud API credentials encrypted and saved successfully!",
      });

      await loadConfig();
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save WhatsApp configuration",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyConnection = async () => {
    try {
      setIsTesting(true);
      setStatusMessage(null);

      const res = await apiClient<{
        success: boolean;
        status: string;
        message: string;
        testedAt: string;
      }>("/platform/settings/whatsapp/test-connection", {
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
        text: err instanceof Error ? err.message : "Meta API verification failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhoneNumber.trim()) return;

    try {
      setIsSendingMessage(true);
      setStatusMessage(null);

      const res = await apiClient<{ success: boolean; message: string }>(
        "/platform/settings/whatsapp/test-send",
        {
          method: "POST",
          body: JSON.stringify({
            testPhoneNumber: testPhoneNumber.trim(),
            message: customMessage.trim(),
          }),
        },
      );

      setStatusMessage({
        type: "success",
        text: res.message,
      });
      setIsMessageModalOpen(false);
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to send WhatsApp message",
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/[0.08] pb-6">
        <div>
          <Link
            href="/platform/settings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Settings Hub</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Meta WhatsApp Cloud API
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Official Cloud API credentials, automated webhook callbacks, and connection verification.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleVerifyConnection}
            disabled={isTesting || isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#12131a] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-700 dark:text-zinc-300 transition-colors shadow-sm disabled:opacity-50"
          >
            <PlugZap className={`w-3.5 h-3.5 ${isTesting ? "animate-pulse text-amber-500" : ""}`} />
            <span>{isTesting ? "Verifying..." : "Verify Connection"}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsMessageModalOpen(true)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Test Message</span>
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
                Meta Cloud API Status:{" "}
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
              {formData.phoneNumberId ? `Phone ID: ${formData.phoneNumberId}` : "No Phone ID"}
            </span>
          </div>
        </div>

        {formData.testMessage && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0b0c12] border border-slate-200 dark:border-white/[0.06] text-xs font-mono text-slate-700 dark:text-zinc-300">
            {formData.testMessage}
          </div>
        )}
      </div>

      {/* Webhook Helper Banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#12131a] p-5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            Meta Webhook Callback URL
          </span>
          <a
            href="https://developers.facebook.com/apps"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
          >
            <span>Meta Developer Portal</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          In your Meta App Dashboard under WhatsApp &gt; Configuration, set this Callback URL and your Verify Token:
        </p>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            readOnly
            value={webhookCallbackUrl}
            className="flex-1 px-3 py-1.5 rounded-xl text-xs font-mono border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#0b0c12] text-slate-700 dark:text-zinc-300 select-all"
          />
          <button
            type="button"
            onClick={handleCopyWebhook}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#1b1d28] border border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-zinc-300 hover:bg-slate-100"
          >
            {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedWebhook ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Meta Graph API Credentials</span>
            </h3>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              AES-256-GCM Encrypted
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Meta App ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.metaAppId}
                onChange={(e) => handleChange("metaAppId", e.target.value)}
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
                value={formData.wabaId}
                onChange={(e) => handleChange("wabaId", e.target.value)}
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
                value={formData.phoneNumberId}
                onChange={(e) => handleChange("phoneNumberId", e.target.value)}
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
                value={formData.apiVersion || "v21.0"}
                onChange={(e) => handleChange("apiVersion", e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                placeholder="v21.0"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
              <span>Permanent System User Access Token</span>
              {formData.accessToken === "••••••••" && (
                <span className="text-[10px] text-emerald-500 font-normal">
                  (Encrypted on server)
                </span>
              )}
            </label>
            <input
              type="password"
              value={formData.accessToken}
              onChange={(e) => handleChange("accessToken", e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              placeholder="Leave blank to keep current access token"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Webhook Verify Token
            </label>
            <input
              type="text"
              value={formData.webhookVerifyToken || ""}
              onChange={(e) => handleChange("webhookVerifyToken", e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              placeholder="Secret token set in Meta Developer App"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Saving..." : "Save WhatsApp Configuration"}</span>
          </button>
        </div>
      </form>

      {/* Modal: Send Test WhatsApp Message */}
      {isMessageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#12131a] border border-slate-200 dark:border-white/[0.1] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Send Test WhatsApp Message
                </h3>
              </div>
              <button
                onClick={() => setIsMessageModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Enter an authorized recipient phone number (including country code, e.g. <code>+919876543210</code> or <code>919876543210</code>) to verify message delivery.
            </p>

            <form onSubmit={handleSendMessage} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Recipient Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  placeholder="+919876543210"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Message Body
                </label>
                <textarea
                  rows={3}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMessageModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingMessage}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingMessage ? "Sending..." : "Dispatch Message"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
