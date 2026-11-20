"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import { OrganizationProfile } from "@gymos/shared-types";
import {
  ArrowLeft,
  Save,
  Building2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Building,
  Mail,
  MapPin,
  Coins,
} from "lucide-react";

export default function OrganizationProfileEditPage() {
  const { organization, isAuthenticated, isLoading: authLoading, refreshSession } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    legalName: "",
    businessEmail: "",
    businessPhone: "",
    website: "",
    description: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    timezone: "UTC",
    currency: "INR",
  });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    if (!organization) return;

    const fetchOrg = async () => {
      try {
        setLoading(true);
        const data = await apiClient<OrganizationProfile>("/organizations/current");
        setFormData({
          name: data.name || "",
          slug: data.slug || "",
          legalName: data.legalName || "",
          businessEmail: data.businessEmail || "",
          businessPhone: data.businessPhone || "",
          website: data.website || "",
          description: data.description || "",
          addressLine1: data.addressLine1 || "",
          addressLine2: data.addressLine2 || "",
          city: data.city || "",
          state: data.state || "",
          country: data.country || "",
          postalCode: data.postalCode || "",
          timezone: data.timezone || "UTC",
          currency: data.currency || "INR",
        });
      } catch (err: unknown) {
        setStatusMessage({ type: "error", text: (err as Error).message || "Failed to load profile" });
      } finally {
        setLoading(false);
      }
    };

    fetchOrg();
  }, [authLoading, isAuthenticated, organization, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      await apiClient("/organizations/current", {
        method: "PATCH",
        body: JSON.stringify(formData),
      });

      setStatusMessage({ type: "success", text: "Organization profile updated successfully!" });
      await refreshSession();
    } catch (err: unknown) {
      setStatusMessage({ type: "error", text: (err as Error).message || "Failed to update profile" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <RotateCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-500" />
        <p className="text-xs">Loading profile settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div>
        <Link
          href="/dashboard/organization"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Organization Overview
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-600/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300 flex items-center justify-center">
            <Building className="w-4 h-4" />
          </div>
          Edit Organization Profile
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure legal entity data, communications, and localization defaults.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 border shadow-sm ${
            statusMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Legal Identity */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-white/[0.06] pb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Legal Identity & Branding
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Display Brand Name *
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Legal Entity Registered Name
              </label>
              <input
                type="text"
                name="legalName"
                value={formData.legalName}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Company Description
              </label>
              <textarea
                name="description"
                rows={2}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Business Communications */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-white/[0.06] pb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-violet-500" />
              Business Communications
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Business Email
              </label>
              <input
                type="email"
                name="businessEmail"
                value={formData.businessEmail}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Business Phone
              </label>
              <input
                type="tel"
                name="businessPhone"
                value={formData.businessPhone}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Website
              </label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          </div>
        </div>

        {/* Headquarters Address */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-white/[0.06] pb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-violet-500" />
              Registered Headquarters
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Address Line 1
              </label>
              <input
                type="text"
                name="addressLine1"
                value={formData.addressLine1}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                City
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                State
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Postal Code (PIN)
              </label>
              <input
                type="text"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Country
              </label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          </div>
        </div>

        {/* Localization */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-white/[0.06] pb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-violet-500" />
              Localization Defaults
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Currency
              </label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="INR">INR (₹) - Indian Rupee</option>
                <option value="USD">USD ($) - US Dollar</option>
                <option value="EUR">EUR (€) - Euro</option>
                <option value="AED">AED (د.إ) - UAE Dirham</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Primary Organization Timezone
              </label>
              <select
                name="timezone"
                value={formData.timezone}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                <option value="UTC">UTC (+0:00)</option>
                <option value="America/New_York">America/New_York (EST)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/dashboard/organization"
            className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-500/20 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                Saving Profile...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Profile Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
