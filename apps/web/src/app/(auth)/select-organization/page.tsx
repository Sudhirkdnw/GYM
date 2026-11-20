"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight, AlertCircle, ShieldCheck } from "lucide-react";
import { UserRole } from "@gymos/shared-types";

interface OrgItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  role: UserRole | string;
}

export default function SelectOrganizationPage() {
  const { user, selectOrganization } = useAuth();
  const [organizations, setOrganizations] = useState<OrgItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadOrgs() {
      try {
        setIsLoading(true);
        const data = await apiClient<OrgItem[]>("/auth/organizations");
        setOrganizations(data || []);
      } catch (err) {
        if (err instanceof ApiClientError && err.statusCode === 401) {
          router.push("/login");
        } else {
          setServerError("Failed to retrieve authorized organizations");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadOrgs();
  }, [router]);

  const handleSelect = async (orgId: string) => {
    try {
      setSwitchingId(orgId);
      setServerError(null);
      await selectOrganization(orgId);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError("Failed to switch organization");
      }
      setSwitchingId(null);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <Card className="w-full max-w-xl shadow-lg border-zinc-200 dark:border-zinc-800">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <Building2 className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Select Organization</CardTitle>
          <CardDescription>
            Choose which gym tenant context to enter for your session
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user?.isSuperAdmin && (
            <div className="flex items-center justify-between p-4 rounded-xl border border-violet-500/40 bg-gradient-to-r from-violet-950/40 via-purple-950/30 to-indigo-950/40 dark:from-violet-950/60 dark:to-indigo-950/60">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-600/30 border border-violet-500/50 text-violet-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                    Platform Super Admin
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Manage SaaS subscriptions, gym feature toggles, and revenue
                  </p>
                </div>
              </div>
              <Button
                onClick={() => router.push("/platform")}
                className="bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs h-9 px-4 shrink-0 gap-1.5 shadow-sm"
              >
                <span>Console</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {serverError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-900"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-8 text-center text-sm text-zinc-500">
              Loading authorized workspaces...
            </div>
          ) : organizations.length === 0 ? (
            <div className="py-8 text-center space-y-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                You do not belong to any active organizations.
              </p>
              <Button
                onClick={() => router.push("/register")}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Register New Gym
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {organizations.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 transition-colors bg-white dark:bg-zinc-900"
                >
                  <div className="space-y-1">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      {org.name}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
                        {org.role}
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Slug: {org.slug}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleSelect(org.id)}
                    disabled={switchingId === org.id}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                    size="sm"
                  >
                    {switchingId === org.id ? (
                      "Switching..."
                    ) : (
                      <>
                        Select <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
