"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Check,
  X,
  Layers,
  Sparkles,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface FeatureCatalogItem {
  key: string;
  name: string;
  description: string | null;
  domain: string;
  category: string;
}

interface FeatureCatalogResponse {
  all: FeatureCatalogItem[];
  grouped: Record<string, FeatureCatalogItem[]>;
}

interface SaasPlanWithFeatures {
  id: string;
  code: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  isActive: boolean;
  assignedGymsCount?: number;
  features: Array<{
    featureKey: string;
    domain: string;
    name: string;
    isEnabled: boolean;
    numericQuota: number | null;
  }>;
}

export default function PlatformPlansPage() {
  const [plans, setPlans] = useState<SaasPlanWithFeatures[]>([]);
  const [catalog, setCatalog] = useState<FeatureCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMonthlyPrice, setFormMonthlyPrice] = useState<number>(2999);
  const [formAnnualPrice, setFormAnnualPrice] = useState<number>(29990);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formMemberQuota, setFormMemberQuota] = useState<string>("");
  const [formBranchQuota, setFormBranchQuota] = useState<string>("1");
  const [enabledFeatureKeys, setEnabledFeatureKeys] = useState<Set<string>>(new Set());

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [plansData, catalogRes] = await Promise.all([
        apiClient<SaasPlanWithFeatures[]>("/platform/plans"),
        apiClient<FeatureCatalogResponse | FeatureCatalogItem[]>("/platform/features"),
      ]);
      setPlans(plansData || []);
      const items = Array.isArray(catalogRes)
        ? catalogRes
        : (catalogRes as FeatureCatalogResponse)?.all || [];
      setCatalog(items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load SaaS plans");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingPlanId(null);
    setFormName("");
    setFormCode("");
    setFormDescription("");
    setFormMonthlyPrice(2999);
    setFormAnnualPrice(29990);
    setFormIsActive(true);
    setFormMemberQuota("");
    setFormBranchQuota("1");
    // Default: select core features
    const defaultEnabled = new Set(
      catalog
        .filter((f) => ["CORE", "MEMBERSHIP", "ATTENDANCE", "BILLING"].includes(f.domain))
        .map((f) => f.key),
    );
    setEnabledFeatureKeys(defaultEnabled);
    setModalError(null);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (plan: SaasPlanWithFeatures) => {
    setEditingPlanId(plan.id);
    setFormName(plan.name);
    setFormCode(plan.code);
    setFormDescription(plan.description || "");
    setFormMonthlyPrice(plan.monthlyPrice);
    setFormAnnualPrice(plan.annualPrice);
    setFormIsActive(plan.isActive);

    const memberQuotaFeature = plan.features.find((f) => f.featureKey === "members.manage");
    const branchQuotaFeature = plan.features.find((f) => f.featureKey === "branches.manage");
    setFormMemberQuota(
      memberQuotaFeature?.numericQuota !== null && memberQuotaFeature?.numericQuota !== undefined
        ? String(memberQuotaFeature.numericQuota)
        : "",
    );
    setFormBranchQuota(
      branchQuotaFeature?.numericQuota !== null && branchQuotaFeature?.numericQuota !== undefined
        ? String(branchQuotaFeature.numericQuota)
        : "1",
    );

    const activeKeys = new Set(plan.features.filter((f) => f.isEnabled).map((f) => f.featureKey));
    setEnabledFeatureKeys(activeKeys);
    setModalError(null);
    setIsModalOpen(true);
  };

  // Toggle single feature
  const toggleFeature = (key: string) => {
    const updated = new Set(enabledFeatureKeys);
    if (updated.has(key)) {
      updated.delete(key);
    } else {
      updated.add(key);
    }
    setEnabledFeatureKeys(updated);
  };

  // Domain bulk actions
  const toggleDomain = (domain: string, enable: boolean) => {
    const domainFeatures = catalog.filter((f) => f.domain === domain);
    const updated = new Set(enabledFeatureKeys);
    domainFeatures.forEach((f) => {
      if (enable) {
        updated.add(f.key);
      } else {
        updated.delete(f.key);
      }
    });
    setEnabledFeatureKeys(updated);
  };

  const selectAllFeatures = () => {
    setEnabledFeatureKeys(new Set(catalog.map((f) => f.key)));
  };

  const deselectAllFeatures = () => {
    setEnabledFeatureKeys(new Set());
  };

  // Submit create or update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCode.trim()) {
      setModalError("Plan Name and Code are required");
      return;
    }

    try {
      setIsSubmitting(true);
      setModalError(null);

      // Map features for submission
      const featureList = catalog.map((f) => {
        let numericQuota: number | null = null;
        if (f.key === "members.manage" && formMemberQuota.trim()) {
          numericQuota = parseInt(formMemberQuota.trim(), 10);
        } else if (f.key === "branches.manage" && formBranchQuota.trim()) {
          numericQuota = parseInt(formBranchQuota.trim(), 10);
        }

        return {
          featureKey: f.key,
          isEnabled: enabledFeatureKeys.has(f.key),
          numericQuota: Number.isNaN(numericQuota) ? null : numericQuota,
        };
      });

      const payload = {
        name: formName.trim(),
        code: formCode.trim().toLowerCase(),
        description: formDescription.trim(),
        monthlyPrice: Number(formMonthlyPrice),
        annualPrice: Number(formAnnualPrice),
        currency: "INR",
        isActive: formIsActive,
        features: featureList,
      };

      if (editingPlanId) {
        await apiClient(`/platform/plans/${editingPlanId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiClient("/platform/plans", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Failed to save plan");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete plan
  const handleDelete = async (plan: SaasPlanWithFeatures) => {
    if (plan.assignedGymsCount && plan.assignedGymsCount > 0) {
      alert(
        `Cannot delete "${plan.name}" because ${plan.assignedGymsCount} active gym(s) are currently subscribed to it. Please reassign those gyms to another plan first.`,
      );
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete the plan "${plan.name}" (${plan.code})? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      setDeletingId(plan.id);
      await apiClient(`/platform/plans/${plan.id}`, { method: "DELETE" });
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete plan");
    } finally {
      setDeletingId(null);
    }
  };

  // Group catalog by domain
  const safeCatalog = Array.isArray(catalog) ? catalog : [];
  const domains = Array.from(new Set(safeCatalog.map((f) => f.domain)));

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-6 text-red-400">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            <span>SaaS Subscription Plans</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Super Admin controls commercial plans, pricing, quotas, and feature allocations for all gyms.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs h-9 px-4 shrink-0 gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Create New SaaS Plan</span>
        </Button>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const enabledCount = plan.features.filter((f) => f.isEnabled).length;
          const isEnterprise = plan.code === "enterprise";

          return (
            <div
              key={plan.id}
              className={`rounded-2xl border p-6 flex flex-col justify-between transition-all relative ${
                isEnterprise
                  ? "border-violet-300 dark:border-violet-500/60 bg-gradient-to-b from-violet-50/60 via-white to-white dark:from-violet-950/30 dark:via-[#10111a] dark:to-[#0d0e15] shadow-lg shadow-violet-500/10"
                  : "border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0e0f17] shadow-sm hover:border-violet-500/40"
              }`}
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {plan.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-zinc-400 uppercase">
                        {plan.code}
                      </span>
                      {plan.isActive ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                          Active
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500 font-medium">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(plan)}
                      title="Edit Plan & Features"
                      className="p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(plan)}
                      disabled={deletingId === plan.id}
                      title="Delete Plan"
                      className="p-1.5 rounded-lg text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-3 min-h-[36px]">
                  {plan.description || "Commercial gym operations package"}
                </p>

                {/* Pricing Block */}
                <div className="mt-5 pt-4 border-t border-slate-200 dark:border-white/[0.06] flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    ₹{plan.monthlyPrice.toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">/ month</span>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                  ₹{plan.annualPrice.toLocaleString("en-IN")} billed annually
                </p>

                {/* Quotas & Subscriptions */}
                <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.05] grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 dark:text-zinc-500 block">Subscribed Gyms:</span>
                    <span className="text-slate-900 dark:text-white font-semibold flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                      {plan.assignedGymsCount ?? 0} gyms
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-zinc-500 block">Active Features:</span>
                    <span className="text-slate-900 dark:text-white font-semibold">
                      {enabledCount} / {plan.features.length}
                    </span>
                  </div>
                </div>

                {/* Feature highlights */}
                <div className="mt-5 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Feature Allocation ({enabledCount} Enabled)
                  </p>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {plan.features.slice(0, 10).map((f) => (
                      <div
                        key={f.featureKey}
                        className="flex items-center gap-2 text-xs"
                      >
                        {f.isEnabled ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-600 shrink-0" />
                        )}
                        <span
                          className={
                            f.isEnabled
                              ? "text-slate-800 dark:text-zinc-200"
                              : "text-slate-400 dark:text-zinc-500 line-through"
                          }
                        >
                          {f.name}
                        </span>
                      </div>
                    ))}
                    {plan.features.length > 10 && (
                      <p className="text-[11px] text-slate-400 dark:text-zinc-500 italic pl-5 pt-1">
                        + {plan.features.length - 10} more modules
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom footer */}
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/[0.06] flex items-center gap-2">
                <Button
                  onClick={() => handleOpenEdit(plan)}
                  variant="outline"
                  className="w-1/2 text-xs h-9 border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-700 dark:text-white"
                >
                  Edit Plan
                </Button>
                <a
                  href="/platform/organizations"
                  className="w-1/2 inline-flex items-center justify-center rounded-md text-xs font-medium h-9 bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                >
                  Assign to Gym
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 dark:bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#0e0f17] border border-slate-200 dark:border-white/[0.12] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between shrink-0 bg-slate-50 dark:bg-[#12131f]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-600/20 border border-violet-200 dark:border-violet-500/40 text-violet-700 dark:text-violet-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingPlanId ? `Edit SaaS Plan: ${formName}` : "Create New Custom SaaS Plan"}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Configure custom prices, member & branch quotas, and granular module entitlements.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/[0.08] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {modalError && (
                <div className="p-3.5 rounded-xl border border-red-500/40 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Section 1: Basic Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  <span>1. Plan Information & Pricing</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                      Plan Display Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Growth Pro / Custom Elite"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#161722] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                      Unique Plan Code * (lowercase slug)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. growth-pro"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      disabled={!!editingPlanId}
                      required
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#161722] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                    Plan Description
                  </label>
                  <input
                    type="text"
                    placeholder="Short marketing summary of the package"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#161722] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                      Monthly Price (₹ INR) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formMonthlyPrice}
                      onChange={(e) => setFormMonthlyPrice(Number(e.target.value))}
                      required
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#161722] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                      Annual Price (₹ INR) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formAnnualPrice}
                      onChange={(e) => setFormAnnualPrice(Number(e.target.value))}
                      required
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#161722] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                      Status
                    </label>
                    <select
                      value={formIsActive ? "active" : "inactive"}
                      onChange={(e) => setFormIsActive(e.target.value === "active")}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#161722] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="active">Active (Available for gyms)</option>
                      <option value="inactive">Inactive / Draft</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Quotas */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-white/[0.08]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  <span>2. Quota & Limits</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Max Active Members Limit
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-500 mb-1.5">
                      Leave blank for Unlimited members.
                    </p>
                    <input
                      type="number"
                      placeholder="Unlimited (Leave blank)"
                      value={formMemberQuota}
                      onChange={(e) => setFormMemberQuota(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#161722] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Max Branches Limit
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-500 mb-1.5">
                      Number of gym branch locations allowed (e.g. 1, 3, 10).
                    </p>
                    <input
                      type="number"
                      min="1"
                      placeholder="1"
                      value={formBranchQuota}
                      onChange={(e) => setFormBranchQuota(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#161722] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Feature Checklist (All 49 Features) */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-white/[0.08]">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>3. Module Entitlements ({enabledFeatureKeys.size} / {safeCatalog.length} Enabled)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      Toggle exact modules included in this subscription package.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAllFeatures}
                      className="text-[11px] h-7 px-2.5 border-slate-300 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-zinc-200 hover:text-slate-900 dark:hover:text-white"
                    >
                      Select All 49
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={deselectAllFeatures}
                      className="text-[11px] h-7 px-2.5 border-slate-300 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-zinc-200 hover:text-slate-900 dark:hover:text-white"
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>

                {/* Domain Blocks */}
                <div className="space-y-4">
                  {domains.map((domain) => {
                    const domainFeatures = safeCatalog.filter((f) => f.domain === domain);
                    const domainEnabledCount = domainFeatures.filter((f) =>
                      enabledFeatureKeys.has(f.key),
                    ).length;

                    return (
                      <div
                        key={domain}
                        className="p-4 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50/80 dark:bg-[#131420]/80 space-y-3"
                      >
                        {/* Domain header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-zinc-200">
                              {domain}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-white/[0.06] text-slate-600 dark:text-zinc-400 font-mono">
                              {domainEnabledCount} / {domainFeatures.length}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleDomain(domain, true)}
                              className="text-[10px] text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium px-2 py-0.5 rounded hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
                            >
                              Enable All
                            </button>
                            <span className="text-slate-300 dark:text-zinc-600 text-[10px]">|</span>
                            <button
                              type="button"
                              onClick={() => toggleDomain(domain, false)}
                              className="text-[10px] text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-300 font-medium px-2 py-0.5 rounded hover:bg-slate-200/50 dark:hover:bg-white/[0.05] transition-colors"
                            >
                              Disable All
                            </button>
                          </div>
                        </div>

                        {/* Feature grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                          {domainFeatures.map((feat) => {
                            const isChecked = enabledFeatureKeys.has(feat.key);

                            return (
                              <label
                                key={feat.key}
                                className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all select-none ${
                                  isChecked
                                    ? "border-violet-400/60 bg-violet-50 dark:bg-violet-600/10 text-violet-950 dark:text-white"
                                    : "border-slate-200 dark:border-white/[0.04] bg-white dark:bg-white/[0.02] text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleFeature(feat.key)}
                                  className="mt-0.5 rounded border-slate-300 dark:border-white/20 text-violet-600 focus:ring-violet-500 shrink-0"
                                />
                                <div className="space-y-0.5 leading-tight truncate">
                                  <div className="font-medium text-xs truncate">
                                    {feat.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono truncate">
                                    {feat.key}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-6 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-end gap-3 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="border-slate-300 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:text-white text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-violet-600 hover:bg-violet-500 text-white text-xs h-9 px-5 gap-1.5 font-medium"
                >
                  {isSubmitting ? (
                    "Saving..."
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>{editingPlanId ? "Update Plan & Invalidate Cache" : "Create Plan"}</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
