"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import {
  PlatformOverviewData,
  PlatformOrganizationListItem,
} from "@gymos/shared-types";
import {
  Building2,
  Users,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  PackageCheck,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

export default function PlatformOverviewPage() {
  const [overview, setOverview] = useState<PlatformOverviewData | null>(null);
  const [recentGyms, setRecentGyms] = useState<PlatformOrganizationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);
        const [overviewRes, orgsRes] = await Promise.all([
          apiClient<PlatformOverviewData>("/platform/overview"),
          apiClient<{ data: PlatformOrganizationListItem[] }>("/platform/organizations?limit=6"),
        ]);
        setOverview(overviewRes);
        setRecentGyms(orgsRes.data || []);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load platform analytics",
        );
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="text-xs text-zinc-400">Loading SaaS Metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-6 text-red-400">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-semibold">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Title & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <span>Platform Overview</span>
            <span className="rounded-full bg-violet-100 text-violet-800 dark:bg-violet-950 dark:border dark:border-violet-500/40 px-2 py-0.5 text-[10px] font-semibold dark:text-violet-300">
              Live Control Plane
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Global metrics, subscription distribution, and service entitlement health across all tenants.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/platform/organizations"
            className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-xs h-9 px-4 gap-2 shadow-glow shadow-violet-500/25 transition-colors"
          >
            <Building2 className="h-4 w-4" />
            <span>Manage Gym Organizations</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-gradient-to-br dark:from-[#12131f] dark:to-[#0d0e15] p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">
              Est. Monthly MRR
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              ₹{(overview?.estimatedMrr || 0).toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">/ month</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            Across active SaaS gym subscriptions
          </p>
        </div>

        {/* Total Gyms */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-gradient-to-br dark:from-[#12131f] dark:to-[#0d0e15] p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">
              Gym Organizations
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-500/30 text-violet-600 dark:text-violet-400">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {overview?.totalOrganizations || 0}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              ({overview?.activeOrganizations || 0} active)
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            {overview?.suspendedOrganizations || 0} suspended gyms
          </p>
        </div>

        {/* Total Members */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-gradient-to-br dark:from-[#12131f] dark:to-[#0d0e15] p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">
              Total Gym Members
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {(overview?.totalMembers || 0).toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-slate-400 dark:text-zinc-400 font-medium">registered</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            Active patrons across all tenant branches
          </p>
        </div>

        {/* Active Plans */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-gradient-to-br dark:from-[#12131f] dark:to-[#0d0e15] p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">
              SaaS Packages
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400">
              <PackageCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {overview?.totalPlans || 3}
            </span>
            <span className="text-xs text-slate-400 dark:text-zinc-400 font-medium">tiers active</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
            Starter, Pro & Enterprise
          </p>
        </div>
      </div>

      {/* Plan Distribution Breakdown */}
      {overview?.planDistribution && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0e0f17] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                SaaS Subscription Distribution
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Current package enrollment breakdown across registered gyms
              </p>
            </div>
            <Link
              href="/platform/plans"
              className="text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium flex items-center gap-1"
            >
              <span>View SaaS Plans</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.entries(overview.planDistribution).map(([planName, count]) => (
              <div
                key={planName}
                className="rounded-xl border border-slate-200 dark:border-white/[0.05] bg-slate-50 dark:bg-white/[0.02] p-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{planName}</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{count} gyms</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-600/10 dark:border dark:border-violet-500/20 flex items-center justify-center font-bold text-sm">
                  {Math.round(
                    (count / Math.max(1, overview.totalOrganizations)) * 100,
                  )}
                  %
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Gyms & Quick Configuration */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0e0f17] overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Gym Organizations
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Click &quot;Configure Features&quot; to toggle individual modules on or off per gym.
            </p>
          </div>
          <Link
            href="/platform/organizations"
            className="text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium flex items-center gap-1"
          >
            <span>View All ({overview?.totalOrganizations || 0})</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-white/[0.02] text-slate-500 dark:text-zinc-400 uppercase font-semibold border-b border-slate-200 dark:border-white/[0.05]">
              <tr>
                <th className="px-6 py-3.5">Gym Organization</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">SaaS Plan</th>
                <th className="px-6 py-3.5">Active Members</th>
                <th className="px-6 py-3.5">Branches</th>
                <th className="px-6 py-3.5 text-right">Service Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
              {recentGyms.map((gym) => (
                <tr key={gym.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{gym.name}</p>
                      <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                        slug: {gym.slug}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        gym.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border dark:border-emerald-500/30"
                          : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400 dark:border dark:border-red-500/30"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          gym.status === "ACTIVE" ? "bg-emerald-600 dark:bg-emerald-400" : "bg-red-600 dark:bg-red-400"
                        }`}
                      />
                      {gym.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:border dark:border-violet-500/30 dark:text-violet-300 font-semibold text-[11px]">
                      <Sparkles className="h-3 w-3" />
                      {gym.planName || "Enterprise"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-700 dark:text-zinc-300 font-medium">
                    {gym.membersCount ?? 0} members
                  </td>
                  <td className="px-6 py-4 text-slate-700 dark:text-zinc-300 font-medium">
                    {gym.branchesCount ?? 1} branch
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/platform/organizations/${gym.id}/entitlements`}
                      className="inline-flex items-center justify-center rounded-md border border-violet-300 dark:border-violet-500/40 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/50 hover:text-violet-900 dark:hover:text-white text-xs h-8 px-3 gap-1.5 transition-colors font-medium"
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
      </div>
    </div>
  );
}
