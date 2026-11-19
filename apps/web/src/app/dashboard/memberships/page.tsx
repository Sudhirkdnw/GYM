"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import {
  MemberMembershipData,
  MembershipPlanData,
  MemberData,
  MembershipStatus,
  Permission,
  PaginatedResult,
} from "@gymos/shared-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Search,
  Filter,
  CreditCard,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Ban,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
  ExternalLink,
} from "lucide-react";

export default function SubscriptionsDirectoryPage() {
  const router = useRouter();
  const { organization, branches, isAuthenticated, isLoading: authLoading } = useAuth();

  const [subscriptions, setSubscriptions] = useState<MemberMembershipData[]>([]);
  const [plans, setPlans] = useState<MembershipPlanData[]>([]);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [expiringFilter, setExpiringFilter] = useState<boolean>(false);

  // KPI counts
  const [kpiActive, setKpiActive] = useState(0);
  const [kpiFrozen, setKpiFrozen] = useState(0);

  // Modals state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [showThawModal, setShowThawModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const [selectedSub, setSelectedSub] = useState<MemberMembershipData | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Assign Form
  const [assignMemberId, setAssignMemberId] = useState("");
  const [assignPlanId, setAssignPlanId] = useState("");
  const [assignBranchId, setAssignBranchId] = useState("");
  const [assignStartDate, setAssignStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [assignDiscount, setAssignDiscount] = useState<number>(0);
  const [assignDiscountReason, setAssignDiscountReason] = useState("");
  const [assignTaxRate, setAssignTaxRate] = useState<number>(0);
  const [assignNotes, setAssignNotes] = useState("");

  // Renew Form
  const [renewPlanId, setRenewPlanId] = useState("");
  const [renewStartDate, setRenewStartDate] = useState("");
  const [renewDiscount, setRenewDiscount] = useState<number>(0);
  const [renewTaxRate, setRenewTaxRate] = useState<number>(0);

  // Freeze Form
  const [freezeStartDate, setFreezeStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [freezeEndDate, setFreezeEndDate] = useState("");
  const [freezeReason, setFreezeReason] = useState("");

  // Thaw Form
  const [thawDate, setThawDate] = useState(new Date().toISOString().split("T")[0]);
  const [thawReason, setThawReason] = useState("");

  // Cancel Form
  const [cancelReason, setCancelReason] = useState("");

  const hasPermission = (p: Permission) => {
    return organization?.permissions.includes(p) || false;
  };

  const fetchSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("limit", "20");
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (search.trim()) params.append("search", search.trim());
      if (expiringFilter) params.append("expiringInDays", "7");

      const res = await apiClient<PaginatedResult<MemberMembershipData>>(
        `/memberships/subscriptions?${params.toString()}`
      );
      setSubscriptions(res.items || []);
      setTotalPages(res.meta?.totalPages || 1);
      setTotalCount(res.meta?.total || 0);

      // Simple client KPI rollup
      const active = (res.items || []).filter((s) => s.status === MembershipStatus.ACTIVE).length;
      const frozen = (res.items || []).filter((s) => s.status === MembershipStatus.FROZEN).length;
      setKpiActive(active);
      setKpiFrozen(frozen);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, expiringFilter]);

  const loadPrerequisites = useCallback(async () => {
    try {
      const [plansRes, membersRes] = await Promise.all([
        apiClient<PaginatedResult<MembershipPlanData>>("/memberships/plans?status=ACTIVE&limit=100"),
        apiClient<PaginatedResult<MemberData>>("/members?limit=100"),
      ]);
      setPlans(plansRes.items || []);
      setMembers(membersRes.items || []);
      if (plansRes.items && plansRes.items.length > 0) {
        setAssignPlanId(plansRes.items[0].id);
      }
      if (branches && branches.length > 0) {
        setAssignBranchId(branches[0].id);
      }
    } catch {
      // non-blocking
    }
  }, [branches]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (isAuthenticated) {
      fetchSubscriptions();
      loadPrerequisites();
    }
  }, [authLoading, isAuthenticated, fetchSubscriptions, loadPrerequisites, router]);

  // Handle Assign Membership
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!assignMemberId) {
      setModalError("Please select a target member");
      return;
    }
    if (!assignPlanId) {
      setModalError("Please select a membership plan");
      return;
    }
    if (!assignBranchId) {
      setModalError("Please select a home branch");
      return;
    }

    try {
      setModalLoading(true);
      await apiClient("/memberships/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          memberId: assignMemberId,
          planId: assignPlanId,
          homeBranchId: assignBranchId,
          startDate: assignStartDate,
          discountAmount: Number(assignDiscount || 0),
          discountReason: assignDiscountReason.trim() || undefined,
          taxRate: Number(assignTaxRate || 0),
          notes: assignNotes.trim() || undefined,
        }),
      });
      setShowAssignModal(false);
      await fetchSubscriptions();
    } catch (err: unknown) {
      setModalError((err as Error).message || "Failed to assign membership");
    } finally {
      setModalLoading(false);
    }
  };

  // Handle Renew Membership
  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;
    setModalError(null);

    try {
      setModalLoading(true);
      await apiClient(`/memberships/subscriptions/${selectedSub.id}/renew`, {
        method: "POST",
        body: JSON.stringify({
          planId: renewPlanId || undefined,
          startDate: renewStartDate || undefined,
          discountAmount: Number(renewDiscount || 0),
          taxRate: Number(renewTaxRate || 0),
        }),
      });
      setShowRenewModal(false);
      setSelectedSub(null);
      await fetchSubscriptions();
    } catch (err: unknown) {
      setModalError((err as Error).message || "Failed to renew membership");
    } finally {
      setModalLoading(false);
    }
  };

  // Handle Freeze Membership
  const handleFreezeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;
    setModalError(null);

    try {
      setModalLoading(true);
      await apiClient(`/memberships/subscriptions/${selectedSub.id}/freeze`, {
        method: "POST",
        body: JSON.stringify({
          startDate: freezeStartDate,
          endDate: freezeEndDate || undefined,
          reason: freezeReason.trim() || undefined,
        }),
      });
      setShowFreezeModal(false);
      setSelectedSub(null);
      await fetchSubscriptions();
    } catch (err: unknown) {
      setModalError((err as Error).message || "Failed to freeze membership");
    } finally {
      setModalLoading(false);
    }
  };

  // Handle Thaw Membership
  const handleThawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;
    setModalError(null);

    try {
      setModalLoading(true);
      await apiClient(`/memberships/subscriptions/${selectedSub.id}/thaw`, {
        method: "POST",
        body: JSON.stringify({
          thawDate: thawDate || undefined,
          reason: thawReason.trim() || undefined,
        }),
      });
      setShowThawModal(false);
      setSelectedSub(null);
      await fetchSubscriptions();
    } catch (err: unknown) {
      setModalError((err as Error).message || "Failed to thaw membership");
    } finally {
      setModalLoading(false);
    }
  };

  // Handle Cancel Membership
  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub) return;
    if (!cancelReason.trim()) {
      setModalError("Cancellation reason is mandatory");
      return;
    }

    try {
      setModalLoading(true);
      await apiClient(`/memberships/subscriptions/${selectedSub.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({
          reason: cancelReason.trim(),
        }),
      });
      setShowCancelModal(false);
      setSelectedSub(null);
      await fetchSubscriptions();
    } catch (err: unknown) {
      setModalError((err as Error).message || "Failed to cancel membership");
    } finally {
      setModalLoading(false);
    }
  };

  // Helper calculation for assign modal price preview
  const selectedPlanObj = plans.find((p) => p.id === assignPlanId);
  const basePrice = selectedPlanObj ? Number(selectedPlanObj.price) : 0;
  const regFee = selectedPlanObj ? Number(selectedPlanObj.registrationFee) : 0;
  const subtotal = Math.max(0, basePrice + regFee - Number(assignDiscount || 0));
  const calcTax = Math.round((subtotal * (Number(assignTaxRate || 0) / 100)) * 100) / 100;
  const estimatedFinalPrice = Math.round((subtotal + calcTax) * 100) / 100;

  const getStatusBadge = (status: MembershipStatus) => {
    switch (status) {
      case MembershipStatus.ACTIVE:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> Active
          </span>
        );
      case MembershipStatus.FROZEN:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            <PauseCircle className="h-3 w-3" /> Frozen
          </span>
        );
      case MembershipStatus.PENDING:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
            <Clock className="h-3 w-3" /> Pending
          </span>
        );
      case MembershipStatus.EXPIRED:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            <AlertCircle className="h-3 w-3" /> Expired
          </span>
        );
      case MembershipStatus.CANCELLED:
      case MembershipStatus.TERMINATED:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300">
            <Ban className="h-3 w-3" /> {status}
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const isExpiringSoon = (endDateStr: string) => {
    const end = new Date(endDateStr);
    const now = new Date();
    const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  };

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6">
      {/* Top Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            Subscriptions & Memberships
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Track active passes, manage renewals, handle freeze requests, and inspect immutable pricing snapshots.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/memberships/plans">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Manage Plans
            </Button>
          </Link>

          {hasPermission(Permission.MEMBER_SUBSCRIPTION_ASSIGN) && (
            <Button
              onClick={() => {
                setModalError(null);
                setShowAssignModal(true);
              }}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Assign Membership
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">Active</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {kpiActive}
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setExpiringFilter(!expiringFilter)}
          className={`border cursor-pointer transition-colors shadow-sm ${
            expiringFilter
              ? "border-amber-400 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-950/20"
              : "border-zinc-200 dark:border-zinc-800"
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Expiring Soon (&lt;7d)
              </span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {subscriptions.filter((s) => s.status === MembershipStatus.ACTIVE && isExpiringSoon(s.endDate)).length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">Frozen</span>
              <PauseCircle className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {kpiFrozen}
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">Total Listed</span>
              <CreditCard className="h-4 w-4 text-zinc-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {totalCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters bar */}
      <Card className="mb-6 border-zinc-200 dark:border-zinc-800 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Filter className="h-3.5 w-3.5" />
              <span>Filter:</span>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="FROZEN">Frozen</option>
              <option value="PENDING">Pending</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {expiringFilter && (
              <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 text-xs px-2.5 py-1 rounded-md">
                Expiring in 7 days
                <button
                  onClick={() => setExpiringFilter(false)}
                  className="ml-1 text-amber-600 hover:text-amber-800"
                >
                  ✕
                </button>
              </span>
            )}
          </div>

          <div className="w-full sm:w-72 relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search member, number, or plan..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-9 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions Table */}
      <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Validity Dates</th>
                <th className="px-4 py-3 font-medium">Pricing Snapshot</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    Loading subscriptions...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    No subscriptions found matching your query.
                  </td>
                </tr>
              ) : (
                subscriptions.map((s) => {
                  const expiring = s.status === MembershipStatus.ACTIVE && isExpiringSoon(s.endDate);
                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Member */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/members/${s.memberId}`}
                          className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1.5"
                        >
                          {s.memberName || "Unknown Member"}
                          <ExternalLink className="h-3 w-3 text-zinc-400 opacity-60" />
                        </Link>
                        <div className="font-mono text-[10px] text-zinc-400">
                          {s.memberNumber}
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {s.planName}
                        </div>
                        <div className="font-mono text-[10px] text-zinc-400">
                          {s.planCode}
                        </div>
                      </td>

                      {/* Branch */}
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                        {s.homeBranchName || "—"}
                      </td>

                      {/* Dates */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                          <span>{s.startDate}</span>
                          <span className="text-zinc-400">→</span>
                          <span className="font-medium">{s.endDate}</span>
                        </div>
                        {expiring && (
                          <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                            ⚡ Expiring soon
                          </div>
                        )}
                        {s.totalFreezeDaysUsed > 0 && (
                          <div className="text-[10px] text-blue-600 dark:text-blue-400">
                            +{s.totalFreezeDaysUsed}d shifted (frozen)
                          </div>
                        )}
                      </td>

                      {/* Pricing Snapshot */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          ₹{s.finalPrice.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          Base: ₹{s.basePrice}
                          {s.discountAmount > 0 && ` - ₹${s.discountAmount}`}
                          {s.taxAmount > 0 && ` + ₹${s.taxAmount} tax`}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">{getStatusBadge(s.status)}</td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* Renew button */}
                          {hasPermission(Permission.MEMBER_SUBSCRIPTION_RENEW) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedSub(s);
                                setRenewPlanId(s.planId);
                                setRenewStartDate("");
                                setRenewDiscount(0);
                                setRenewTaxRate(0);
                                setModalError(null);
                                setShowRenewModal(true);
                              }}
                              className="h-7 px-2 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              title="Renew subscription"
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Renew
                            </Button>
                          )}

                          {/* Freeze / Thaw button */}
                          {hasPermission(Permission.MEMBER_SUBSCRIPTION_FREEZE) && (
                            <>
                              {s.status === MembershipStatus.ACTIVE && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedSub(s);
                                    setFreezeStartDate(new Date().toISOString().split("T")[0]);
                                    setFreezeEndDate("");
                                    setFreezeReason("");
                                    setModalError(null);
                                    setShowFreezeModal(true);
                                  }}
                                  className="h-7 px-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                  title="Freeze subscription"
                                >
                                  <PauseCircle className="h-3.5 w-3.5 mr-1" /> Freeze
                                </Button>
                              )}

                              {s.status === MembershipStatus.FROZEN && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedSub(s);
                                    setThawDate(new Date().toISOString().split("T")[0]);
                                    setThawReason("");
                                    setModalError(null);
                                    setShowThawModal(true);
                                  }}
                                  className="h-7 px-2 text-xs text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
                                  title="Thaw subscription"
                                >
                                  <PlayCircle className="h-3.5 w-3.5 mr-1" /> Thaw
                                </Button>
                              )}
                            </>
                          )}

                          {/* Cancel button */}
                          {hasPermission(Permission.MEMBER_SUBSCRIPTION_CANCEL) &&
                            (s.status === MembershipStatus.ACTIVE || s.status === MembershipStatus.FROZEN) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedSub(s);
                                  setCancelReason("");
                                  setModalError(null);
                                  setShowCancelModal(true);
                                }}
                                className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                title="Cancel subscription"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
            <div>
              Page {page} of {totalPages} ({totalCount} total)
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* --------------------------------------------------------------------- */}
      {/* ASSIGN MEMBERSHIP MODAL                                               */}
      {/* --------------------------------------------------------------------- */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl my-8">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Assign Membership
              </h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {modalError}
              </div>
            )}

            <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
              {/* Member Selection */}
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Target Member *
                </label>
                <select
                  required
                  value={assignMemberId}
                  onChange={(e) => setAssignMemberId(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">Select a member...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName} ({m.memberNumber}) - {m.phone}
                    </option>
                  ))}
                </select>
              </div>

              {/* Plan Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Membership Plan *
                  </label>
                  <select
                    required
                    value={assignPlanId}
                    onChange={(e) => setAssignPlanId(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-zinc-100"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.price})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Home Branch *
                  </label>
                  <select
                    required
                    value={assignBranchId}
                    onChange={(e) => setAssignBranchId(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-zinc-100"
                  >
                    {branches?.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={assignStartDate}
                  onChange={(e) => setAssignStartDate(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              {/* Pricing & Discount */}
              <div className="grid grid-cols-3 gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Discount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={assignDiscount}
                    onChange={(e) => setAssignDiscount(Number(e.target.value))}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={assignTaxRate}
                    onChange={(e) => setAssignTaxRate(Number(e.target.value))}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-500 mb-1">Final Amount</label>
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 py-1">
                    ₹{estimatedFinalPrice.toLocaleString("en-IN")}
                  </div>
                </div>

                {assignDiscount > 0 && (
                  <div className="col-span-3">
                    <input
                      type="text"
                      placeholder="Discount reason (e.g. Founder promotion)"
                      value={assignDiscountReason}
                      onChange={(e) => setAssignDiscountReason(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="Optional internal remarks..."
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAssignModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={modalLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {modalLoading ? "Assigning..." : "Confirm & Assign"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* RENEW MEMBERSHIP MODAL                                                */}
      {/* --------------------------------------------------------------------- */}
      {showRenewModal && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl my-8">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Renew Membership
              </h2>
              <button
                onClick={() => setShowRenewModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {modalError}
              </div>
            )}

            <div className="mb-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3 text-xs space-y-1">
              <div>
                <span className="text-zinc-500">Member:</span>{" "}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {selectedSub.memberName}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Current Expiry:</span>{" "}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {selectedSub.endDate}
                </span>
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                Seamless chaining automatically starts the renewal cycle the day after current expiry.
              </div>
            </div>

            <form onSubmit={handleRenewSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Plan
                </label>
                <select
                  value={renewPlanId}
                  onChange={(e) => setRenewPlanId(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-zinc-100"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (₹{p.price})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Custom Start Date (Optional)
                </label>
                <input
                  type="date"
                  placeholder="Defaults to day after expiry"
                  value={renewStartDate}
                  onChange={(e) => setRenewStartDate(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Discount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={renewDiscount}
                    onChange={(e) => setRenewDiscount(Number(e.target.value))}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={renewTaxRate}
                    onChange={(e) => setRenewTaxRate(Number(e.target.value))}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRenewModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={modalLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {modalLoading ? "Renewing..." : "Confirm Renewal"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* FREEZE MEMBERSHIP MODAL                                               */}
      {/* --------------------------------------------------------------------- */}
      {showFreezeModal && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl my-8">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Freeze Membership
              </h2>
              <button
                onClick={() => setShowFreezeModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {modalError}
              </div>
            )}

            <div className="mb-4 rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3 text-xs space-y-1 text-blue-800 dark:text-blue-200">
              <div className="font-semibold flex items-center gap-1">
                <Info className="h-3.5 w-3.5" /> Date Shifting Policy
              </div>
              <p className="text-[11px] leading-relaxed">
                When thawed, the membership validity is pushed forward by the exact number of days spent on hold.
              </p>
            </div>

            <form onSubmit={handleFreezeSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Freeze Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={freezeStartDate}
                  onChange={(e) => setFreezeStartDate(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Expected Resume Date (Optional)
                </label>
                <input
                  type="date"
                  value={freezeEndDate}
                  onChange={(e) => setFreezeEndDate(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Reason for Freeze
                </label>
                <input
                  type="text"
                  placeholder="Medical leave, travel, exam, etc."
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFreezeModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={modalLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {modalLoading ? "Freezing..." : "Confirm Freeze"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* THAW MEMBERSHIP MODAL                                                 */}
      {/* --------------------------------------------------------------------- */}
      {showThawModal && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl my-8">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Thaw Membership
              </h2>
              <button
                onClick={() => setShowThawModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {modalError}
              </div>
            )}

            <div className="mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs space-y-1 text-emerald-800 dark:text-emerald-200">
              <div className="font-semibold">Resume Active Pass</div>
              <p className="text-[11px] leading-relaxed">
                Resuming membership will calculate the exact days spent on hold and shift the end date forward accordingly.
              </p>
            </div>

            <form onSubmit={handleThawSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Actual Thaw Date *
                </label>
                <input
                  type="date"
                  required
                  value={thawDate}
                  onChange={(e) => setThawDate(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Remarks / Reason
                </label>
                <input
                  type="text"
                  placeholder="Returned early, resumed training..."
                  value={thawReason}
                  onChange={(e) => setThawReason(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowThawModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={modalLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {modalLoading ? "Thawing..." : "Thaw & Shift Validity"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* CANCEL MEMBERSHIP MODAL                                               */}
      {/* --------------------------------------------------------------------- */}
      {showCancelModal && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl my-8">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-red-600 dark:text-red-400">
                Cancel Membership
              </h2>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {modalError}
              </div>
            )}

            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-800 dark:text-red-200">
              Are you sure you want to cancel the membership for{" "}
              <strong>{selectedSub.memberName}</strong> ({selectedSub.planName})?
              This action terminates gym floor access immediately.
            </div>

            <form onSubmit={handleCancelSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Cancellation Reason *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Relocation, refund requested, policy breach..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCancelModal(false)}
                >
                  Keep Active
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={modalLoading}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {modalLoading ? "Cancelling..." : "Confirm Cancellation"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
