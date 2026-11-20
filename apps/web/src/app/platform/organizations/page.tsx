"use client";

import React, { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";

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

export default function PlatformOrganizationsPage() {
  const [gyms, setGyms] = useState<OrganizationItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadGyms = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      let query = "/platform/organizations?limit=100";
      if (search.trim()) {
        query += `&search=${encodeURIComponent(search.trim())}`;
      }
      if (statusFilter !== "ALL") {
        query += `&status=${statusFilter}`;
      }
      const res = await apiClient<{ data: OrganizationItem[] }>(query);
      setGyms(res.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load gym list");
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadGyms();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadGyms]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Building2 className="h-6 w-6 text-violet-400" />
            <span>Gym Organizations</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage gym accounts, assign SaaS subscriptions, and customize module entitlements per gym.
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0e0f17] p-3 rounded-xl border border-white/[0.08]">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search gym by name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#141522] border border-white/[0.08] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-zinc-400" />
          <div className="flex rounded-lg bg-[#141522] border border-white/[0.08] p-0.5 text-xs">
            {["ALL", "ACTIVE", "SUSPENDED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-md font-medium text-[11px] transition-colors ${
                  statusFilter === st
                    ? "bg-violet-600 text-white font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0e0f17] overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        ) : gyms.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-xs">
            No gym organizations matched the criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.02] text-zinc-400 uppercase font-semibold border-b border-white/[0.05]">
                <tr>
                  <th className="px-6 py-3.5">Gym Organization</th>
                  <th className="px-6 py-3.5">Account Status</th>
                  <th className="px-6 py-3.5">SaaS Plan</th>
                  <th className="px-6 py-3.5">Active Members</th>
                  <th className="px-6 py-3.5">Branches</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {gyms.map((gym) => (
                  <tr
                    key={gym.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white text-sm">
                        {gym.name}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono">
                        slug: {gym.slug}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleGymStatus(gym)}
                        disabled={updatingId === gym.id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80 ${
                          gym.status === "ACTIVE"
                            ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30"
                            : "bg-red-950/60 text-red-400 border border-red-500/30"
                        }`}
                        title="Click to toggle status"
                      >
                        {gym.status === "ACTIVE" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        <span>
                          {updatingId === gym.id ? "Updating..." : gym.status}
                        </span>
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-violet-950/50 border border-violet-500/30 text-violet-300 font-semibold text-[11px]">
                        <Sparkles className="h-3 w-3" />
                        {gym.subscription?.planName || "Enterprise"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-300 font-medium">
                      {gym.activeMembersCount} members
                    </td>
                    <td className="px-6 py-4 text-zinc-300 font-medium">
                      {gym.activeBranchesCount} branch
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/platform/organizations/${gym.id}/entitlements`}
                        className="inline-flex items-center justify-center rounded-md bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs h-8 px-3.5 gap-1.5 shadow-sm transition-colors"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Configure Features</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
