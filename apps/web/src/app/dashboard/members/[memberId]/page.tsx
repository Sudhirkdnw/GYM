"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import {
  MemberDetailData,
  MemberStatus,
  MemberMembershipData,
  MembershipStatus,
  Permission,
} from "@gymos/shared-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MemberPassCard } from "@/components/attendance/MemberPassCard";
import {
  ArrowLeft,
  User,
  Building2,
  Calendar,
  Shield,
  ArrowRightLeft,
  Archive,
  Edit,
  AlertTriangle,
  History,
  HeartPulse,
  CreditCard,
  CheckCircle2,
  PauseCircle,
} from "lucide-react";

export default function MemberProfilePage() {
  const params = useParams();
  const memberId = params.memberId as string;
  const router = useRouter();
  const { organization, branches, isAuthenticated, isLoading: authLoading } = useAuth();

  const [member, setMember] = useState<MemberDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status Modal State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<MemberStatus>(MemberStatus.ACTIVE);
  const [statusReason, setStatusReason] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);

  // Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [targetBranchId, setTargetBranchId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

  // Archive Modal State
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Subscriptions State
  const [subscriptions, setSubscriptions] = useState<MemberMembershipData[]>([]);

  const fetchMember = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [memberRes, subsRes] = await Promise.all([
        apiClient<MemberDetailData>(`/members/${memberId}`),
        apiClient<MemberMembershipData[]>(`/memberships/members/${memberId}`).catch(() => []),
      ]);
      setMember(memberRes);
      setNewStatus(memberRes.status);
      setSubscriptions(subsRes || []);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load member profile");
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (memberId) {
      fetchMember();
    }
  }, [authLoading, isAuthenticated, memberId, fetchMember, router]);

  const hasPermission = (p: Permission) => {
    return organization?.permissions.includes(p) || false;
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setStatusLoading(true);
      await apiClient(`/members/${memberId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: newStatus,
          reason: statusReason.trim() || undefined,
        }),
      });
      setShowStatusModal(false);
      setStatusReason("");
      await fetchMember();
    } catch (err: unknown) {
      alert((err as Error).message || "Failed to update member status");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBranchId) {
      alert("Please select a target branch");
      return;
    }

    try {
      setTransferLoading(true);
      await apiClient(`/members/${memberId}/transfer`, {
        method: "POST",
        body: JSON.stringify({
          targetBranchId,
          reason: transferReason.trim() || undefined,
        }),
      });
      setShowTransferModal(false);
      setTransferReason("");
      await fetchMember();
    } catch (err: unknown) {
      alert((err as Error).message || "Failed to transfer member");
    } finally {
      setTransferLoading(false);
    }
  };

  const handleArchiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setArchiveLoading(true);
      await apiClient(`/members/${memberId}/archive`, {
        method: "POST",
        body: JSON.stringify({
          reason: archiveReason.trim() || undefined,
        }),
      });
      setShowArchiveModal(false);
      setArchiveReason("");
      await fetchMember();
    } catch (err: unknown) {
      alert((err as Error).message || "Failed to archive member");
    } finally {
      setArchiveLoading(false);
    }
  };

  const getStatusBadge = (status: MemberStatus) => {
    switch (status) {
      case MemberStatus.ACTIVE:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
            Active
          </span>
        );
      case MemberStatus.INACTIVE:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400">
            Inactive
          </span>
        );
      case MemberStatus.SUSPENDED:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
            Suspended
          </span>
        );
      case MemberStatus.ARCHIVED:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400">
            Archived
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-sm text-zinc-500">
        Loading member profile...
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-sm text-red-600 mb-4">{error || "Member not found"}</p>
        <Link href="/dashboard/members">
          <Button variant="outline" size="sm">
            Back to Directory
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 max-w-5xl">
      {/* Top Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/dashboard/members"
          className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Members
        </Link>
      </div>

      {/* Profile Header Banner */}
      <div className="mb-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xl uppercase">
              {member.firstName[0]}
              {member.lastName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {member.firstName} {member.lastName}
                </h1>
                {getStatusBadge(member.status)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                  {member.memberNumber}
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-zinc-400" />
                  {member.branchName || "Branch"}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                  Joined {new Date(member.joinedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {hasPermission(Permission.MEMBER_UPDATE) && member.status !== MemberStatus.ARCHIVED && (
              <Link href={`/dashboard/members/${member.id}/edit`}>
                <Button variant="outline" size="sm" className="gap-1 text-xs">
                  <Edit className="h-3.5 w-3.5" /> Edit
                </Button>
              </Link>
            )}

            {hasPermission(Permission.MEMBER_STATUS_MANAGE) && member.status !== MemberStatus.ARCHIVED && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowStatusModal(true)}
                className="gap-1 text-xs"
              >
                <Shield className="h-3.5 w-3.5" /> Status
              </Button>
            )}

            {hasPermission(Permission.MEMBER_TRANSFER) && member.status !== MemberStatus.ARCHIVED && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTransferModal(true)}
                className="gap-1 text-xs"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer
              </Button>
            )}

            {hasPermission(Permission.MEMBER_ARCHIVE) && member.status !== MemberStatus.ARCHIVED && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowArchiveModal(true)}
                className="gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                <Archive className="h-3.5 w-3.5" /> Archive
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Active Membership Hero Banner */}
      {(() => {
        const activeSub = subscriptions.find(
          (s) => s.status === MembershipStatus.ACTIVE || s.status === MembershipStatus.FROZEN
        );

        if (activeSub) {
          const endDate = new Date(activeSub.endDate);
          const today = new Date();
          const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          return (
            <div className="mb-6 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-gradient-to-r from-emerald-50/70 via-white to-emerald-50/40 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-emerald-950/20 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded">
                      Current Subscription
                    </span>
                    {activeSub.status === MembershipStatus.FROZEN ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-950 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                        <PauseCircle className="h-3 w-3" /> Frozen (Paused)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> Active Pass
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    {activeSub.planName}
                  </h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400">
                    <span>
                      Validity: <strong className="text-zinc-800 dark:text-zinc-200">{activeSub.startDate}</strong> to{" "}
                      <strong className="text-zinc-800 dark:text-zinc-200">{activeSub.endDate}</strong>
                    </span>
                    <span>
                      Remaining:{" "}
                      <strong className={daysLeft <= 7 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-emerald-600 dark:text-emerald-400"}>
                        {daysLeft > 0 ? `${daysLeft} days` : "Expiring today"}
                      </strong>
                    </span>
                    <span>
                      Paid: <strong>₹{activeSub.finalPrice.toLocaleString("en-IN")}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link href="/dashboard/memberships">
                    <Button size="sm" variant="outline" className="text-xs gap-1">
                      <CreditCard className="h-3.5 w-3.5" /> Manage in Subscriptions
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="mb-6 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-zinc-500">
              <CreditCard className="h-4 w-4 text-zinc-400" />
              <span>No active membership subscription currently on file for this member.</span>
            </div>
            <Link href="/dashboard/memberships">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                Assign Membership Plan
              </Button>
            </Link>
          </div>
        );
      })()}

      {/* Grid of Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Contact & Personal Information */}
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-emerald-600" />
              Personal & Contact Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs">
            <div className="grid grid-cols-3 py-1 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-500">Phone:</span>
              <span className="col-span-2 font-medium text-zinc-900 dark:text-zinc-100">
                {member.phone}
              </span>
            </div>
            <div className="grid grid-cols-3 py-1 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-500">Email:</span>
              <span className="col-span-2 font-medium text-zinc-900 dark:text-zinc-100">
                {member.email || "—"}
              </span>
            </div>
            <div className="grid grid-cols-3 py-1 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-500">Gender:</span>
              <span className="col-span-2 font-medium text-zinc-900 dark:text-zinc-100">
                {member.gender || "—"}
              </span>
            </div>
            <div className="grid grid-cols-3 py-1 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-500">Date of Birth:</span>
              <span className="col-span-2 font-medium text-zinc-900 dark:text-zinc-100">
                {member.dateOfBirth ? new Date(member.dateOfBirth).toLocaleDateString() : "—"}
              </span>
            </div>
            <div className="grid grid-cols-3 py-1 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-500">Address:</span>
              <span className="col-span-2 font-medium text-zinc-900 dark:text-zinc-100">
                {[
                  member.addressLine1,
                  member.addressLine2,
                  member.city,
                  member.state,
                  member.postalCode,
                  member.country,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </span>
            </div>
            <div className="grid grid-cols-3 py-1">
              <span className="text-zinc-500">Notes:</span>
              <span className="col-span-2 text-zinc-700 dark:text-zinc-300 italic">
                {member.notes || "None recorded"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact & Membership Metadata */}
        <div className="space-y-6">
          <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-emerald-600" />
                Emergency Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="grid grid-cols-3 py-1 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Name:</span>
                <span className="col-span-2 font-medium text-zinc-900 dark:text-zinc-100">
                  {member.emergencyContactName || "—"}
                </span>
              </div>
              <div className="grid grid-cols-3 py-1 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Phone:</span>
                <span className="col-span-2 font-medium text-zinc-900 dark:text-zinc-100">
                  {member.emergencyContactPhone || "—"}
                </span>
              </div>
              <div className="grid grid-cols-3 py-1">
                <span className="text-zinc-500">Relationship:</span>
                <span className="col-span-2 font-medium text-zinc-900 dark:text-zinc-100">
                  {member.emergencyContactRelationship || "—"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-600" />
                Branch Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="grid grid-cols-3 py-1 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Current Branch:</span>
                <span className="col-span-2 font-semibold text-zinc-900 dark:text-zinc-100">
                  {member.branchName || "Branch"}
                </span>
              </div>
              <div className="grid grid-cols-3 py-1">
                <span className="text-zinc-500">Branch ID:</span>
                <span className="col-span-2 font-mono text-[11px] text-zinc-500">
                  {member.branchId}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transfer History */}
      <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
        <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-emerald-600" />
            Branch Transfer History ({member.transfers?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!member.transfers || member.transfers.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500">
              No branch transfers recorded for this member.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900/60 uppercase tracking-wider text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">From Branch</th>
                    <th className="px-4 py-2.5">To Branch</th>
                    <th className="px-4 py-2.5">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {member.transfers.map((t) => (
                    <tr key={t.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                      <td className="px-4 py-2.5 text-zinc-500">
                        {new Date(t.transferredAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                        {t.fromBranchName || t.fromBranchId}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-emerald-600 dark:text-emerald-400">
                        {t.toBranchName || t.toBranchId}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400 italic">
                        {t.reason || "None specified"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Membership Passes & History */}
      <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm mt-6">
        <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            Membership Subscriptions ({subscriptions.length})
          </CardTitle>
          <Link href="/dashboard/memberships">
            <Button variant="ghost" size="sm" className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700">
              Manage Subscriptions →
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {subscriptions.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500">
              No historical membership subscriptions recorded for this member.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900/60 uppercase tracking-wider text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-2.5">Plan</th>
                    <th className="px-4 py-2.5">Branch</th>
                    <th className="px-4 py-2.5">Start Date</th>
                    <th className="px-4 py-2.5">End Date</th>
                    <th className="px-4 py-2.5">Final Price</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {subscriptions.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                      <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                        {s.planName} ({s.planCode})
                      </td>
                      <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                        {s.homeBranchName || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500">{s.startDate}</td>
                      <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300 font-medium">
                        {s.endDate}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-zinc-900 dark:text-zinc-100">
                        ₹{s.finalPrice.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-semibold text-[11px] uppercase tracking-wider">
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Member Access Pass & Digital Credentials */}
      {member && (
        <MemberPassCard
          memberId={member.id}
          memberName={`${member.firstName} ${member.lastName}`}
          permissions={organization?.permissions || []}
        />
      )}

      {/* Change Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 max-w-md w-full border border-zinc-200 dark:border-zinc-800 shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-zinc-900 dark:text-zinc-100">
              Change Member Status
            </h2>
            <form onSubmit={handleStatusSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as MemberStatus)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value={MemberStatus.ACTIVE}>ACTIVE</option>
                  <option value={MemberStatus.INACTIVE}>INACTIVE</option>
                  <option value={MemberStatus.SUSPENDED}>SUSPENDED</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Reason for status change
                </label>
                <input
                  type="text"
                  placeholder="e.g. Requested temporary pause, Medical reason"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStatusModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={statusLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {statusLoading ? "Updating..." : "Save Status"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Branch Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 max-w-md w-full border border-zinc-200 dark:border-zinc-800 shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-emerald-600" />
              Transfer Member to Branch
            </h2>
            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Target Destination Branch
                </label>
                <select
                  value={targetBranchId}
                  onChange={(e) => setTargetBranchId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select destination branch...</option>
                  {branches
                    ?.filter((b) => b.id !== member.branchId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.branchCode})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Reason for Transfer
                </label>
                <input
                  type="text"
                  placeholder="e.g. Relocated to new neighborhood, Member request"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTransferModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={transferLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {transferLoading ? "Transferring..." : "Execute Transfer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 max-w-md w-full border border-red-200 dark:border-red-900/50 shadow-xl">
            <h2 className="text-lg font-bold mb-2 text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Archive Member
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">
              Archiving a member marks them as permanently archived. Their records and transfer
              history are preserved for compliance and reporting.
            </p>
            <form onSubmit={handleArchiveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Reason for Archival
                </label>
                <input
                  type="text"
                  placeholder="e.g. Permanently left gym, Member requested data archival"
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowArchiveModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={archiveLoading}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {archiveLoading ? "Archiving..." : "Confirm Archive"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
