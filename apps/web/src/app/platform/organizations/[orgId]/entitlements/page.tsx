"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface FeatureCatalogItem {
  key: string;
  domain: string;
  name: string;
  description?: string;
  valueType: string;
}

interface EntitlementResponse {
  organization: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  subscription: {
    id: string;
    planCode: string;
    planName: string;
    status: string;
    agreedPrice: number;
    billingInterval: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  } | null;
  overrides: Array<{
    featureKey: string;
    isEnabled: boolean;
    numericQuota: number | null;
    reason?: string;
  }>;
  effective: {
    features: Record<string, boolean>;
    quotas: Record<string, { current: number; max: number | null }>;
  };
  catalog: FeatureCatalogItem[];
}

export default function GymEntitlementsConfigPage() {
  const routeParams = useParams();
  const orgId = routeParams.orgId as string;

  const [data, setData] = useState<EntitlementResponse | null>(null);
  const [featureStates, setFeatureStates] = useState<Record<string, boolean>>({});
  const [memberQuota, setMemberQuota] = useState<string>("");
  const [branchQuota, setBranchQuota] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadEntitlements = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiClient<EntitlementResponse>(
        `/platform/organizations/${orgId}/entitlements`,
      );
      setData(res);

      // Populate feature toggles from effective map
      const initialFeatures: Record<string, boolean> = {};
      for (const item of res.catalog) {
        initialFeatures[item.key] = res.effective.features[item.key] ?? false;
      }
      setFeatureStates(initialFeatures);

      // Populate quotas
      const mq = res.effective.quotas["members.max_active"]?.max;
      setMemberQuota(mq !== null && mq !== undefined ? String(mq) : "");

      const bq = res.effective.quotas["core.branches.max"]?.max;
      setBranchQuota(bq !== null && bq !== undefined ? String(bq) : "");

      setSelectedPlanCode(res.subscription?.planCode || "enterprise");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load gym entitlements",
      );
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadEntitlements();
  }, [loadEntitlements]);

  const toggleFeature = (key: string) => {
    setFeatureStates((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSaveOverrides = async () => {
    if (!data) return;

    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const overridesPayload: Array<{
        featureKey: string;
        isEnabled: boolean;
        numericQuota?: number | null;
        reason?: string;
      }> = [];

      // Add all catalog feature overrides
      for (const cat of data.catalog) {
        if (cat.valueType === "BOOLEAN") {
          overridesPayload.push({
            featureKey: cat.key,
            isEnabled: Boolean(featureStates[cat.key]),
            reason: overrideReason || "Platform Admin toggle",
          });
        }
      }

      // Add quota overrides
      if (memberQuota.trim() !== "") {
        const val = parseInt(memberQuota, 10);
        overridesPayload.push({
          featureKey: "members.max_active",
          isEnabled: true,
          numericQuota: isNaN(val) ? null : val,
          reason: overrideReason || "Custom Member Quota",
        });
      }

      if (branchQuota.trim() !== "") {
        const val = parseInt(branchQuota, 10);
        overridesPayload.push({
          featureKey: "core.branches.max",
          isEnabled: true,
          numericQuota: isNaN(val) ? null : val,
          reason: overrideReason || "Custom Branch Quota",
        });
      }

      await apiClient(`/platform/organizations/${orgId}/entitlements`, {
        method: "PATCH",
        body: JSON.stringify({ overrides: overridesPayload }),
      });

      setSuccessMessage(
        "Entitlements updated successfully! Redis cache has been purged and changes are live across all active user sessions.",
      );
      await loadEntitlements();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save entitlement overrides",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePlan = async () => {
    try {
      setIsChangingPlan(true);
      setError(null);
      setSuccessMessage(null);

      await apiClient(`/platform/organizations/${orgId}/plan`, {
        method: "POST",
        body: JSON.stringify({
          planCode: selectedPlanCode,
          billingInterval: "MONTHLY",
        }),
      });

      setSuccessMessage(
        `SaaS Plan switched to ${selectedPlanCode.toUpperCase()}! Plan defaults have been applied.`,
      );
      await loadEntitlements();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to switch SaaS plan",
      );
    } finally {
      setIsChangingPlan(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="text-xs text-zinc-400">Loading Entitlement Matrix...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-6 text-red-400">
        <p className="font-semibold">{error}</p>
        <Link
          href="/platform/organizations"
          className="inline-flex items-center justify-center rounded-md mt-4 bg-violet-600 text-white text-xs h-8 px-3 font-medium hover:bg-violet-500 transition-colors"
        >
          Back to Organizations
        </Link>
      </div>
    );
  }

  // Group catalog features by domain
  const domains: Record<string, FeatureCatalogItem[]> = {};
  if (data?.catalog) {
    for (const item of data.catalog) {
      if (!domains[item.domain]) {
        domains[item.domain] = [];
      }
      domains[item.domain].push(item);
    }
  }

  const domainDisplayNames: Record<string, string> = {
    attendance: "Front Desk & QR Attendance",
    members: "Member Management & Digital Passes",
    memberships: "Subscriptions & Renewal Plans",
    billing: "Billing, Invoicing & Payments",
    training: "Workout & Diet Nutrition Plans",
    classes: "Class & Session Booking",
    crm: "Marketing, Leads & Sales CRM",
    communication: "WhatsApp Cloud API & SMS Gateways",
    automation: "Automation Engine & Custom Workflows",
    reports: "Reports, Ledger & Financial Analytics",
    ai: "AI Business & Member Intelligence",
    core: "Core Platform & Multi-Branch Quotas",
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Back button and Header */}
      <div>
        <Link
          href="/platform/organizations"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Gym Organizations</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {data?.organization.name}
              </h1>
              <span className="rounded-full bg-violet-950 border border-violet-500/40 px-2.5 py-0.5 text-[10px] font-semibold text-violet-300">
                slug: {data?.organization.slug}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Configure 1-click feature access and usage limits for this gym business.
            </p>
          </div>

          <Button
            onClick={handleSaveOverrides}
            disabled={isSaving}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-xs h-9 px-5 gap-2 shadow-glow shadow-violet-500/25 shrink-0"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? "Purging Cache & Saving..." : "Save Entitlements"}</span>
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SaaS Subscription Plan Card */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0e0f17] p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-semibold text-white">
                Assigned SaaS Subscription
              </h2>
            </div>
            <p className="text-xs text-zinc-400">
              Current package:{" "}
              <span className="font-bold text-violet-300">
                {data?.subscription?.planName || "Enterprise"}
              </span>{" "}
              • Renewal Date:{" "}
              <span className="font-mono text-zinc-300">
                {data?.subscription?.currentPeriodEnd || "2028-11-20"}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedPlanCode}
              onChange={(e) => setSelectedPlanCode(e.target.value)}
              className="bg-[#141522] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
            >
              <option value="starter">Starter Plan (Base Operations)</option>
              <option value="pro">Pro Plan (Operations + Billing + CRM)</option>
              <option value="enterprise">Enterprise Plan (Full Suite + AI)</option>
            </select>

            <Button
              onClick={handleChangePlan}
              disabled={isChangingPlan}
              variant="outline"
              className="border-violet-500/40 text-violet-300 hover:bg-violet-950/50 hover:text-white text-xs h-8 px-3"
            >
              {isChangingPlan ? "Switching..." : "Apply Plan"}
            </Button>
          </div>
        </div>

        {/* Numeric Quotas */}
        <div className="mt-6 pt-6 border-t border-white/[0.05] grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-zinc-300 block mb-1.5">
              Max Active Members
            </label>
            <input
              type="number"
              placeholder="Leave blank for unlimited"
              value={memberQuota}
              onChange={(e) => setMemberQuota(e.target.value)}
              className="w-full bg-[#141522] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
            />
            <p className="text-[10px] text-zinc-500 mt-1">
              Active: {data?.effective.quotas["members.max_active"]?.current ?? 0}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-300 block mb-1.5">
              Max Branch Locations
            </label>
            <input
              type="number"
              placeholder="Leave blank for unlimited"
              value={branchQuota}
              onChange={(e) => setBranchQuota(e.target.value)}
              className="w-full bg-[#141522] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
            />
            <p className="text-[10px] text-zinc-500 mt-1">
              Active: {data?.effective.quotas["core.branches.max"]?.current ?? 1}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-300 block mb-1.5">
              Change Reason (Audit Log)
            </label>
            <input
              type="text"
              placeholder="e.g. VIP contract add-on"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="w-full bg-[#141522] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>
      </div>

      {/* Feature Catalog Toggles grouped by domain */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-violet-400" />
            <h2 className="text-base font-bold text-white">
              Service Entitlements Catalog ({data?.catalog.length || 0} Modules)
            </h2>
          </div>
          <span className="text-xs text-zinc-500">
            Toggles override plan defaults instantly
          </span>
        </div>

        {Object.entries(domains).map(([domain, items]) => (
          <div
            key={domain}
            className="rounded-2xl border border-white/[0.08] bg-[#0e0f17] overflow-hidden"
          >
            <div className="bg-white/[0.02] px-6 py-3 border-b border-white/[0.05] flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-violet-300">
                {domainDisplayNames[domain] || domain}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {items.length} features
              </span>
            </div>

            <div className="divide-y divide-white/[0.04]">
              {items.map((feat) => {
                const isEnabled = featureStates[feat.key] ?? false;
                const hasCustomOverride = data?.overrides.some(
                  (o) => o.featureKey === feat.key,
                );

                return (
                  <div
                    key={feat.key}
                    className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-white/[0.01] transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {feat.name}
                        </span>
                        {hasCustomOverride ? (
                          <span className="rounded bg-amber-950/60 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-bold text-amber-300 uppercase">
                            OVERRIDE
                          </span>
                        ) : (
                          <span className="rounded bg-zinc-900 border border-zinc-700 px-1.5 py-0.2 text-[9px] font-medium text-zinc-400 uppercase">
                            PLAN DEFAULT
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400">
                        {feat.description || feat.key}
                      </p>
                      <p className="text-[10px] text-zinc-600 font-mono">
                        key: {feat.key}
                      </p>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      onClick={() => toggleFeature(feat.key)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isEnabled ? "bg-violet-600" : "bg-zinc-800"
                      }`}
                      role="switch"
                      aria-checked={isEnabled}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          isEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
