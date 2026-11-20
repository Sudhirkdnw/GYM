"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import {
  Building2,
  Search,
  Filter,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertOctagon,
  X,
  Plus,
  UserPlus,
  Lock,
  Mail,
  User,
  Phone,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrganizationItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  activeMembersCount: number;
  activeBranchesCount: number;
  subscription: {
    id: string;
    planCode: string;
    planName: string;
    status: string;
    agreedPrice: number;
    billingInterval: string;
    currentPeriodEnd: string;
  } | null;
}

interface SaasPlanOption {
  id: string;
  name: string;
  code: string;
  monthlyPrice: number;
  annualPrice: number;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function PlatformOrganizationsPage() {
  const [gyms, setGyms] = useState<OrganizationItem[]>([]);
  const [availablePlans, setAvailablePlans] = useState<SaasPlanOption[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // Single & Multi-Select states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    isBulk: boolean;
    targetGym?: OrganizationItem;
    count?: number;
  }>({
    isOpen: false,
    isBulk: false,
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // Register New Gym Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Form Fields
  const [formGymName, setFormGymName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formBranchName, setFormBranchName] = useState("Main Branch");
  const [formBranchCode, setFormBranchCode] = useState("MAIN");
  const [formOwnerFirstName, setFormOwnerFirstName] = useState("");
  const [formOwnerLastName, setFormOwnerLastName] = useState("");
  const [formOwnerEmail, setFormOwnerEmail] = useState("");
  const [formOwnerPhone, setFormOwnerPhone] = useState("");
  const [formPassword, setFormPassword] = useState("GymOwner@123");
  const [formPlanId, setFormPlanId] = useState("");
  const [formBillingInterval, setFormBillingInterval] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");

  // Load available SaaS plans on mount
  useEffect(() => {
    apiClient<SaasPlanOption[]>("/platform/plans")
      .then((res) => {
        const list = res || [];
        setAvailablePlans(list);
        if (list.length > 0) {
          setFormPlanId(list[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const loadGyms = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      let query = `/platform/organizations?page=${page}&limit=${limit}`;
      if (search.trim()) {
        query += `&search=${encodeURIComponent(search.trim())}`;
      }
      if (statusFilter !== "ALL") {
        query += `&status=${encodeURIComponent(statusFilter)}`;
      }

      const res = await apiClient<{
        data: OrganizationItem[];
        meta: PaginationMeta;
      }>(query);

      setGyms(res.data || []);
      setMeta(
        res.meta || {
          page: 1,
          limit,
          total: res.data?.length || 0,
          totalPages: 1,
        },
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load gym organizations",
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, statusFilter]);

  useEffect(() => {
    loadGyms();
  }, [loadGyms]);

  // Sync indeterminate checkbox state
  useEffect(() => {
    if (!headerCheckboxRef.current) return;
    const allOnPageSelected =
      gyms.length > 0 && gyms.every((g) => selectedIds.includes(g.id));
    const someOnPageSelected = gyms.some((g) => selectedIds.includes(g.id));

    headerCheckboxRef.current.checked = allOnPageSelected;
    headerCheckboxRef.current.indeterminate =
      !allOnPageSelected && someOnPageSelected;
  }, [selectedIds, gyms]);

  // Toggle single item selection
  const handleToggleSingle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // Toggle select all on current page
  const handleToggleSelectAll = () => {
    const pageIds = gyms.map((g) => g.id);
    const allOnPageSelected = pageIds.every((id) => selectedIds.includes(id));

    if (allOnPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedIds, ...pageIds]));
      setSelectedIds(merged);
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Toggle Gym Account Status (ACTIVE <-> SUSPENDED)
  const toggleGymStatus = async (gym: OrganizationItem) => {
    const nextStatus = gym.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      setUpdatingId(gym.id);
      setError(null);
      await apiClient(`/platform/organizations/${gym.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setGyms((prev) =>
        prev.map((g) => (g.id === gym.id ? { ...g, status: nextStatus } : g)),
      );
      setSuccessMessage(
        `Gym "${gym.name}" account status updated to ${nextStatus}.`,
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to update gym status",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  // Open single delete confirmation modal
  const openSingleDeleteModal = (gym: OrganizationItem) => {
    setDeleteModal({
      isOpen: true,
      isBulk: false,
      targetGym: gym,
    });
  };

  // Open bulk delete confirmation modal
  const openBulkDeleteModal = () => {
    if (selectedIds.length === 0) return;
    setDeleteModal({
      isOpen: true,
      isBulk: true,
      count: selectedIds.length,
    });
  };

  // Confirm delete handler
  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);

      if (deleteModal.isBulk) {
        const res = await apiClient<{
          success: boolean;
          deletedCount: number;
          failedCount: number;
        }>("/platform/organizations/bulk-delete", {
          method: "POST",
          body: JSON.stringify({ organizationIds: selectedIds }),
        });

        setSuccessMessage(
          `Successfully deleted ${res.deletedCount} gym organization(s).`,
        );
        setSelectedIds([]);
      } else if (deleteModal.targetGym) {
        await apiClient(`/platform/organizations/${deleteModal.targetGym.id}`, {
          method: "DELETE",
        });
        setSuccessMessage(
          `Successfully deleted gym "${deleteModal.targetGym.name}".`,
        );
        setSelectedIds((prev) =>
          prev.filter((id) => id !== deleteModal.targetGym?.id),
        );
      }

      setDeleteModal({ isOpen: false, isBulk: false });
      await loadGyms();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Deletion failed");
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Register Modal
  const handleOpenRegister = () => {
    setFormGymName("");
    setFormSlug("");
    setFormBranchName("Main Branch");
    setFormBranchCode("MAIN");
    setFormOwnerFirstName("");
    setFormOwnerLastName("");
    setFormOwnerEmail("");
    setFormOwnerPhone("");
    setFormPassword("GymOwner@123");
    if (availablePlans.length > 0 && !formPlanId) {
      setFormPlanId(availablePlans[0].id);
    }
    setFormBillingInterval("MONTHLY");
    setRegisterError(null);
    setIsRegisterOpen(true);
  };

  const handleGymNameChange = (name: string) => {
    setFormGymName(name);
    const autoSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    setFormSlug(autoSlug);
  };

  // Handle register submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formGymName.trim()) {
      setRegisterError("Gym Organization Name is required");
      return;
    }
    if (!formOwnerEmail.trim() || !formOwnerFirstName.trim()) {
      setRegisterError("Owner First Name and Email are required");
      return;
    }

    try {
      setIsRegistering(true);
      setRegisterError(null);

      const res = await apiClient<{
        success: boolean;
        organization: { id: string; name: string; slug: string };
        owner: { email: string; isNewUser: boolean; defaultPassword?: string };
      }>("/platform/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: formGymName.trim(),
          slug: formSlug.trim() || undefined,
          branchName: formBranchName.trim() || "Main Branch",
          branchCode: formBranchCode.trim().toUpperCase() || "MAIN",
          ownerFirstName: formOwnerFirstName.trim(),
          ownerLastName: formOwnerLastName.trim(),
          ownerEmail: formOwnerEmail.trim().toLowerCase(),
          ownerPhone: formOwnerPhone.trim() || undefined,
          password: formPassword.trim() || "GymOwner@123",
          planId: formPlanId || undefined,
          billingInterval: formBillingInterval,
        }),
      });

      setSuccessMessage(
        `Gym "${res.organization.name}" registered successfully! Owner can log in with: ${res.owner.email} ${
          res.owner.defaultPassword ? `(Password: ${res.owner.defaultPassword})` : ""
        }`,
      );

      setIsRegisterOpen(false);
      setPage(1);
      await loadGyms();
    } catch (err: unknown) {
      setRegisterError(
        err instanceof Error ? err.message : "Failed to register gym organization",
      );
    } finally {
      setIsRegistering(false);
    }
  };

  const startRecord = meta.total === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, meta.total);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            <span>Gym Organizations</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Super Admin directory of all commercial gym customer accounts. Register new gyms, assign SaaS subscriptions, or configure granular module entitlements.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Button
            onClick={handleOpenRegister}
            className="bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs h-9 px-4 gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Register New Gym</span>
          </Button>

          <Link
            href="/platform/plans"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-700 dark:text-zinc-200 text-xs font-medium h-9 px-3.5 gap-1.5 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            <span>SaaS Plans</span>
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 p-4 text-emerald-800 dark:text-emerald-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-slate-400 hover:text-slate-700 dark:text-emerald-400 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-950/20 p-4 text-red-800 dark:text-red-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-slate-400 hover:text-slate-700 dark:text-red-400 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters, Search & Items Per Page */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#0e0f17] p-3 rounded-xl border border-slate-200 dark:border-white/[0.08] shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search gym by name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#141522] border border-slate-200 dark:border-white/[0.08] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
            <div className="flex rounded-lg bg-slate-100 dark:bg-[#141522] border border-slate-200 dark:border-white/[0.08] p-0.5 text-xs">
              {["ALL", "ACTIVE", "SUSPENDED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-md font-medium text-[11px] transition-colors ${
                    statusFilter === st
                      ? "bg-violet-600 text-white font-semibold shadow-sm"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Page Limit Select */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
            <span className="hidden md:inline">Show:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-[#141522] border border-slate-200 dark:border-white/[0.08] rounded-md px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Multi-Selection Counter Banner */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-500/30 text-xs text-violet-900 dark:text-violet-200">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
              {selectedIds.length}
            </span>
            <span className="font-semibold">
              gym organization{selectedIds.length > 1 ? "s" : ""} selected across pages
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={openBulkDeleteModal}
              className="bg-red-600 hover:bg-red-500 text-white text-xs h-7 px-3 gap-1.5"
            >
              <Trash2 className="h-3 w-3" />
              <span>Delete ({selectedIds.length})</span>
            </Button>
            <button
              onClick={handleClearSelection}
              className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white underline ml-1"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0e0f17] overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        ) : gyms.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-zinc-500 text-xs">
            No gym organizations matched the criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] text-slate-500 dark:text-zinc-400 uppercase font-semibold border-b border-slate-200 dark:border-white/[0.05]">
                <tr>
                  {/* Select All Checkbox */}
                  <th className="w-10 px-4 py-3.5">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      onChange={handleToggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-violet-600 focus:ring-violet-500 focus:ring-offset-0 cursor-pointer"
                      title="Select all on this page"
                    />
                  </th>
                  <th className="px-4 py-3.5">Gym Organization</th>
                  <th className="px-4 py-3.5">Account Status</th>
                  <th className="px-4 py-3.5">SaaS Plan</th>
                  <th className="px-4 py-3.5">Active Members</th>
                  <th className="px-4 py-3.5">Branches</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                {gyms.map((gym) => {
                  const isSelected = selectedIds.includes(gym.id);
                  return (
                    <tr
                      key={gym.id}
                      className={`transition-colors ${
                        isSelected
                          ? "bg-violet-50/70 dark:bg-violet-950/20 hover:bg-violet-100/50 dark:hover:bg-violet-950/30"
                          : "hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                      }`}
                    >
                      {/* Row Checkbox */}
                      <td className="w-10 px-4 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSingle(gym.id)}
                          className="h-4 w-4 rounded border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-violet-600 focus:ring-violet-500 focus:ring-offset-0 cursor-pointer"
                        />
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white text-sm">
                          {gym.name}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                          slug: {gym.slug}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <button
                          onClick={() => toggleGymStatus(gym)}
                          disabled={updatingId === gym.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80 ${
                            gym.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border dark:border-emerald-500/30"
                              : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400 dark:border dark:border-red-500/30"
                          }`}
                          title="Click to toggle status"
                        >
                          {gym.status === "ACTIVE" ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
                          )}
                          <span>
                            {updatingId === gym.id ? "Updating..." : gym.status}
                          </span>
                        </button>
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:border dark:border-violet-500/30 dark:text-violet-300 font-semibold text-[11px]">
                          <Sparkles className="h-3 w-3" />
                          {gym.subscription?.planName || "Enterprise"}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-slate-700 dark:text-zinc-300 font-medium">
                        {gym.activeMembersCount} members
                      </td>

                      <td className="px-4 py-4 text-slate-700 dark:text-zinc-300 font-medium">
                        {gym.activeBranchesCount} branch
                      </td>

                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/platform/organizations/${gym.id}/entitlements`}
                            className="inline-flex items-center justify-center rounded-md bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs h-8 px-3 gap-1.5 shadow-sm transition-colors"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span>Features</span>
                          </Link>

                          <button
                            onClick={() => openSingleDeleteModal(gym)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:text-zinc-500 dark:hover:text-red-400 dark:hover:bg-red-950/30 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-500/30"
                            title={`Delete ${gym.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {meta.total > 0 && (
          <div className="p-4 border-t border-slate-200 dark:border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-zinc-400">
            <div>
              Showing <span className="font-semibold text-slate-900 dark:text-white">{startRecord}</span> to{" "}
              <span className="font-semibold text-slate-900 dark:text-white">{endRecord}</span> of{" "}
              <span className="font-semibold text-slate-900 dark:text-white">{meta.total}</span> gym organizations
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="h-8 px-2.5 text-xs border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Previous</span>
              </Button>

              <div className="flex items-center gap-1 px-2 text-slate-700 dark:text-zinc-300 font-medium">
                Page {page} of {Math.max(1, meta.totalPages)}
              </div>

              <Button
                variant="outline"
                disabled={page >= meta.totalPages || isLoading}
                onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
                className="h-8 px-2.5 text-xs border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-40"
              >
                <span className="hidden sm:inline mr-1">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* REGISTER NEW GYM ORGANIZATION MODAL */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 dark:bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[92vh] bg-white dark:bg-[#0e0f17] border border-slate-200 dark:border-white/[0.12] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between shrink-0 bg-slate-50 dark:bg-[#12131f]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-600/20 dark:border dark:border-violet-500/40 dark:text-violet-400">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Register New Gym Organization
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Onboard a new gym business, create owner login credentials, and assign SaaS subscription.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRegisterOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/[0.08] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleRegisterSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {registerError && (
                <div className="p-3.5 rounded-xl border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{registerError}</span>
                </div>
              )}

              {/* Section 1: Gym Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>1. Gym Business & Branch</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Gym Organization Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Iron Paradise Gym"
                      value={formGymName}
                      onChange={(e) => handleGymNameChange(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#161722] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Unique Slug (subdomain identifier)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. iron-paradise"
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#161722] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Primary Branch Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Main Branch - Central"
                      value={formBranchName}
                      onChange={(e) => setFormBranchName(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#161722] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Branch Code
                    </label>
                    <input
                      type="text"
                      placeholder="MAIN"
                      value={formBranchCode}
                      onChange={(e) => setFormBranchCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#161722] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Owner Login */}
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/[0.08]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  <span>2. Gym Owner Account (Login Credentials)</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Owner First Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Vikram"
                      value={formOwnerFirstName}
                      onChange={(e) => setFormOwnerFirstName(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#161722] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Owner Last Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sharma"
                      value={formOwnerLastName}
                      onChange={(e) => setFormOwnerLastName(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#161722] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Owner Login Email *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                      <input
                        type="email"
                        placeholder="owner@gymname.com"
                        value={formOwnerEmail}
                        onChange={(e) => setFormOwnerEmail(e.target.value)}
                        required
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#161722] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Owner Phone (Optional)
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                      <input
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={formOwnerPhone}
                        onChange={(e) => setFormOwnerPhone(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#161722] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                    Initial Owner Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                    <input
                      type="text"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#161722] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                    The gym owner can change their password after logging into their dashboard.
                  </p>
                </div>
              </div>

              {/* Section 3: SaaS Subscription Plan */}
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/[0.08]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  <span>3. SaaS Subscription Package</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Assigned SaaS Plan
                    </label>
                    <select
                      value={formPlanId}
                      onChange={(e) => setFormPlanId(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#161722] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      {availablePlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} (₹{plan.monthlyPrice.toLocaleString("en-IN")}/mo)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Billing Interval
                    </label>
                    <select
                      value={formBillingInterval}
                      onChange={(e) =>
                        setFormBillingInterval(e.target.value as "MONTHLY" | "ANNUAL")
                      }
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#161722] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="MONTHLY">Monthly Billing Cycle</option>
                      <option value="ANNUAL">Annual Billing Cycle (1 Year)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-end gap-3 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRegisterOpen(false)}
                  className="border-slate-300 dark:border-white/[0.1] text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:text-white text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isRegistering}
                  className="bg-violet-600 hover:bg-violet-500 text-white text-xs h-9 px-5 gap-1.5 font-medium shadow-sm"
                >
                  {isRegistering ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Onboarding Gym...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Register & Activate Gym</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 dark:bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-red-300 dark:border-red-500/30 bg-white dark:bg-[#12131f] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:border dark:border-red-500/40 dark:text-red-400">
                <AlertOctagon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {deleteModal.isBulk
                    ? `Delete ${deleteModal.count} Gym Organizations?`
                    : `Delete "${deleteModal.targetGym?.name}"?`}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/20 text-xs text-red-800 dark:text-red-300/90 leading-relaxed">
              All associated branches, members, attendance records, invoices, and SaaS entitlements for{" "}
              {deleteModal.isBulk
                ? `the ${deleteModal.count} selected gyms`
                : `"${deleteModal.targetGym?.name}"`}{" "}
              will be permanently purged from the database.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                disabled={isDeleting}
                onClick={() => setDeleteModal({ isOpen: false, isBulk: false })}
                className="border-slate-300 dark:border-white/[0.1] text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:text-white text-xs h-9 px-4"
              >
                Cancel
              </Button>

              <Button
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold h-9 px-4 gap-1.5 shadow-sm"
              >
                {isDeleting ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Purging Data...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
