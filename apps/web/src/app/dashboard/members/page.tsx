"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import { MemberData, PaginatedResult, MemberStatus, Permission } from "@gymos/shared-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Edit,
} from "lucide-react";

export default function MembersDirectoryPage() {
  const { organization, isAuthenticated, isLoading: authLoading, branches } = useAuth();
  const [data, setData] = useState<PaginatedResult<MemberData> | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let query = `/members?page=${page}&limit=10`;
      if (search.trim()) {
        query += `&search=${encodeURIComponent(search.trim())}`;
      }
      if (statusFilter !== "ALL") {
        query += `&status=${statusFilter}`;
      }
      if (branchFilter !== "ALL") {
        query += `&branchId=${branchFilter}`;
      }

      const res = await apiClient<PaginatedResult<MemberData>>(query);
      setData(res);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, branchFilter]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (organization) {
      fetchMembers();
    }
  }, [authLoading, isAuthenticated, organization, fetchMembers, router]);

  const getStatusBadge = (status: MemberStatus) => {
    switch (status) {
      case MemberStatus.ACTIVE:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
            Active
          </span>
        );
      case MemberStatus.INACTIVE:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400">
            Inactive
          </span>
        );
      case MemberStatus.SUSPENDED:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
            Suspended
          </span>
        );
      case MemberStatus.ARCHIVED:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400">
            Archived
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400">
            {status}
          </span>
        );
    }
  };

  const hasPermission = (p: Permission) => {
    return organization?.permissions.includes(p) || false;
  };

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6">
      {/* Top Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard"
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-600" />
            Gym Members
          </h1>
          <p className="text-xs text-zinc-500">
            Directory of registered gym members across branches
          </p>
        </div>

        {hasPermission(Permission.MEMBER_CREATE) && (
          <Link href="/dashboard/members/new">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" />
              Register Member
            </Button>
          </Link>
        )}
      </div>

      {/* Filter and Search Bar */}
      <Card className="mb-6 border-zinc-200 dark:border-zinc-800 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by name, phone, email, or member number..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-zinc-700 dark:text-zinc-300"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            {/* Branch Filter */}
            {branches && branches.length > 0 && (
              <select
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-zinc-700 dark:text-zinc-300"
              >
                <option value="ALL">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error state */}
      {error && (
        <div className="mb-6 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Members Table */}
      <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">Member #</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    Loading members...
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="h-8 w-8 text-zinc-400" />
                      <p className="font-medium">No members found</p>
                      <p className="text-xs text-zinc-400">
                        {search || statusFilter !== "ALL" || branchFilter !== "ALL"
                          ? "Try adjusting your search filters"
                          : "Register your first gym member to get started"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.items.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                      {m.memberNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      <Link
                        href={`/dashboard/members/${m.id}`}
                        className="hover:text-emerald-600 dark:hover:text-emerald-400"
                      >
                        {m.firstName} {m.lastName}
                      </Link>
                      {m.preferredName && (
                        <span className="text-xs text-zinc-400 block">
                          &quot;{m.preferredName}&quot;
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-zinc-400" />
                        <span>{m.phone}</span>
                      </div>
                      {m.email && (
                        <div className="flex items-center gap-1 text-zinc-400 mt-0.5">
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[150px]">{m.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-zinc-400" />
                        <span>{m.branchName || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(m.status)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(m.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/dashboard/members/${m.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                            View
                          </Button>
                        </Link>
                        {hasPermission(Permission.MEMBER_UPDATE) && m.status !== MemberStatus.ARCHIVED && (
                          <Link href={`/dashboard/members/${m.id}/edit`}>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 text-xs text-zinc-500">
            <div>
              Showing {(data.meta.page - 1) * data.meta.limit + 1} to{" "}
              {Math.min(data.meta.page * data.meta.limit, data.meta.total)} of{" "}
              {data.meta.total} members
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!data.meta.hasPreviousPage}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2 text-xs gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </Button>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Page {data.meta.page} of {data.meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.meta.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 px-2 text-xs gap-1"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
