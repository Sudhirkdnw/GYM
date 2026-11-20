"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import { BranchData, PaginatedResult, BranchStatus, Permission } from "@gymos/shared-types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Users,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  AlertTriangle,
  X,
  Phone,
  Power,
  ShieldAlert,
} from "lucide-react";

export default function BranchesListPage() {
  const { organization, isAuthenticated, isLoading: authLoading, refreshBranches } = useAuth();
  const [data, setData] = useState<PaginatedResult<BranchData> | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const router = useRouter();

  const fetchBranches = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let query = `/branches?page=${page}&limit=10`;
      if (search.trim()) {
        query += `&search=${encodeURIComponent(search.trim())}`;
      }
      if (statusFilter !== "ALL") {
        query += `&status=${statusFilter}`;
      }

      const res = await apiClient<PaginatedResult<BranchData>>(query);
      setData(res);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load branches");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    if (organization) {
      fetchBranches();
    }
  }, [authLoading, isAuthenticated, organization, fetchBranches, router]);

  const handleStatusChange = async (branchId: string, newStatus: BranchStatus) => {
    if (newStatus === BranchStatus.CLOSED) {
      const confirmClose = window.confirm(
        "Are you sure you want to permanently CLOSE this branch? This action cannot be undone.",
      );
      if (!confirmClose) return;
    }

    try {
      setActionLoading(branchId);
      await apiClient(`/branches/${branchId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchBranches();
      await refreshBranches();
    } catch (err: unknown) {
      alert((err as Error).message || "Failed to update branch status");
    } finally {
      setActionLoading(null);
    }
  };

  const canCreate = organization?.permissions?.includes(Permission.ORGANIZATION_BRANCHES_CREATE);
  const canManageStatus = organization?.permissions?.includes(Permission.ORGANIZATION_BRANCHES_STATUS_MANAGE);

  const totalBranches = data?.meta?.total || 0;
  const activeCount = data?.items?.filter((b) => b.status === BranchStatus.ACTIVE).length || 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-600/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            Gym Branches
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage physical facility locations, operational statuses, and staff deployment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchBranches()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#131622] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 transition-colors shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Refresh
          </button>
          {canCreate && (
            <Link
              href="/dashboard/branches/new"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Branch
            </Link>
          )}
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Facilities</span>
            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              {totalBranches}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Operational</span>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-1">
              {activeCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Multi-Branch Sync</span>
            <div className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
              Synchronized RLS
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by branch name, code, or city..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="ALL">All Operational Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="CLOSED">Closed</option>
          </select>

          {(search || statusFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Table / Branches List */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#131622] overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <RotateCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-500" />
            <p className="text-xs">Loading facilities...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No Branches Found"
            description={
              search || statusFilter !== "ALL"
                ? "No branch matches your active filter criteria."
                : "Get started by adding your organization's first facility."
            }
            action={
              canCreate
                ? {
                    label: "Add First Branch",
                    onClick: () => router.push("/dashboard/branches/new"),
                  }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-white/[0.08] uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Branch Name</th>
                  <th className="px-5 py-3.5">Code</th>
                  <th className="px-5 py-3.5">Location</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Staff Deployed</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {data.items.map((branch) => {
                  const isRowBusy = actionLoading === branch.id;
                  return (
                    <tr
                      key={branch.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium">
                        <Link
                          href={`/dashboard/branches/${branch.id}`}
                          className="hover:text-violet-500 transition-colors flex items-center gap-2 group"
                        >
                          <span className="font-semibold text-slate-900 dark:text-white group-hover:text-violet-500">
                            {branch.name}
                          </span>
                          <ExternalLink className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                        </Link>
                        {branch.phone && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-normal mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{branch.phone}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-medium bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300">
                          {branch.branchCode}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {branch.city || branch.state
                              ? `${branch.city || ""}${branch.city && branch.state ? ", " : ""}${branch.state || ""}`
                              : "Unconfigured"}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        {branch.status === BranchStatus.ACTIVE ? (
                          <Badge variant="success">Active</Badge>
                        ) : branch.status === BranchStatus.INACTIVE ? (
                          <Badge variant="warning">Inactive</Badge>
                        ) : (
                          <Badge variant="destructive">Closed</Badge>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <Link
                          href={`/dashboard/branches/${branch.id}/staff`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 text-[11px] transition-colors"
                        >
                          <Users className="w-3 h-3 text-violet-500" />
                          <span>{branch.staffCount || 0} Staff</span>
                        </Link>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/dashboard/branches/${branch.id}`}
                            className="px-2.5 py-1.5 text-[11px] font-medium rounded-xl border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 transition-colors"
                          >
                            Details
                          </Link>

                          {canManageStatus && branch.status !== BranchStatus.CLOSED && (
                            <>
                              {branch.status === BranchStatus.ACTIVE ? (
                                <button
                                  disabled={isRowBusy}
                                  onClick={() => handleStatusChange(branch.id, BranchStatus.INACTIVE)}
                                  className="px-2 py-1.5 text-[11px] font-medium text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl transition-colors disabled:opacity-50"
                                  title="Deactivate Branch"
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  disabled={isRowBusy}
                                  onClick={() => handleStatusChange(branch.id, BranchStatus.ACTIVE)}
                                  className="px-2 py-1.5 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-colors disabled:opacity-50"
                                  title="Activate Branch"
                                >
                                  Activate
                                </button>
                              )}

                              <button
                                disabled={isRowBusy}
                                onClick={() => handleStatusChange(branch.id, BranchStatus.CLOSED)}
                                className="px-2 py-1.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors disabled:opacity-50"
                                title="Close Permanently"
                              >
                                Close
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {data && data.meta && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.01] text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Page {page} of {data.meta.totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
