"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import { OrganizationProfile, Permission } from "@gymos/shared-types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Clock,
  Coins,
  Calendar,
  Shield,
  Edit,
  ArrowLeft,
  Building,
} from "lucide-react";

export default function OrganizationOverviewPage() {
  const { organization, isAuthenticated, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }

    if (!organization) {
      return;
    }

    const fetchOrg = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiClient<OrganizationProfile>("/organizations/current");
        setProfile(data);
      } catch (err: unknown) {
        setError((err as Error).message || "Failed to load organization profile");
      } finally {
        setLoading(false);
      }
    };

    fetchOrg();
  }, [authLoading, isAuthenticated, organization, router]);

  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-sm text-zinc-500">
        Loading organization details...
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const canEdit =
    organization?.permissions.includes(Permission.ORGANIZATION_PROFILE_UPDATE) ||
    organization?.permissions.includes(Permission.ORGANIZATION_SETTINGS_MANAGE);

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6">
      {/* Header breadcrumb & actions */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-2 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {profile.name}
            </h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                profile.status === "ACTIVE"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              {profile.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Tenant ID: <code className="font-mono text-xs">{profile.id}</code> • Slug: <span className="font-mono text-xs">{profile.slug}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Link href="/dashboard/organization/profile">
              <Button size="sm" className="gap-2">
                <Edit className="h-3.5 w-3.5" />
                Edit Profile
              </Button>
            </Link>
          )}
          <Link href="/dashboard/branches">
            <Button size="sm" variant="outline" className="gap-2">
              <Building className="h-3.5 w-3.5" />
              Manage Branches
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-zinc-500 uppercase">
              Total Branches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {profile.stats?.totalBranches || 0}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Locations under this organization
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-zinc-500 uppercase">
              Active Branches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {profile.stats?.activeBranches || 0}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Currently operational
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-zinc-500 uppercase">
              Staff Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {profile.stats?.totalStaff || 0}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Total assigned team members
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-zinc-500 uppercase">
              Default Currency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {profile.currency}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Timezone: {profile.timezone}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Details Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600" />
              Business Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <span className="text-xs font-medium text-zinc-500 block">Legal Entity Name</span>
              <span className="text-zinc-900 dark:text-zinc-100 font-medium">
                {profile.legalName || "Not configured"}
              </span>
            </div>
            <div>
              <span className="text-xs font-medium text-zinc-500 block">Business Description</span>
              <p className="text-zinc-700 dark:text-zinc-300 text-xs mt-1 leading-relaxed">
                {profile.description || "No business description provided."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <Clock className="h-3.5 w-3.5 text-zinc-400" />
                <span>Timezone: <strong>{profile.timezone}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <Coins className="h-3.5 w-3.5 text-zinc-400" />
                <span>Currency: <strong>{profile.currency}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                <span>Created: {new Date(profile.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <Shield className="h-3.5 w-3.5 text-zinc-400" />
                <span>RLS Protected: <strong>Yes</strong></span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-600" />
              Contact & Address
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                <Mail className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                <span>{profile.businessEmail || "No business email"}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                <Phone className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                <span>{profile.businessPhone || "No business phone"}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                <Globe className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                {profile.website ? (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-600 hover:underline"
                  >
                    {profile.website}
                  </a>
                ) : (
                  <span>No website</span>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-xs font-medium text-zinc-500 block mb-1">
                Registered Office Address
              </span>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {[
                  profile.addressLine1,
                  profile.addressLine2,
                  profile.city,
                  profile.state,
                  profile.postalCode,
                  profile.country,
                ]
                  .filter(Boolean)
                  .join(", ") || "No address configured."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
