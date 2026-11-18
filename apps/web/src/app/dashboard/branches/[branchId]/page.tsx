"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import { BranchData, BranchStatus, Permission } from "@gymos/shared-types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
      router.push("/login");
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
      setSaveMessage({ type: "success", text: "Branch details updated successfully!" });
      setIsEditing(false);
      await refreshBranches();
    } catch (err: unknown) {
      setSaveMessage({ type: "error", text: (err as Error).message || "Failed to update branch" });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-sm text-zinc-500">
        Loading branch details...
      </div>
    );
  }

  if (error || !branch) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link
          href="/dashboard/branches"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 mb-4"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Branches
        </Link>
        <div className="p-4 rounded-lg bg-red-50 text-red-800 text-sm">
          {error || "Branch not found"}
        </div>
      </div>
    );
  }

  const canUpdate = organization?.permissions.includes(Permission.ORGANIZATION_BRANCHES_UPDATE);

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 max-w-4xl">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/dashboard/branches"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-2 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Branches
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {branch.name}
            </h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                branch.status === BranchStatus.ACTIVE
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : branch.status === BranchStatus.INACTIVE
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              {branch.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Branch Code: <span className="font-mono font-medium">{branch.branchCode}</span> • Slug: <span className="font-mono">{branch.slug}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/dashboard/branches/${branch.id}/staff`}>
            <Button size="sm" variant="outline" className="gap-2 text-xs">
              <Users className="h-3.5 w-3.5" />
              Manage Staff ({branch.staffCount || 0})
            </Button>
          </Link>
          {canUpdate && branch.status !== BranchStatus.CLOSED && (
            <Button
              size="sm"
              variant={isEditing ? "ghost" : "default"}
              onClick={() => setIsEditing(!isEditing)}
              className="gap-2 text-xs"
            >
              <Edit className="h-3.5 w-3.5" />
              {isEditing ? "Cancel Editing" : "Edit Branch"}
            </Button>
          )}
        </div>
      </div>

      {saveMessage && (
        <div
          className={`mb-6 p-4 rounded-lg text-sm flex items-center gap-2 ${
            saveMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {saveMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          )}
          <span>{saveMessage.text}</span>
        </div>
      )}

      {isEditing ? (
        <form onSubmit={handleSave} className="space-y-6">
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Edit Branch Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Branch Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={editForm.name}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Branch Code *
                  </label>
                  <input
                    type="text"
                    name="branchCode"
                    required
                    value={editForm.branchCode}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 text-sm font-mono uppercase rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={2}
                  value={editForm.description}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={editForm.email}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={editForm.phone}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    name="addressLine1"
                    value={editForm.addressLine1}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={editForm.city}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-600" />
                Branch Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <span className="text-xs font-medium text-zinc-500 block">Description</span>
                <p className="text-zinc-700 dark:text-zinc-300 text-xs mt-1">
                  {branch.description || "No description configured."}
                </p>
              </div>

              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <Clock className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Timezone: <strong>{branch.timezone}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Added: {new Date(branch.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <Users className="h-3.5 w-3.5 text-zinc-400" />
                  <span>
                    Staff Assigned: <strong>{branch.staffCount || 0}</strong>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                Contact & Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                  <Mail className="h-3.5 w-3.5 text-zinc-400" />
                  <span>{branch.email || "No branch email"}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                  <Phone className="h-3.5 w-3.5 text-zinc-400" />
                  <span>{branch.phone || "No branch phone"}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                  <Globe className="h-3.5 w-3.5 text-zinc-400" />
                  <span>{branch.website || "No branch website"}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-xs font-medium text-zinc-500 block mb-1">
                  Physical Location
                </span>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {[
                    branch.addressLine1,
                    branch.addressLine2,
                    branch.city,
                    branch.state,
                    branch.postalCode,
                    branch.country,
                  ]
                    .filter(Boolean)
                    .join(", ") || "No address configured for this branch."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
