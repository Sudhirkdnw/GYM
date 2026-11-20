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

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function PlatformOrganizationsPage() {
  const [gyms, setGyms] = useState<OrganizationItem[]>([]);
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

  const loadGyms = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      let query = `/platform/organizations?page=${page}&limit=${limit}`;
      if (search.trim()) {
        query += `&search=${encodeURIComponent(search.trim())}`;
      }
      if (statusFilter !== "ALL") {
        query += `&status=${statusFilter}`;
      }
      const res = await apiClient<{
        data: OrganizationItem[];
        meta: PaginationMeta;
      }>(query);

      setGyms(res.data || []);
      if (res.meta) {
        setMeta(res.meta);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load gym list");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadGyms();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadGyms]);

  // Reset to page 1 on search or filter change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  // Sync header indeterminate state
  useEffect(() => {
    if (!headerCheckboxRef.current) return;
    const pageIds = gyms.map((g) => g.id);
    const selectedOnPage = pageIds.filter((id) => selectedIds.includes(id));

    if (selectedOnPage.length === 0) {
      headerCheckboxRef.current.checked = false;
      headerCheckboxRef.current.indeterminate = false;
    } else if (selectedOnPage.length === pageIds.length && pageIds.length > 0) {
      headerCheckboxRef.current.checked = true;
      headerCheckboxRef.current.indeterminate = false;
    } else {
      headerCheckboxRef.current.checked = false;
      headerCheckboxRef.current.indeterminate = true;
    }
  }, [selectedIds, gyms]);

  // Toggle single selection
  const handleToggleSingle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // Toggle select-all on current page
  const handleToggleSelectAll = () => {
    const pageIds = gyms.map((g) => g.id);
    const allSelectedOnPage = pageIds.every((id) => selectedIds.includes(id));

    if (allSelectedOnPage) {
      // Unselect all on this page
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      // Add all missing on this page
      const newSelected = Array.from(new Set([...selectedIds, ...pageIds]));
      setSelectedIds(newSelected);
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Toggle Gym Account Status (Active / Suspended)
  const toggleGymStatus = async (gym: OrganizationItem) => {
    const newStatus = gym.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      setUpdatingId(gym.id);
      await apiClient(`/platform/organizations/${gym.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      await loadGyms();
    } catch (err: unknown) {
      alert(`Status update failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setUpdatingId(null);
    }
  };

  // Open single delete confirmation
  const openSingleDeleteModal = (gym: OrganizationItem) => {
    setDeleteModal({
      isOpen: true,
      isBulk: false,
      targetGym: gym,
    });
  };

  // Open bulk delete confirmation
  const openBulkDeleteModal = () => {
    if (selectedIds.length === 0) return;
    setDeleteModal({
      isOpen: true,
      isBulk: true,
      count: selectedIds.length,
    });
  };

  // Execute confirmed deletion
  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      setSuccessMessage(null);

      if (deleteModal.isBulk) {
        // Bulk delete
        const res = await apiClient<{
          totalRequested: number;
          deletedCount: number;
          results: Array<{ success: boolean; id: string; error?: string }>;
        }>("/platform/organizations/bulk-delete", {
          method: "POST",
          body: JSON.stringify({ ids: selectedIds }),
        });

        if (res.deletedCount === 0) {
          throw new Error("Unable to delete selected gyms. Please check server logs.");
        }

        setSuccessMessage(
          `Successfully deleted ${res.deletedCount} of ${selectedIds.length} gym organization(s) and purged related records.`,
        );
        setSelectedIds([]);
      } else if (deleteModal.targetGym) {
        // Single delete
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
            Manage gym accounts, assign SaaS subscriptions, and customize module entitlements per gym.
          </p>
        </div>

        {/* Global Bulk Delete button when items selected */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3">
            <Button
              onClick={openBulkDeleteModal}
              className="bg-red-600 hover:bg-red-500 text-white font-medium text-xs h-9 px-4 gap-2 shadow-sm"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Selected ({selectedIds.length})</span>
            </Button>
            <Button
              variant="outline"
              onClick={handleClearSelection}
              className="border-slate-300 dark:border-white/[0.1] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white text-xs h-9 px-3"
            >
              Clear
            </Button>
          </div>
        )}
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

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#12131f] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-950/60 border border-red-500/40 text-red-400">
                <AlertOctagon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {deleteModal.isBulk
                    ? `Delete ${deleteModal.count} Gym Organizations?`
                    : `Delete "${deleteModal.targetGym?.name}"?`}
                </h3>
                <p className="text-xs text-zinc-400">
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/20 text-xs text-red-300/90 leading-relaxed">
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
                className="border-white/[0.1] text-zinc-300 hover:text-white text-xs h-9 px-4"
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
