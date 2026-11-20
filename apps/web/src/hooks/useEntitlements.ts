"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { EffectiveEntitlementsContext } from "@gymos/shared-types";
import { useAuth } from "@/lib/auth-context";

export function useEntitlements() {
  const { user, organization } = useAuth();
  const [entitlements, setEntitlements] =
    useState<EffectiveEntitlementsContext | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntitlements = useCallback(async () => {
    if (!organization?.id) {
      setEntitlements(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient<EffectiveEntitlementsContext>(
        "/auth/me/entitlements",
      );
      setEntitlements(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load entitlements",
      );
    } finally {
      setIsLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    fetchEntitlements();
  }, [fetchEntitlements]);

  /**
   * Check if a feature is entitled.
   * Super Admins bypass entitlement limitations.
   */
  const isEntitled = useCallback(
    (featureKey: string): boolean => {
      if (user?.isSuperAdmin) return true;
      if (!entitlements) return true; // Optimistic while loading or unconstrained
      return Boolean(entitlements.features[featureKey]);
    },
    [user?.isSuperAdmin, entitlements],
  );

  /**
   * Get quota info for a metric key.
   */
  const getQuota = useCallback(
    (metricKey: string) => {
      if (!entitlements) return null;
      return entitlements.quotas[metricKey] || null;
    },
    [entitlements],
  );

  return {
    entitlements,
    isLoading,
    error,
    isEntitled,
    getQuota,
    refetch: fetchEntitlements,
  };
}
