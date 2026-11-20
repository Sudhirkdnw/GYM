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
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  Calendar,
  Layers,
  ArrowRight,
  Loader2,
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        );
      case MembershipStatus.FROZEN:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <PauseCircle className="w-3 h-3 text-blue-500" />
            Frozen
          </span>
        );
      case MembershipStatus.PENDING:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3 text-amber-500" />
            Pending
          </span>
        );
      case MembershipStatus.EXPIRED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
            <AlertCircle className="w-3 h-3" />
            Expired
          </span>
        );
      case MembershipStatus.CANCELLED:
      case MembershipStatus.TERMINATED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-500 border border-red-500/20">
            <Ban className="w-3 h-3" />
            {status}
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

  const isExpiringSoon = (endDateStr: string) => {
    const end = new Date(endDateStr);
    const now = new Date();
    const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-primary" />
              Subscriptions & Memberships
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {totalCount} Total
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Track active passes, manage renewals, handle freeze requests, and inspect immutable pricing snapshots.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/memberships/plans"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-card border border-border hover:bg-accent/50 text-foreground transition-colors shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Manage Plans
          </Link>

          {hasPermission(Permission.MEMBER_SUBSCRIPTION_ASSIGN) && (
            <button
              onClick={() => {
                setModalError(null);
                setShowAssignModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all"
            >
              <Plus className="h-4 w-4" /> Assign Membership
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Active Passes</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {kpiActive}
          </div>
        </div>

        <div
          onClick={() => setExpiringFilter(!expiringFilter)}
          className={`rounded-2xl border p-4 shadow-sm cursor-pointer transition-all ${
            expiringFilter
              ? "border-amber-500/40 bg-amber-500/10"
              : "border-border/60 bg-card/60 backdrop-blur-xl hover:bg-accent/40"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-amber-500">
            <span>Expiring Soon (&lt;7d)</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {subscriptions.filter((s) => s.status === MembershipStatus.ACTIVE && isExpiringSoon(s.endDate)).length}
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Frozen On Hold</span>
            <PauseCircle className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {kpiFrozen}
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total Listed</span>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {totalCount}
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Filter className="h-3.5 w-3.5 text-primary" />
              <span>Status:</span>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-border bg-background/50 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="FROZEN">Frozen</option>
              <option value="PENDING">Pending</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {expiringFilter && (
              <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs px-3 py-1 rounded-full font-semibold">
                Expiring in 7 days
                <button
                  onClick={() => setExpiringFilter(false)}
                  className="hover:text-amber-400 font-bold ml-0.5"
                >
                  ✕
                </button>
              </span>
            )}
          </div>

          <div className="w-full sm:w-72 relative">
            <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search member, number, or plan..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-border bg-background/50 pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 uppercase tracking-wider text-[10px] text-muted-foreground font-semibold border-b border-border/60">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Validity Dates</th>
                <th className="px-4 py-3">Pricing Snapshot</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    <p className="font-semibold text-foreground text-xs">Loading subscriptions...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-red-500">
                    {error}
                  </td>
                </tr>
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    <CreditCard className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="font-semibold text-foreground text-sm">No subscriptions found</p>
                    <p className="text-xs text-muted-foreground mt-1">Try resetting filters or search criteria.</p>
                  </td>
                </tr>
              ) : (
                subscriptions.map((s) => {
                  const expiring = s.status === MembershipStatus.ACTIVE && isExpiringSoon(s.endDate);
                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-accent/40 transition-colors group"
                    >
                      {/* Member */}
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/dashboard/members/${s.memberId}`}
                          className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                          {s.memberName || "Unknown Member"}
                          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-60" />
                        </Link>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {s.memberNumber}
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-foreground">
                          {s.planName}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {s.planCode}
                        </div>
                      </td>

                      {/* Branch */}
                      <td className="px-4 py-3.5 text-muted-foreground font-medium">
                        {s.homeBranchName || "—"}
                      </td>

                      {/* Dates */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-foreground font-medium">
                          <span>{s.startDate}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-bold">{s.endDate}</span>
                        </div>
                        {expiring && (
                          <div className="text-[11px] font-bold text-amber-500 mt-0.5 flex items-center gap-1">
                            ⚡ Expiring in &lt;7d
                          </div>
                        )}
                        {s.totalFreezeDaysUsed > 0 && (
                          <div className="text-[11px] text-blue-500 mt-0.5">
                            +{s.totalFreezeDaysUsed}d shifted (frozen)
                          </div>
                        )}
                      </td>

                      {/* Pricing Snapshot */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold font-mono text-foreground text-sm">
                          ₹{s.finalPrice.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Base: ₹{s.basePrice}
                          {s.discountAmount > 0 && ` - ₹${s.discountAmount}`}
                          {s.taxAmount > 0 && ` + ₹${s.taxAmount} tax`}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">{getStatusBadge(s.status)}</td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Renew button */}
                          {hasPermission(Permission.MEMBER_SUBSCRIPTION_RENEW) && (
                            <button
                              onClick={() => {
                                setSelectedSub(s);
                                setRenewPlanId(s.planId);
                                setRenewStartDate("");
                                setRenewDiscount(0);
                                setRenewTaxRate(0);
                                setModalError(null);
                                setShowRenewModal(true);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="Renew subscription"
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Renew
                            </button>
                          )}

                          {/* Freeze / Thaw button */}
                          {hasPermission(Permission.MEMBER_SUBSCRIPTION_FREEZE) && (
                            <>
                              {s.status === MembershipStatus.ACTIVE && (
                                <button
                                  onClick={() => {
                                    setSelectedSub(s);
                                    setFreezeStartDate(new Date().toISOString().split("T")[0]);
                                    setFreezeEndDate("");
                                    setFreezeReason("");
                                    setModalError(null);
                                    setShowFreezeModal(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 text-xs font-semibold flex items-center gap-1 transition-colors"
                                  title="Freeze subscription"
                                >
                                  <PauseCircle className="h-3.5 w-3.5" /> Freeze
                                </button>
                              )}

                              {s.status === MembershipStatus.FROZEN && (
                                <button
                                  onClick={() => {
                                    setSelectedSub(s);
                                    setThawDate(new Date().toISOString().split("T")[0]);
                                    setThawReason("");
                                    setModalError(null);
                                    setShowThawModal(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20 text-xs font-semibold flex items-center gap-1 transition-colors"
                                  title="Thaw subscription"
                                >
                                  <PlayCircle className="h-3.5 w-3.5" /> Thaw
                                </button>
                              )}
                            </>
                          )}

                          {/* Cancel button */}
                          {hasPermission(Permission.MEMBER_SUBSCRIPTION_CANCEL) &&
                            (s.status === MembershipStatus.ACTIVE || s.status === MembershipStatus.FROZEN) && (
                              <button
                                onClick={() => {
                                  setSelectedSub(s);
                                  setCancelReason("");
                                  setModalError(null);
                                  setShowCancelModal(true);
                                }}
                                className="p-1 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                                title="Cancel subscription"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
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
          <div className="p-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
            <div>
              Page <span className="font-semibold text-foreground">{page}</span> of{" "}
              <span className="font-semibold text-foreground">{totalPages}</span> ({totalCount} total)
            </div>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-accent disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-accent disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ASSIGN MEMBERSHIP MODAL */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl my-8 animate-scaleIn">
            <div className="mb-4 flex items-center justify-between border-b border-border/40 pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Assign Membership
              </h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
              {/* Member Selection */}
              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Target Member <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={assignMemberId}
                  onChange={(e) => setAssignMemberId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                  <label className="block font-semibold text-foreground mb-1.5">
                    Membership Plan <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={assignPlanId}
                    onChange={(e) => setAssignPlanId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.price})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1.5">
                    Home Branch <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={assignBranchId}
                    onChange={(e) => setAssignBranchId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                <label className="block font-semibold text-foreground mb-1.5">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={assignStartDate}
                  onChange={(e) => setAssignStartDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Pricing & Discount */}
              <div className="grid grid-cols-3 gap-3 bg-muted/20 p-3.5 rounded-xl border border-border/60">
                <div>
                  <label className="block font-semibold text-foreground mb-1.5">
                    Discount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={assignDiscount}
                    onChange={(e) => setAssignDiscount(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1.5">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={assignTaxRate}
                    onChange={(e) => setAssignTaxRate(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted-foreground mb-1.5">Final Total</label>
                  <div className="text-base font-bold font-mono text-emerald-500 py-1">
                    ₹{estimatedFinalPrice.toLocaleString("en-IN")}
                  </div>
                </div>

                {assignDiscount > 0 && (
                  <div className="col-span-3 pt-1">
                    <input
                      type="text"
                      placeholder="Discount reason (e.g. Founder promotion)"
                      value={assignDiscountReason}
                      onChange={(e) => setAssignDiscountReason(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-foreground"
                    />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="Optional remarks..."
                  className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50"
                >
                  {modalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm & Assign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENEW MEMBERSHIP MODAL */}
      {showRenewModal && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl my-8 animate-scaleIn">
            <div className="mb-4 flex items-center justify-between border-b border-border/40 pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-primary" />
                Renew Membership
              </h2>
              <button
                onClick={() => setShowRenewModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="mb-4 rounded-xl bg-muted/20 border border-border/60 p-3 text-xs space-y-1">
              <div>
                <span className="text-muted-foreground">Member:</span>{" "}
                <span className="font-semibold text-foreground">
                  {selectedSub.memberName}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Current Expiry:</span>{" "}
                <span className="font-semibold text-foreground">
                  {selectedSub.endDate}
                </span>
              </div>
              <div className="text-[11px] text-emerald-500 font-medium">
                Seamless chaining automatically starts the renewal cycle the day after current expiry.
              </div>
            </div>

            <form onSubmit={handleRenewSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Plan
                </label>
                <select
                  value={renewPlanId}
                  onChange={(e) => setRenewPlanId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (₹{p.price})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Custom Start Date (Optional)
                </label>
                <input
                  type="date"
                  placeholder="Defaults to day after expiry"
                  value={renewStartDate}
                  onChange={(e) => setRenewStartDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1.5">
                    Discount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={renewDiscount}
                    onChange={(e) => setRenewDiscount(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1.5">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={renewTaxRate}
                    onChange={(e) => setRenewTaxRate(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-foreground font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setShowRenewModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50"
                >
                  {modalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm Renewal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FREEZE MEMBERSHIP MODAL */}
      {showFreezeModal && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl my-8 animate-scaleIn">
            <div className="mb-4 flex items-center justify-between border-b border-border/40 pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <PauseCircle className="h-4 w-4 text-blue-500" />
                Freeze Membership
              </h2>
              <button
                onClick={() => setShowFreezeModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="mb-4 rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-500 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" /> Date Shifting Policy
              </div>
              <p className="text-[11px] leading-relaxed">
                When thawed, the membership validity is pushed forward by the exact number of days spent on hold.
              </p>
            </div>

            <form onSubmit={handleFreezeSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Freeze Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={freezeStartDate}
                  onChange={(e) => setFreezeStartDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Expected Resume Date (Optional)
                </label>
                <input
                  type="date"
                  value={freezeEndDate}
                  onChange={(e) => setFreezeEndDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Reason for Freeze
                </label>
                <input
                  type="text"
                  placeholder="Medical leave, travel, exam, etc."
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setShowFreezeModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50"
                >
                  {modalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm Freeze"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* THAW MEMBERSHIP MODAL */}
      {showThawModal && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl my-8 animate-scaleIn">
            <div className="mb-4 flex items-center justify-between border-b border-border/40 pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-emerald-500" />
                Thaw Membership
              </h2>
              <button
                onClick={() => setShowThawModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-500 space-y-1">
              <div className="font-semibold">Resume Active Pass</div>
              <p className="text-[11px] leading-relaxed">
                Resuming membership will calculate the exact days spent on hold and shift the end date forward accordingly.
              </p>
            </div>

            <form onSubmit={handleThawSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Actual Thaw Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={thawDate}
                  onChange={(e) => setThawDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Remarks / Reason
                </label>
                <input
                  type="text"
                  placeholder="Returned early, resumed training..."
                  value={thawReason}
                  onChange={(e) => setThawReason(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setShowThawModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50"
                >
                  {modalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Thaw & Shift Validity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL MEMBERSHIP MODAL */}
      {showCancelModal && selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-card p-6 shadow-2xl my-8 animate-scaleIn">
            <div className="mb-4 flex items-center justify-between border-b border-border/40 pb-3">
              <h2 className="text-base font-bold text-red-500 flex items-center gap-2">
                <Ban className="h-4 w-4" />
                Cancel Membership
              </h2>
              <button
                onClick={() => setShowCancelModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-500">
              Are you sure you want to cancel the membership for{" "}
              <strong>{selectedSub.memberName}</strong> ({selectedSub.planName})?
              This action terminates gym floor access immediately.
            </div>

            <form onSubmit={handleCancelSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Cancellation Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Relocation, refund requested, policy breach..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-accent"
                >
                  Keep Active
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm disabled:opacity-50"
                >
                  {modalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
