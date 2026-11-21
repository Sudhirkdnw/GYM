"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import {
  Globe,
  ArrowLeft,
  Save,
  RotateCcw,
  Upload,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sparkles,
  Palette,
  Building,
  Share2,
} from "lucide-react";

interface WebsiteBrandingForm {
  platformName: string;
  websiteName: string;
  tagline: string;
  companyLegalName: string;
  websiteUrl: string;
  companyAddress: string;
  contactEmail: string;
  contactPhone: string;
  lightLogoUrl: string;
  darkLogoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  socialLinks: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
  };
  footerCopyrightText: string;
}

export default function WebsiteSettingsPage() {
  const [formData, setFormData] = useState<WebsiteBrandingForm>({
    platformName: "GymOS Platform",
    websiteName: "GymOS — The Operating System for Modern Gyms",
    tagline: "Multi-branch operations, automated billing, and smart attendance.",
    companyLegalName: "GymOS Technologies Inc.",
    websiteUrl: "http://localhost:3000",
    companyAddress: "Bengaluru, Karnataka, India",
    contactEmail: "contact@gymos.com",
    contactPhone: "+91 98765 43210",
    lightLogoUrl: "",
    darkLogoUrl: "",
    faviconUrl: "",
    primaryColor: "#7c3aed",
    secondaryColor: "#4f46e5",
    accentColor: "#10b981",
    socialLinks: {
      facebook: "https://facebook.com/gymos",
      twitter: "https://twitter.com/gymos",
      instagram: "https://instagram.com/gymos",
      linkedin: "https://linkedin.com/company/gymos",
      youtube: "https://youtube.com/gymos",
    },
    footerCopyrightText: "© 2026 GymOS Platform Inc. All rights reserved.",
  });

  const [initialData, setInitialData] = useState<WebsiteBrandingForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadBranding = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient<WebsiteBrandingForm>("/platform/settings/website");
      setFormData(res);
      setInitialData(res);
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to load branding settings",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBranding();
  }, []);

  const handleChange = (field: keyof WebsiteBrandingForm, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSocialChange = (network: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        [network]: value,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setStatusMessage(null);

      await apiClient("/platform/settings/website", {
        method: "PUT",
        body: JSON.stringify(formData),
      });

      setInitialData(formData);
      setStatusMessage({
        type: "success",
        text: "Website branding configuration saved and propagated to public cache successfully!",
      });
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save branding settings",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (initialData) {
      setFormData(initialData);
      setStatusMessage(null);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/[0.08] pb-6">
        <div>
          <Link
            href="/platform/settings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Settings Hub</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Website Branding & Identity
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Configure platform name, public logos, color theme tokens, and company metadata.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={isSaving || isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#12131a] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-700 dark:text-zinc-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Saving..." : "Save Branding"}</span>
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

      {/* Main Grid: Form on Left, Live Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form: 7 cols */}
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
          {/* Section 1: General Brand Info */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Brand & Platform Info
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Platform Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.platformName}
                  onChange={(e) => handleChange("platformName", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="e.g. GymOS Platform"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Website Title / Slogan
                </label>
                <input
                  type="text"
                  value={formData.websiteName}
                  onChange={(e) => handleChange("websiteName", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="e.g. GymOS — The Operating System for Modern Gyms"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Tagline / Pitch
              </label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => handleChange("tagline", e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Brief description appearing on landing page hero"
              />
            </div>
          </div>

          {/* Section 2: Color Palette */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <Palette className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Brand Color Palette
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Primary Color */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Primary Brand Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.primaryColor || "#7c3aed"}
                    onChange={(e) => handleChange("primaryColor", e.target.value)}
                    className="w-9 h-9 rounded-lg cursor-pointer border border-slate-200 dark:border-white/[0.1] bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    value={formData.primaryColor}
                    onChange={(e) => handleChange("primaryColor", e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-mono border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 uppercase"
                  />
                </div>
              </div>

              {/* Secondary Color */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Secondary Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.secondaryColor || "#4f46e5"}
                    onChange={(e) => handleChange("secondaryColor", e.target.value)}
                    className="w-9 h-9 rounded-lg cursor-pointer border border-slate-200 dark:border-white/[0.1] bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    value={formData.secondaryColor}
                    onChange={(e) => handleChange("secondaryColor", e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-mono border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 uppercase"
                  />
                </div>
              </div>

              {/* Accent Color */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.accentColor || "#10b981"}
                    onChange={(e) => handleChange("accentColor", e.target.value)}
                    className="w-9 h-9 rounded-lg cursor-pointer border border-slate-200 dark:border-white/[0.1] bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    value={formData.accentColor}
                    onChange={(e) => handleChange("accentColor", e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-mono border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 uppercase"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Logos & Favicon URLs */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <Upload className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Logos & Favicon Assets
              </h3>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Light Theme Logo URL (Dark text/mark)
                </label>
                <input
                  type="text"
                  value={formData.lightLogoUrl}
                  onChange={(e) => handleChange("lightLogoUrl", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="https://your-domain.com/assets/logo-light.svg"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Dark Theme Logo URL (Light/white text/mark)
                </label>
                <input
                  type="text"
                  value={formData.darkLogoUrl}
                  onChange={(e) => handleChange("darkLogoUrl", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="https://your-domain.com/assets/logo-dark.svg"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Favicon URL (.ico, .png, or .svg)
                </label>
                <input
                  type="text"
                  value={formData.faviconUrl}
                  onChange={(e) => handleChange("faviconUrl", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="https://your-domain.com/favicon.ico"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Legal & Contact Details */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <Building className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Legal & Corporate Information
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Company Legal Entity Name
                </label>
                <input
                  type="text"
                  value={formData.companyLegalName}
                  onChange={(e) => handleChange("companyLegalName", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="e.g. GymOS Technologies Inc."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Official Website URL
                </label>
                <input
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) => handleChange("websiteUrl", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="https://gymos.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Contact Support Email
                </label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => handleChange("contactEmail", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="contact@gymos.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Contact Phone Number
                </label>
                <input
                  type="text"
                  value={formData.contactPhone}
                  onChange={(e) => handleChange("contactPhone", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Registered Physical Address
              </label>
              <textarea
                rows={2}
                value={formData.companyAddress}
                onChange={(e) => handleChange("companyAddress", e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Full address of company headquarters"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Footer Copyright Text
              </label>
              <input
                type="text"
                value={formData.footerCopyrightText}
                onChange={(e) => handleChange("footerCopyrightText", e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="© 2026 GymOS Platform Inc. All rights reserved."
              />
            </div>
          </div>

          {/* Section 5: Social Channels */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <Share2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Social Media Channels
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {["facebook", "twitter", "instagram", "linkedin", "youtube"].map((net) => (
                <div key={net} className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 capitalize">
                    {net === "twitter" ? "X / Twitter" : net}
                  </label>
                  <input
                    type="url"
                    value={(formData.socialLinks as any)?.[net] || ""}
                    onChange={(e) => handleSocialChange(net, e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder={`https://${net}.com/gymos`}
                  />
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Right Pane: 5 cols (Interactive Live Preview) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <span>Live Branding Preview</span>
            </h3>
            <span className="text-[10px] uppercase font-bold text-slate-400">
              Real-time Rendering
            </span>
          </div>

          <div className="rounded-3xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#090a0f] overflow-hidden shadow-xl">
            {/* Mock Browser Topbar */}
            <div className="px-4 py-2.5 bg-slate-200/80 dark:bg-white/[0.05] border-b border-slate-200 dark:border-white/[0.08] flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 mx-2 bg-white dark:bg-[#12131a] rounded-md px-3 py-0.5 text-[10px] text-slate-400 font-mono truncate">
                {formData.websiteUrl || "https://gymos.com"}
              </div>
            </div>

            {/* Mock Page Content */}
            <div className="p-6 space-y-6">
              {/* Mock Header Navigation */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md"
                    style={{ backgroundColor: formData.primaryColor || "#7c3aed" }}
                  >
                    {formData.platformName ? formData.platformName[0] : "G"}
                  </div>
                  <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {formData.platformName || "GymOS Platform"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full text-white shadow-sm"
                    style={{ backgroundColor: formData.primaryColor || "#7c3aed" }}
                  >
                    Login
                  </span>
                </div>
              </div>

              {/* Mock Hero Section */}
              <div className="space-y-3 py-4 text-center">
                <span
                  className="inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${formData.primaryColor || "#7c3aed"}20`,
                    color: formData.primaryColor || "#7c3aed",
                  }}
                >
                  Enterprise Platform
                </span>
                <h4 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                  {formData.websiteName || "GymOS — Operating System for Modern Gyms"}
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  {formData.tagline || "Multi-branch operations, automated billing, and smart attendance."}
                </p>

                <div className="pt-2 flex justify-center gap-2">
                  <button
                    type="button"
                    className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white shadow-md"
                    style={{ backgroundColor: formData.primaryColor || "#7c3aed" }}
                  >
                    Start Free Trial
                  </button>
                  <button
                    type="button"
                    className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white shadow-md"
                    style={{ backgroundColor: formData.secondaryColor || "#4f46e5" }}
                  >
                    Book Demo
                  </button>
                </div>
              </div>

              {/* Mock Footer */}
              <div className="pt-4 border-t border-slate-200 dark:border-white/[0.08] text-center space-y-1">
                <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                  {formData.footerCopyrightText || "© 2026 GymOS Platform Inc."}
                </p>
                <p className="text-[9px] text-slate-400 dark:text-zinc-500">
                  {formData.companyLegalName} • {formData.contactEmail}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
