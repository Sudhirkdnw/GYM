"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import { MemberData, PaginatedResult, MemberStatus, Permission } from "@gymos/shared-types";
import {
  Users,
  UserPlus,
  Search,
  Building2,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  SlidersHorizontal,
  RefreshCw,
  Sparkles,
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
      let query = `/members?page=${page}&limit=12`;
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        );
      case MemberStatus.INACTIVE:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-500 border border-border">
            Inactive
          </span>
        );
      case MemberStatus.SUSPENDED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            Suspended
          </span>
        );
      case MemberStatus.ARCHIVED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-500 border border-red-500/20">
            Archived
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
            {status}
          </span>
        );
    }
  };

  const hasPermission = (p: Permission) => {
    return organization?.permissions.includes(p) || false;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Member Directory
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {data?.meta?.total ?? 0} Members
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage gym members, profiles, emergency contacts, and active memberships across branches.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchMembers()}
            className="p-2 rounded-xl border border-border bg-card hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-primary" : ""}`} />
          </button>

          {hasPermission(Permission.MEMBER_CREATE) && (
            <Link
              href="/dashboard/members/new"
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all"
            >
              <UserPlus className="h-4 w-4" />
              Register Member
            </Link>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, phone, email, or member number..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                className="px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-500">
          {error}
        </div>
      )}

      {/* Members Table */}
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/60 bg-muted/40 uppercase tracking-wider text-[10px] text-muted-foreground font-semibold">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Member #</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    <p className="font-semibold text-foreground text-xs">Loading member directory...</p>
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="h-10 w-10 text-muted-foreground/40" />
                      <p className="font-semibold text-foreground text-sm">No members found</p>
                      <p className="text-xs text-muted-foreground">
                        {search || statusFilter !== "ALL" || branchFilter !== "ALL"
                          ? "Try adjusting your search filters or selected branch"
                          : "Register your first gym member to begin tracking attendance and memberships"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.items.map((m) => {
                  const initials = `${m.firstName[0] || ""}${m.lastName[0] || ""}`.toUpperCase();
                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-accent/40 transition-colors group"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                            {initials || "MB"}
                          </div>
                          <div>
                            <Link
                              href={`/dashboard/members/${m.id}`}
                              className="font-bold text-foreground hover:text-primary transition-colors block"
                            >
                              {m.firstName} {m.lastName}
                            </Link>
                            {m.preferredName && (
                              <span className="text-[11px] text-muted-foreground block">
                                &quot;{m.preferredName}&quot;
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-mono text-xs font-semibold text-foreground">
                        {m.memberNumber}
                      </td>

                      <td className="px-4 py-3.5 text-xs">
                        <div className="flex items-center gap-1.5 text-foreground font-medium">
                          <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span>{m.phone}</span>
                        </div>
                        {m.email && (
                          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mt-0.5">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[150px]">{m.email}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="font-medium text-foreground">{m.branchName || "—"}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">{getStatusBadge(m.status)}</td>

                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {new Date(m.joinedAt).toLocaleDateString([], {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/dashboard/members/${m.id}`}
                            className="p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            title="View Profile"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          {hasPermission(Permission.MEMBER_UPDATE) && m.status !== MemberStatus.ARCHIVED && (
                            <Link
                              href={`/dashboard/members/${m.id}/edit`}
                              className="p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                              title="Edit Member"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {data && data.meta.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-border/60 px-4 py-3 text-xs text-muted-foreground bg-muted/20">
            <div>
              Showing <span className="font-semibold text-foreground">{(data.meta.page - 1) * data.meta.limit + 1}</span> to{" "}
              <span className="font-semibold text-foreground">
                {Math.min(data.meta.page * data.meta.limit, data.meta.total)}
              </span>{" "}
              of <span className="font-semibold text-foreground">{data.meta.total}</span> members
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={!data.meta.hasPreviousPage}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-accent disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </button>
              <span className="px-2 font-medium">
                Page {data.meta.page} of {data.meta.totalPages}
              </span>
              <button
                disabled={!data.meta.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-accent disabled:opacity-40 transition-colors"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
