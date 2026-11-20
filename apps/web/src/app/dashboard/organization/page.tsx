"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import { OrganizationProfile, Permission } from "@gymos/shared-types";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Phone,
  Globe,
  MapPin,
  Coins,
  Shield,
  Edit,
  RotateCcw,
  AlertTriangle,
  Building,
  CheckCircle2,
} from "lucide-react";

export default function OrganizationOverviewPage() {
  const { organization, isAuthenticated, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login");
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
      <div className="py-20 text-center text-slate-400">
        <RotateCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-500" />
        <p className="text-xs">Loading organization profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-rose-500 max-w-lg mx-auto">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm font-semibold">{error}</p>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const canEdit =
    organization?.permissions?.includes(Permission.ORGANIZATION_PROFILE_UPDATE) ||
    organization?.permissions?.includes(Permission.ORGANIZATION_SETTINGS_MANAGE);

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-md shadow-violet-500/20">
              {profile.name[0]}
            </div>
            {profile.name}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enterprise Tenant ID: <span className="font-mono text-xs">{profile.id}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Link
              href="/dashboard/organization/profile"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-sm transition-colors"
            >
              <Edit className="w-3.5 h-3.5" />
              Edit Profile
            </Link>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Core Identity & Locations */}
        <div className="lg:col-span-2 space-y-6">
          {/* Identity & Legal Info */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-white/[0.06] pb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-violet-500" />
                Legal Entity & Contact
              </h3>
              <Badge variant="success">Active Tenant</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">Legal Business Name</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {profile.legalName || profile.name}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Organization Slug</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {profile.slug}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Business Email</span>
                <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                  <Mail className="w-3.5 h-3.5 text-violet-500" />
                  <span>{profile.businessEmail || "Not configured"}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Business Phone</span>
                <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                  <Phone className="w-3.5 h-3.5 text-violet-500" />
                  <span>{profile.businessPhone || "Not configured"}</span>
                </div>
              </div>

              {profile.website && (
                <div className="sm:col-span-2">
                  <span className="text-slate-400 block mb-1">Official Website</span>
                  <div className="flex items-center gap-1.5 text-violet-500">
                    <Globe className="w-3.5 h-3.5" />
                    <a href={profile.website} target="_blank" rel="noreferrer" className="hover:underline">
                      {profile.website}
                    </a>
                  </div>
                </div>
              )}
            </div>

            {profile.description && (
              <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] text-xs">
                <span className="text-slate-400 block mb-1">About Company</span>
                <p className="text-slate-700 dark:text-slate-300">{profile.description}</p>
              </div>
            )}
          </div>

          {/* Registered Headquarters */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/[0.06] pb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-violet-500" />
              Registered Headquarters
            </h3>

            <div className="text-xs text-slate-800 dark:text-slate-200 space-y-1">
              <div>{profile.addressLine1 || "No street address configured"}</div>
              {profile.addressLine2 && <div>{profile.addressLine2}</div>}
              {(profile.city || profile.state || profile.postalCode) && (
                <div>
                  {profile.city} {profile.state} {profile.postalCode}
                </div>
              )}
              <div className="font-semibold text-slate-900 dark:text-white mt-1">
                {profile.country || "India"}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Financial & Tenant Defaults */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/[0.06] pb-3 flex items-center gap-2">
              <Coins className="w-4 h-4 text-violet-500" />
              Financial & Localization
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Default Currency</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {profile.currency || "INR (₹)"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Primary Timezone</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {profile.timezone || "Asia/Kolkata"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Tenant Joined</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {new Date(profile.createdAt).toLocaleDateString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          {/* Security & RLS Status */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              Multi-Tenant Isolation
            </h3>
            <p className="text-xs text-slate-400">
              Database Row-Level Security (RLS) is strictly enforced with <code className="font-mono text-[11px] text-violet-400">ENABLE + FORCE</code> policies on all tenant tables.
            </p>
            <div className="flex items-center gap-2 pt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Full Tenant Isolation Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
