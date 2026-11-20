"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import {
  MembershipPlanData,
  PlanDurationType,
  PlanScope,
  PlanStatus,
  Permission,
  PaginatedResult,
} from "@gymos/shared-types";
import {
  Plus,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Building2,
  Shield,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Filter,
  Search,
  X,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";

export default function MembershipPlansPage() {
  const router = useRouter();
  const { organization, branches, isAuthenticated, isLoading: authLoading } = useAuth();

  const [plans, setPlans] = useState<MembershipPlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [scopeFilter, setScopeFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [durationType, setDurationType] = useState<PlanDurationType>(PlanDurationType.MONTHS);
  const [durationValue, setDurationValue] = useState<number>(1);
  const [price, setPrice] = useState<number>(1999);
  const [registrationFee, setRegistrationFee] = useState<number>(0);
  const [scope, setScope] = useState<PlanScope>(PlanScope.SINGLE_BRANCH);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [maxFreezeDays, setMaxFreezeDays] = useState<number>(15);
  const [maxFreezes, setMaxFreezes] = useState<number>(1);
  const [gracePeriodDays, setGracePeriodDays] = useState<number>(3);
  const [featuresInput, setFeaturesInput] = useState<string>("Gym Floor Access, Locker Room, Steam Bath");

  const hasPermission = (p: Permission) => {
    return organization?.permissions.includes(p) || false;
  };

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (scopeFilter !== "ALL") params.append("scope", scopeFilter);
      if (search.trim()) params.append("search", search.trim());

      const res = await apiClient<PaginatedResult<MembershipPlanData>>(
        `/memberships/plans?${params.toString()}`
      );
      setPlans(res.items || []);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load membership plans");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, scopeFilter, search]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (isAuthenticated) {
      fetchPlans();
    }
  }, [authLoading, isAuthenticated, fetchPlans, router]);

  const handleToggleStatus = async (plan: MembershipPlanData) => {
    const nextStatus = plan.status === PlanStatus.ACTIVE ? PlanStatus.INACTIVE : PlanStatus.ACTIVE;
    try {
      await apiClient(`/memberships/plans/${plan.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await fetchPlans();
    } catch (err: unknown) {
      alert((err as Error).message || "Failed to update plan status");
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Plan name is required");
      return;
    }
    if (!code.trim()) {
      setFormError("Plan code is required");
      return;
    }

    const features = featuresInput
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    try {
      setSubmitting(true);
      await apiClient("/memberships/plans", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim() || undefined,
          durationType,
          durationValue: Number(durationValue),
          price: Number(price),
          registrationFee: Number(registrationFee || 0),
          currency: "INR",
          scope,
          branchIds: scope !== PlanScope.ALL_BRANCHES ? selectedBranchIds : undefined,
          maxFreezeDays: Number(maxFreezeDays || 0),
          maxFreezes: Number(maxFreezes || 0),
          gracePeriodDays: Number(gracePeriodDays || 0),
          features,
        }),
      });

      setShowModal(false);
      resetForm();
      await fetchPlans();
    } catch (err: unknown) {
      setFormError((err as Error).message || "Failed to create membership plan");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setCode("");
    setDescription("");
    setDurationType(PlanDurationType.MONTHS);
    setDurationValue(1);
    setPrice(1999);
    setRegistrationFee(0);
    setScope(PlanScope.SINGLE_BRANCH);
    setSelectedBranchIds([]);
    setMaxFreezeDays(15);
    setMaxFreezes(1);
    setGracePeriodDays(3);
    setFeaturesInput("Gym Floor Access, Locker Room");
    setFormError(null);
  };

  const formatDuration = (type: PlanDurationType, val: number) => {
    if (type === PlanDurationType.DAYS) return `${val} Day${val > 1 ? "s" : ""}`;
    if (type === PlanDurationType.MONTHS) return `${val} Month${val > 1 ? "s" : ""}`;
    if (type === PlanDurationType.YEARS) return `${val} Year${val > 1 ? "s" : ""}`;
    return `${val} ${type}`;
  };

  const getScopeBadge = (sc: PlanScope) => {
    switch (sc) {
      case PlanScope.ALL_BRANCHES:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold">
            <Building2 className="h-3 w-3" /> All Branches
          </span>
        );
      case PlanScope.MULTI_BRANCH:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 text-[10px] font-semibold">
            <Layers className="h-3 w-3" /> Multi-Branch
          </span>
        );
      case PlanScope.SINGLE_BRANCH:
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5 text-[10px] font-semibold">
            Single Branch
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top Header */}
      <div>
        <Link
          href="/dashboard/memberships"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Subscriptions
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Membership Plans & Packages
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {plans.length} Packages
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Configure packages, durations, pricing snapshots, freeze policies, and branch privileges.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasPermission(Permission.MEMBERSHIP_PLAN_MANAGE) && (
              <button
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all"
              >
                <Plus className="h-4 w-4" /> Create Plan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Filter className="h-3.5 w-3.5 text-primary" />
              <span>Filters:</span>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-border bg-background/50 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              className="rounded-xl border border-border bg-background/50 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="ALL">All Scopes</option>
              <option value="SINGLE_BRANCH">Single Branch</option>
              <option value="MULTI_BRANCH">Multi Branch</option>
              <option value="ALL_BRANCHES">All Branches</option>
            </select>
          </div>

          <div className="w-full sm:w-64 relative">
            <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search plan name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border bg-background/50 pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Plans List */}
      {loading ? (
        <div className="py-20 text-center text-xs text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
          Loading membership plans...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-500">
          {error}
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-16 text-center shadow-sm">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
          <h3 className="text-base font-bold text-foreground">
            No membership plans found
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            Create your gym&apos;s first membership package with custom duration, pricing, and freeze rules.
          </p>
          {hasPermission(Permission.MEMBERSHIP_PLAN_MANAGE) && (
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" /> Create First Plan
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl border transition-all duration-200 shadow-sm relative overflow-hidden backdrop-blur-xl flex flex-col justify-between ${
                p.status === PlanStatus.ACTIVE
                  ? "border-border/60 bg-card/60 hover:border-primary/40 hover:shadow-md"
                  : "border-border/40 bg-card/30 opacity-75"
              }`}
            >
              <div className="p-5 pb-4 border-b border-border/40">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      {p.name}
                    </h3>
                    <span className="font-mono text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {p.code}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {getScopeBadge(p.scope)}
                    {p.status === PlanStatus.ACTIVE ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        <XCircle className="h-3 w-3" /> Inactive
                      </span>
                    )}
                  </div>
                </div>

                {/* Price & Duration */}
                <div className="flex items-baseline justify-between pt-2">
                  <div>
                    <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                      ₹{p.price.toLocaleString("en-IN")}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      / {formatDuration(p.durationType, p.durationValue)}
                    </span>
                  </div>
                  {p.registrationFee > 0 && (
                    <span className="text-[11px] text-muted-foreground font-mono">
                      +₹{p.registrationFee.toLocaleString("en-IN")} reg fee
                    </span>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-4 flex-1">
                {/* Description */}
                {p.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {p.description}
                  </p>
                )}

                {/* Policies */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-muted/20 border border-border/60 p-3 rounded-xl">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Max Freezes:</span>
                    <span className="font-semibold text-foreground">
                      {p.maxFreezes > 0 ? `${p.maxFreezes}x (max ${p.maxFreezeDays}d)` : "None"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Grace Period:</span>
                    <span className="font-semibold text-foreground">
                      {p.gracePeriodDays} days
                    </span>
                  </div>
                  {p.subscriberCount !== undefined && (
                    <div className="col-span-2 pt-2 border-t border-border/40">
                      <span className="text-muted-foreground text-[10px]">Active Members:</span>{" "}
                      <span className="font-bold text-emerald-500">
                        {p.subscriberCount} enrolled
                      </span>
                    </div>
                  )}
                </div>

                {/* Features */}
                {p.features && p.features.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                      Included Perks
                    </span>
                    <ul className="text-xs space-y-1 text-foreground">
                      {p.features.slice(0, 3).map((feat, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <Sparkles className="h-3 w-3 text-primary shrink-0" />
                          <span className="truncate">{feat}</span>
                        </li>
                      ))}
                      {p.features.length > 3 && (
                        <li className="text-[11px] text-muted-foreground italic pl-5">
                          +{p.features.length - 3} more perks
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              {/* Card footer actions */}
              {hasPermission(Permission.MEMBERSHIP_PLAN_MANAGE) && (
                <div className="p-4 border-t border-border/40 bg-muted/10 flex items-center justify-end">
                  <button
                    onClick={() => handleToggleStatus(p)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {p.status === PlanStatus.ACTIVE ? (
                      <>
                        <ToggleRight className="h-4 w-4 text-emerald-500" /> Deactivate
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" /> Activate
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Plan Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl my-8 animate-scaleIn">
            <div className="mb-4 flex items-center justify-between border-b border-border/40 pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Create Membership Plan
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePlan} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1.5">
                    Plan Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Premium Annual"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1.5">
                    Plan Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ANN-PREM"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-foreground uppercase focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Summary of plan coverage and perks..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              {/* Duration and Pricing */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/20 p-3.5 rounded-xl border border-border/60">
                <div>
                  <label className="block font-semibold text-foreground mb-1.5">
                    Duration Type
                  </label>
                  <select
                    value={durationType}
                    onChange={(e) => setDurationType(e.target.value as PlanDurationType)}
                    className="w-full rounded-xl border border-border bg-background px-2.5 py-2 text-foreground"
                  >
                    <option value={PlanDurationType.DAYS}>Days</option>
                    <option value={PlanDurationType.MONTHS}>Months</option>
                    <option value={PlanDurationType.YEARS}>Years</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1.5">
                    Duration Value
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={durationValue}
                    onChange={(e) => setDurationValue(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-background px-2.5 py-2 text-foreground font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1.5">
                    Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-background px-2.5 py-2 text-foreground font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1.5">
                    Reg. Fee (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={registrationFee}
                    onChange={(e) => setRegistrationFee(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-background px-2.5 py-2 text-foreground font-mono"
                  />
                </div>
              </div>

              {/* Branch Scope */}
              <div className="space-y-2">
                <label className="block font-semibold text-foreground">
                  Branch Scope
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="scope"
                      value={PlanScope.SINGLE_BRANCH}
                      checked={scope === PlanScope.SINGLE_BRANCH}
                      onChange={() => setScope(PlanScope.SINGLE_BRANCH)}
                    />
                    <span>Single Branch</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="scope"
                      value={PlanScope.MULTI_BRANCH}
                      checked={scope === PlanScope.MULTI_BRANCH}
                      onChange={() => setScope(PlanScope.MULTI_BRANCH)}
                    />
                    <span>Multi Branch</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="scope"
                      value={PlanScope.ALL_BRANCHES}
                      checked={scope === PlanScope.ALL_BRANCHES}
                      onChange={() => setScope(PlanScope.ALL_BRANCHES)}
                    />
                    <span>All Branches</span>
                  </label>
                </div>

                {scope !== PlanScope.ALL_BRANCHES && branches && branches.length > 0 && (
                  <div className="pt-2 border-t border-border/40">
                    <span className="text-[11px] text-muted-foreground mb-1.5 block">
                      Select Permitted Branches:
                    </span>
                    <div className="grid grid-cols-2 gap-2 max-h-28 overflow-y-auto p-1">
                      {branches.map((b) => (
                        <label
                          key={b.id}
                          className="flex items-center gap-2 text-xs text-foreground cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedBranchIds.includes(b.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedBranchIds([...selectedBranchIds, b.id]);
                              } else {
                                setSelectedBranchIds(selectedBranchIds.filter((id) => id !== b.id));
                              }
                            }}
                          />
                          <span className="truncate">{b.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Freezes & Grace Period */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1.5">
                    Max Freezes
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={maxFreezes}
                    onChange={(e) => setMaxFreezes(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1.5">
                    Max Freeze Days
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={maxFreezeDays}
                    onChange={(e) => setMaxFreezeDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1.5">
                    Grace Period (Days)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={gracePeriodDays}
                    onChange={(e) => setGracePeriodDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-foreground font-mono"
                  />
                </div>
              </div>

              {/* Features */}
              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Features / Included Perks (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="Gym Floor, Steam Bath, Personal Locker"
                  value={featuresInput}
                  onChange={(e) => setFeaturesInput(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
