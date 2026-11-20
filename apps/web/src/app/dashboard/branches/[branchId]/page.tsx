"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import { BranchData, BranchStatus, Permission } from "@gymos/shared-types";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  MapPin,
  Mail,
  Phone,
  Globe,
  Clock,
  Calendar,
  Users,
  ArrowLeft,
  Edit,
  Save,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Shield,
  X,
} from "lucide-react";

export default function BranchDetailsPage() {
  const { organization, isAuthenticated, isLoading: authLoading, refreshBranches } = useAuth();
  const params = useParams();
  const branchId = params.branchId as string;
  const router = useRouter();

  const [branch, setBranch] = useState<BranchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    branchCode: "",
    description: "",
    email: "",
    phone: "",
    website: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    timezone: "UTC",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchBranch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient<BranchData>(`/branches/${branchId}`);
      setBranch(data);
      setEditForm({
        name: data.name || "",
        branchCode: data.branchCode || "",
        description: data.description || "",
        email: data.email || "",
        phone: data.phone || "",
        website: data.website || "",
        addressLine1: data.addressLine1 || "",
        addressLine2: data.addressLine2 || "",
        city: data.city || "",
        state: data.state || "",
        country: data.country || "",
        postalCode: data.postalCode || "",
        timezone: data.timezone || "UTC",
      });
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load branch details");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    if (organization && branchId) {
      fetchBranch();
    }
  }, [authLoading, isAuthenticated, organization, branchId, fetchBranch, router]);

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: name === "branchCode" ? value.toUpperCase() : value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const updated = await apiClient<BranchData>(`/branches/${branchId}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });

      setBranch(updated);
      setIsEditing(false);
      setSaveMessage({ type: "success", text: "Branch details updated successfully!" });
      await refreshBranches();
    } catch (err: unknown) {
      setSaveMessage({ type: "error", text: (err as Error).message || "Failed to save branch" });
    } finally {
      setIsSaving(false);
    }
  };

  const canEdit = organization?.permissions?.includes(Permission.ORGANIZATION_BRANCHES_CREATE);

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <RotateCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-500" />
        <p className="text-xs">Loading facility details...</p>
      </div>
    );
  }

  if (error || !branch) {
    return (
      <div className="p-8 text-center text-rose-500 max-w-xl mx-auto">
        <AlertCircle className="w-10 h-10 mx-auto mb-2 text-rose-500" />
        <h3 className="text-base font-semibold">Unable to Load Branch</h3>
        <p className="text-xs text-slate-400 mt-1">{error || "Branch not found"}</p>
        <Link
          href="/dashboard/branches"
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Branches
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/dashboard/branches"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Branches
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {branch.name}
            </h1>
            <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-medium bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300">
              {branch.branchCode}
            </span>
            {branch.status === BranchStatus.ACTIVE ? (
              <Badge variant="success">Active</Badge>
            ) : branch.status === BranchStatus.INACTIVE ? (
              <Badge variant="warning">Inactive</Badge>
            ) : (
              <Badge variant="destructive">Closed</Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Registered on {new Date(branch.createdAt).toLocaleDateString("en-IN")} • Slug: {branch.slug}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/branches/${branch.id}/staff`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#131622] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 transition-colors shadow-sm"
          >
            <Users className="w-3.5 h-3.5 text-violet-500" />
            Manage Staff ({branch.staffCount || 0})
          </Link>

          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-sm transition-colors"
            >
              <Edit className="w-3.5 h-3.5" />
              Edit Facility
            </button>
          )}
        </div>
      </div>

      {saveMessage && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 border shadow-sm ${
            saveMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800"
          }`}
        >
          {saveMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{saveMessage.text}</span>
        </div>
      )}

      {isEditing ? (
        /* Edit Form */
        <form onSubmit={handleSave} className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-white/[0.06] pb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Modify Facility Details
              </h3>
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
                  value={editForm.name}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Branch Code *
                </label>
                <input
                  type="text"
                  name="branchCode"
                  required
                  value={editForm.branchCode}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white font-mono uppercase focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={2}
                  value={editForm.description}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={editForm.phone}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={editForm.email}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Address Line 1
                </label>
                <input
                  type="text"
                  name="addressLine1"
                  value={editForm.addressLine1}
                  onChange={handleEditChange}
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
                  value={editForm.city}
                  onChange={handleEditChange}
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
                  value={editForm.state}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Postal Code
                </label>
                <input
                  type="text"
                  name="postalCode"
                  value={editForm.postalCode}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
              >
                {isSaving ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* Readonly Overview Grid */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Location & Contact */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/[0.06] pb-3">
                Facility Location & Contact
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Postal Address</span>
                  <div className="flex items-start gap-2 text-slate-800 dark:text-slate-200">
                    <MapPin className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                    <div>
                      {branch.addressLine1 || "No street address configured"}
                      {branch.addressLine2 && <div>{branch.addressLine2}</div>}
                      {(branch.city || branch.state || branch.postalCode) && (
                        <div>
                          {branch.city} {branch.state} {branch.postalCode}
                        </div>
                      )}
                      <div>{branch.country}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-slate-400 block mb-1">Phone Number</span>
                    <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                      <Phone className="w-4 h-4 text-violet-500 shrink-0" />
                      <span>{branch.phone || "Not configured"}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Email Address</span>
                    <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                      <Mail className="w-4 h-4 text-violet-500 shrink-0" />
                      <span>{branch.email || "Not configured"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {branch.description && (
                <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] text-xs">
                  <span className="text-slate-400 block mb-1">About Facility</span>
                  <p className="text-slate-700 dark:text-slate-300">{branch.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Rail: Operations & Metadata */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/[0.06] pb-3">
                Operations & Timezone
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Timezone
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {branch.timezone}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Staff Assigned
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {branch.staffCount || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Created Date
                  </span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {new Date(branch.createdAt).toLocaleDateString("en-IN")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
