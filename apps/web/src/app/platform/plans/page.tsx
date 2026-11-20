"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import {
  Package,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

interface SaasPlanWithFeatures {
  id: string;
  code: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  isActive: boolean;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlans() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiClient<SaasPlanWithFeatures[]>("/platform/plans");
        setPlans(data || []);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load SaaS plans",
        );
      } finally {
        setIsLoading(false);
      }
    }
    loadPlans();
  }, []);

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Package className="h-6 w-6 text-violet-400" />
          <span>SaaS Subscription Plans</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Review commercial subscription packages sold to gym business owners with default feature allocations.
        </p>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isEnterprise = plan.code === "enterprise";
          const isPro = plan.code === "pro";

          return (
            <div
              key={plan.id}
              className={`rounded-2xl border p-6 flex flex-col justify-between transition-all ${
                isEnterprise
                  ? "border-violet-500/60 bg-gradient-to-b from-violet-950/30 via-[#10111a] to-[#0d0e15] shadow-glow shadow-violet-500/10"
                  : isPro
                  ? "border-indigo-500/40 bg-gradient-to-b from-indigo-950/20 via-[#10111a] to-[#0d0e15]"
                  : "border-white/[0.08] bg-[#0e0f17]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {plan.name}
                    {isEnterprise && (
                      <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                        Full Suite
                      </span>
                    )}
                  </h3>
                  <span className="text-xs font-mono text-zinc-500 uppercase">
                    {plan.code}
                  </span>
                </div>

                <p className="text-xs text-zinc-400 mt-2 min-h-[36px]">
                  {plan.description || "Commercial gym operations package"}
                </p>

                <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">
                    ₹{plan.monthlyPrice.toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">/ month</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  ₹{plan.annualPrice.toLocaleString("en-IN")} billed annually
                </p>

                {/* Key feature highlights */}
                <div className="mt-6 space-y-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Included Features ({plan.features.filter((f) => f.isEnabled).length})
                  </p>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {plan.features.slice(0, 15).map((f) => (
                      <div
                        key={f.featureKey}
                        className="flex items-center gap-2 text-xs"
                      >
                        {f.isEnabled ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                        )}
                        <span
                          className={
                            f.isEnabled ? "text-zinc-200" : "text-zinc-500"
                          }
                        >
                          {f.name}
                        </span>
                      </div>
                    ))}
                    {plan.features.length > 15 && (
                      <p className="text-[11px] text-zinc-500 italic pl-5">
                        + {plan.features.length - 15} more modules included
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-white/[0.06]">
                <a
                  href="/platform/organizations"
                  className={`w-full inline-flex items-center justify-center rounded-md text-xs font-medium h-9 transition-colors ${
                    isEnterprise
                      ? "bg-violet-600 hover:bg-violet-500 text-white"
                      : "bg-white/[0.08] hover:bg-white/[0.12] text-white"
                  }`}
                >
                  Assign to Gym
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
