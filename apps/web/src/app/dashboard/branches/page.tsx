"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import { BranchData, PaginatedResult, BranchStatus, Permission } from "@gymos/shared-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Users,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ExternalLink,
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
      router.push("/login");
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

  const canCreate = organization?.permissions.includes(Permission.ORGANIZATION_BRANCHES_CREATE);
  const canManageStatus = organization?.permissions.includes(Permission.ORGANIZATION_BRANCHES_STATUS_MANAGE);

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6">
      {/* Top Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-2 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Building2 className="h-7 w-7 text-emerald-600" />
            Gym Branches
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Manage physical facility locations, operational status, and staff deployments.
          </p>
        </div>

        {canCreate && (
          <Link href="/dashboard/branches/new">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <Plus className="h-4 w-4" />
              Add Branch
            </Button>
          </Link>
        )}
      </div>

      {/* Filters and Search Bar */}
      <Card className="border-zinc-200 dark:border-zinc-800 mb-6">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by name, code, or city..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-zinc-500 shrink-0">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Branches Table / List */}
      {loading ? (
        <div className="py-16 text-center text-sm text-zinc-500">
          Loading branches...
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 text-sm">
          {error}
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card className="border-dashed border-zinc-300 dark:border-zinc-700 text-center py-12">
          <CardContent className="space-y-3">
            <Building2 className="h-10 w-10 text-zinc-400 mx-auto" />
            <h3 className="font-semibold text-zinc-700 dark:text-zinc-300 text-sm">
              No branches found
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              {search || statusFilter !== "ALL"
                ? "Try adjusting your search criteria or status filter."
                : "Get started by adding your first gym branch location."}
            </p>
            {canCreate && (
              <Link href="/dashboard/branches/new">
                <Button size="sm" className="mt-2 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add First Branch
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Branch Name</th>
                    <th className="py-3 px-4 font-semibold">Code</th>
                    <th className="py-3 px-4 font-semibold">Location</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Staff</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {data.items.map((branch) => {
                    const isRowBusy = actionLoading === branch.id;
                    return (
                      <tr key={branch.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                        <td className="py-3.5 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                          <Link
                            href={`/dashboard/branches/${branch.id}`}
                            className="hover:text-emerald-600 transition-colors flex items-center gap-1.5"
                          >
                            <span>{branch.name}</span>
                            <ExternalLink className="h-3 w-3 opacity-40" />
                          </Link>
                          {branch.phone && (
                            <span className="text-[11px] text-zinc-400 block font-normal mt-0.5">
                              {branch.phone}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-medium text-zinc-600 dark:text-zinc-400">
                          {branch.branchCode}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-400">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-zinc-400 shrink-0" />
                            {branch.city || branch.state ? `${branch.city || ""}, ${branch.state || ""}` : "Not configured"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                              branch.status === BranchStatus.ACTIVE
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                                : branch.status === BranchStatus.INACTIVE
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                                : "bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300"
                            }`}
                          >
                            {branch.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <Link
                            href={`/dashboard/branches/${branch.id}/staff`}
                            className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-emerald-600 dark:text-zinc-400"
                          >
                            <Users className="h-3.5 w-3.5 text-zinc-400" />
                            <span>{branch.staffCount || 0} assigned</span>
                          </Link>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1">
                          <Link href={`/dashboard/branches/${branch.id}`}>
                            <Button size="sm" variant="ghost" className="h-7 text-xs px-2">
                              Details
                            </Button>
                          </Link>

                          {canManageStatus && branch.status !== BranchStatus.CLOSED && (
                            <>
                              {branch.status === BranchStatus.ACTIVE ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={isRowBusy}
                                  onClick={() => handleStatusChange(branch.id, BranchStatus.INACTIVE)}
                                  className="h-7 text-xs px-2 text-amber-600 hover:text-amber-700"
                                >
                                  Deactivate
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={isRowBusy}
                                  onClick={() => handleStatusChange(branch.id, BranchStatus.ACTIVE)}
                                  className="h-7 text-xs px-2 text-emerald-600 hover:text-emerald-700"
                                >
                                  Reactivate
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isRowBusy}
                                onClick={() => handleStatusChange(branch.id, BranchStatus.CLOSED)}
                                className="h-7 text-xs px-2 text-red-600 hover:text-red-700"
                              >
                                Close
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {data.meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-xs">
                <span className="text-zinc-500">
                  Showing page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} branches)
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!data.meta.hasPreviousPage}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!data.meta.hasNextPage}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
