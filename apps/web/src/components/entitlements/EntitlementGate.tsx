"use client";

import React from "react";
import { useEntitlements } from "@/hooks/useEntitlements";
import { ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EntitlementGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  title?: string;
  description?: string;
}

export function EntitlementGate({
  feature,
  children,
  fallback,
  title = "Feature Not Available",
  description = "This module is not included in your gym's current subscription plan. Contact your administrator or upgrade your plan to unlock this capability.",
}: EntitlementGateProps) {
  const { isEntitled, isLoading } = useEntitlements();

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (isEntitled(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-8 text-center dark:border-amber-900/50 dark:bg-amber-950/20 my-6">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Button
          variant="outline"
          className="gap-2 border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950"
          onClick={() => window.location.href = "mailto:sales@gymos.com?subject=Upgrade%20Request"}
        >
          <Sparkles className="h-4 w-4" />
          Request Module Activation
        </Button>
      </div>
    </div>
  );
}
