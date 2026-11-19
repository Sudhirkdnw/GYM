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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
            <Building2 className="h-3 w-3" /> All Branches
          </span>
        );
      case PlanScope.MULTI_BRANCH:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            <Layers className="h-3 w-3" /> Multi-Branch
          </span>
        );
      case PlanScope.SINGLE_BRANCH:
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            Single Branch
          </span>
        );
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6">
      {/* Top Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <Link
              href="/dashboard/memberships"
              className="hover:text-zinc-800 dark:hover:text-zinc-300 flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Back to Subscriptions
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            Membership Plans
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Configure packages, durations, pricing snapshots, and branch scopes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission(Permission.MEMBERSHIP_PLAN_MANAGE) && (
            <Button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              <Plus className="h-4 w-4" /> Create Plan
            </Button>
          )}
        </div>
      </div>

      {/* Filters bar */}
      <Card className="mb-6 border-zinc-200 dark:border-zinc-800 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Filter className="h-3.5 w-3.5" />
              <span>Filters:</span>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Scopes</option>
              <option value="SINGLE_BRANCH">Single Branch</option>
              <option value="MULTI_BRANCH">Multi Branch</option>
              <option value="ALL_BRANCHES">All Branches</option>
            </select>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search plan name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Plans List */}
      {loading ? (
        <div className="py-16 text-center text-sm text-zinc-500">Loading plans...</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : plans.length === 0 ? (
        <Card className="border-zinc-200 dark:border-zinc-800 text-center py-16">
          <CardContent className="space-y-3">
            <Shield className="mx-auto h-10 w-10 text-zinc-400" />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              No membership plans found
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Create your gym&apos;s first membership package with custom duration, pricing, and freeze rules.
            </p>
            {hasPermission(Permission.MEMBERSHIP_PLAN_MANAGE) && (
              <Button
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white mt-2"
              >
                Create First Plan
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((p) => (
            <Card
              key={p.id}
              className={`border transition-all duration-200 shadow-sm relative overflow-hidden ${
                p.status === PlanStatus.ACTIVE
                  ? "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                  : "border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/40 opacity-75"
              }`}
            >
              <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800/60 flex flex-row items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      {p.name}
                    </CardTitle>
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-zinc-500 uppercase">
                    CODE: {p.code}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {getScopeBadge(p.scope)}
                  {p.status === PlanStatus.ACTIVE ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      <XCircle className="h-3 w-3" /> Inactive
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {/* Price & Duration */}
                <div className="flex items-baseline justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/60">
                  <div>
                    <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                      ₹{p.price.toLocaleString("en-IN")}
                    </span>
                    <span className="text-xs text-zinc-500 ml-1">
                      / {formatDuration(p.durationType, p.durationValue)}
                    </span>
                  </div>
                  {p.registrationFee > 0 && (
                    <span className="text-[11px] text-zinc-500">
                      +₹{p.registrationFee.toLocaleString("en-IN")} reg fee
                    </span>
                  )}
                </div>

                {/* Description */}
                {p.description && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                    {p.description}
                  </p>
                )}

                {/* Policies */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-md">
                  <div>
                    <span className="text-zinc-500">Freezes:</span>{" "}
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                      {p.maxFreezes > 0 ? `${p.maxFreezes}x (max ${p.maxFreezeDays}d)` : "None"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Grace Period:</span>{" "}
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                      {p.gracePeriodDays} days
                    </span>
                  </div>
                  {p.subscriberCount !== undefined && (
                    <div className="col-span-2 pt-1 border-t border-zinc-200/50 dark:border-zinc-700/50">
                      <span className="text-zinc-500">Subscribers:</span>{" "}
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {p.subscriberCount} active
                      </span>
                    </div>
                  )}
                </div>

                {/* Features */}
                {p.features && p.features.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Included Perks
                    </span>
                    <ul className="text-xs space-y-1 text-zinc-600 dark:text-zinc-300">
                      {p.features.slice(0, 3).map((feat, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span className="truncate">{feat}</span>
                        </li>
                      ))}
                      {p.features.length > 3 && (
                        <li className="text-[11px] text-zinc-400 italic">
                          +{p.features.length - 3} more perks
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Card footer actions */}
                {hasPermission(Permission.MEMBERSHIP_PLAN_MANAGE) && (
                  <div className="pt-2 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/60">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleStatus(p)}
                      className="text-xs gap-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      {p.status === PlanStatus.ACTIVE ? (
                        <>
                          <ToggleRight className="h-4 w-4 text-emerald-600" /> Deactivate
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="h-4 w-4 text-zinc-400" /> Activate
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Plan Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl my-8">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Create Membership Plan
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreatePlan} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Plan Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Premium Annual"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Plan Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ANN-PREM"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-zinc-100 uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Summary of plan coverage and perks..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Duration and Pricing */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Duration Type
                  </label>
                  <select
                    value={durationType}
                    onChange={(e) => setDurationType(e.target.value as PlanDurationType)}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value={PlanDurationType.DAYS}>Days</option>
                    <option value={PlanDurationType.MONTHS}>Months</option>
                    <option value={PlanDurationType.YEARS}>Years</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Duration Value
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={durationValue}
                    onChange={(e) => setDurationValue(Number(e.target.value))}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Reg. Fee (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={registrationFee}
                    onChange={(e) => setRegistrationFee(Number(e.target.value))}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Branch Scope */}
              <div className="space-y-2">
                <label className="block font-medium text-zinc-700 dark:text-zinc-300">
                  Branch Scope
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      value={PlanScope.SINGLE_BRANCH}
                      checked={scope === PlanScope.SINGLE_BRANCH}
                      onChange={() => setScope(PlanScope.SINGLE_BRANCH)}
                    />
                    <span>Single Branch</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      value={PlanScope.MULTI_BRANCH}
                      checked={scope === PlanScope.MULTI_BRANCH}
                      onChange={() => setScope(PlanScope.MULTI_BRANCH)}
                    />
                    <span>Multi Branch</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
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
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <span className="text-[11px] text-zinc-500 mb-1 block">
                      Select Permitted Branches:
                    </span>
                    <div className="grid grid-cols-2 gap-2 max-h-28 overflow-y-auto p-1">
                      {branches.map((b) => (
                        <label
                          key={b.id}
                          className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer"
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
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Max Freezes
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={maxFreezes}
                    onChange={(e) => setMaxFreezes(Number(e.target.value))}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Max Freeze Days
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={maxFreezeDays}
                    onChange={(e) => setMaxFreezeDays(Number(e.target.value))}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Grace Period (Days)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={gracePeriodDays}
                    onChange={(e) => setGracePeriodDays(Number(e.target.value))}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Features */}
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Features / Included Perks (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="Gym Floor, Steam Bath, Personal Locker"
                  value={featuresInput}
                  onChange={(e) => setFeaturesInput(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {submitting ? "Creating..." : "Save Plan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
