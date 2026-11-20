"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import { BranchData } from "@gymos/shared-types";
import {
  ArrowLeft,
  Plus,
  Building2,
  AlertCircle,
  MapPin,
  Mail,
  Phone,
  Globe,
  Clock,
  RotateCcw,
} from "lucide-react";

export default function CreateBranchPage() {
  const { organization, refreshBranches } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    branchCode: "",
    description: "",
    email: "",
    phone: "",
    website: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "India",
    postalCode: "",
    timezone: "Asia/Kolkata",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "branchCode" ? value.toUpperCase() : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await apiClient<BranchData>("/branches", {
        method: "POST",
        body: JSON.stringify(formData),
      });

      await refreshBranches();
      router.push(`/dashboard/branches/${res.id}`);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to create branch");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div>
        <Link
          href="/dashboard/branches"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Branches
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-600/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
          Create New Gym Branch
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Add a new physical gym facility to your organization ({organization?.name}).
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Branch Identity */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-white/[0.06] pb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Branch Identity
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Unique name and code identifiers for this facility.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Branch Name *
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="e.g. Indiranagar Flagship"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Branch Code (Short Unique ID) *
              </label>
              <input
                type="text"
                name="branchCode"
                required
                maxLength={10}
                placeholder="e.g. BLR01"
                value={formData.branchCode}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white font-mono uppercase focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Facility Description
              </label>
              <textarea
                name="description"
                rows={2}
                placeholder="Key equipment, floor area, amenities..."
                value={formData.description}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-white/[0.06] pb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Phone className="w-4 h-4 text-violet-500" />
              Contact Information
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Public reception phone, email, and website.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Branch Phone
              </label>
              <input
                type="tel"
                name="phone"
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Branch Email
              </label>
              <input
                type="email"
                name="email"
                placeholder="branch@gymos.io"
                value={formData.email}
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
                placeholder="https://..."
                value={formData.website}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          </div>
        </div>

        {/* Physical Address & Locale */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-white/[0.06] pb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-violet-500" />
              Physical Address & Locale
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Postal location used for billing tax invoicing and member check-in validation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Address Line 1
              </label>
              <input
                type="text"
                name="addressLine1"
                placeholder="Building, street, landmark..."
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
                placeholder="Bengaluru"
                value={formData.city}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                State / Province
              </label>
              <input
                type="text"
                name="state"
                placeholder="Karnataka"
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
                placeholder="560038"
                value={formData.postalCode}
                onChange={handleChange}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Timezone
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
            href="/dashboard/branches"
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
                Registering Facility...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Gym Branch
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
