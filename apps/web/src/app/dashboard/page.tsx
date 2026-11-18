"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Building2,
  Mail,
  User,
  ArrowRight,
} from "lucide-react";

export default function DashboardShellPage() {
  const { user, organization, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-sm text-zinc-500">
        Authenticating session context...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6">
      {!user.emailVerified && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Your email address is pending verification
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Verify your account to enable notifications and staff management.
              </p>
            </div>
          </div>
          <Link href="/verify-email">
            <Button size="sm" variant="outline" className="text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800">
              Verify Now
            </Button>
          </Link>
        </div>
      )}

      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            Welcome, {user.firstName} {user.lastName}
            {user.isSuperAdmin && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-semibold">
                Super Admin
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Authenticated multi-tenant session active via PostgreSQL RLS & Argon2id.
          </p>
        </div>

        {organization && (
          <div className="flex items-center gap-2">
            <Link href="/select-organization">
              <Button variant="outline" size="sm" className="gap-2">
                <Building2 className="h-4 w-4" />
                Switch Gym
              </Button>
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Workspace</CardTitle>
            <Building2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            {organization ? (
              <div className="space-y-1">
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {organization.name}
                </div>
                <p className="text-xs text-zinc-500">Slug: {organization.slug}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-zinc-500">No gym workspace selected</p>
                <Link href="/select-organization">
                  <Button size="sm" className="text-xs">
                    Choose Gym <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Role</CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {organization?.role || (user.isSuperAdmin ? "PLATFORM_SUPER_ADMIN" : "None")}
            </div>
            <p className="text-xs text-zinc-500">
              {organization?.permissions.length || 0} RBAC permissions granted
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Profile</CardTitle>
            <User className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {user.email}
            </div>
            <p className="text-xs text-zinc-500 capitalize">
              Status: <span className="text-emerald-600 font-medium">{user.status.toLowerCase()}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 rounded-lg border border-dashed border-zinc-300 p-6 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50">
        <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
          Granted Permissions in Active Context:
        </h3>
        <div className="flex flex-wrap gap-2">
          {organization?.permissions.map((p) => (
            <span
              key={p}
              className="font-mono text-xs px-2.5 py-1 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            >
              {p}
            </span>
          ))}
          {(!organization?.permissions || organization.permissions.length === 0) && (
            <span className="text-xs text-zinc-500">
              No specific organization permissions assigned.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
