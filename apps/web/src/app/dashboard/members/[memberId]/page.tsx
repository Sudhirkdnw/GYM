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
  HeartPulse,
  CreditCard,
  CheckCircle2,
  PauseCircle,
  History,
  Phone,
  Mail,
  MapPin,
  Clock,
  Sparkles,
  Loader2,
  AlertCircle,
  X,
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        );
      case MemberStatus.INACTIVE:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-500 border border-border">
            Inactive
          </span>
        );
      case MemberStatus.SUSPENDED:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            Suspended
          </span>
        );
      case MemberStatus.ARCHIVED:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-500 border border-red-500/20">
            Archived
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm font-semibold text-foreground">Loading member profile...</p>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="p-12 text-center max-w-md mx-auto">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
        <p className="text-sm font-semibold text-red-500 mb-4">{error || "Member not found"}</p>
        <Link
          href="/dashboard/members"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-card hover:bg-accent text-xs font-semibold"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Directory
        </Link>
      </div>
    );
  }

  const initials = `${member.firstName[0] || ""}${member.lastName[0] || ""}`.toUpperCase();

  return (
    <div className="space-y-6 animate-fadeIn pb-16 max-w-5xl">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/members"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Members
        </Link>
      </div>

      {/* Profile Header Banner */}
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 via-purple-500/20 to-blue-500/20 border border-primary/30 flex items-center justify-center font-bold text-xl text-primary shadow-sm">
              {initials || "MB"}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {member.firstName} {member.lastName}
                </h1>
                {getStatusBadge(member.status)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="font-mono font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-md">
                  {member.memberNumber}
                </span>
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {member.branchName || "Branch"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Joined {new Date(member.joinedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {hasPermission(Permission.MEMBER_UPDATE) && member.status !== MemberStatus.ARCHIVED && (
              <Link
                href={`/dashboard/members/${member.id}/edit`}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-card border border-border hover:bg-accent/50 text-foreground transition-colors"
              >
                <Edit className="h-3.5 w-3.5 text-primary" /> Edit
              </Link>
            )}

            {hasPermission(Permission.MEMBER_STATUS_MANAGE) && member.status !== MemberStatus.ARCHIVED && (
              <button
                onClick={() => setShowStatusModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-card border border-border hover:bg-accent/50 text-foreground transition-colors"
              >
                <Shield className="h-3.5 w-3.5 text-amber-500" /> Status
              </button>
            )}

            {hasPermission(Permission.MEMBER_TRANSFER) && member.status !== MemberStatus.ARCHIVED && (
              <button
                onClick={() => setShowTransferModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-card border border-border hover:bg-accent/50 text-foreground transition-colors"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 text-blue-500" /> Transfer
              </button>
            )}

            {hasPermission(Permission.MEMBER_ARCHIVE) && member.status !== MemberStatus.ARCHIVED && (
              <button
                onClick={() => setShowArchiveModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-card border border-red-500/20 hover:bg-red-500/10 text-red-500 transition-colors"
              >
                <Archive className="h-3.5 w-3.5" /> Archive
              </button>
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
            <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-card to-background p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      Active Pass
                    </span>
                    {activeSub.status === MembershipStatus.FROZEN ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-xs font-bold text-blue-500">
                        <PauseCircle className="h-3 w-3" /> Frozen (Paused)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Current Subscription
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-foreground">
                    {activeSub.planName}
                  </h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      Validity: <strong className="text-foreground">{activeSub.startDate}</strong> to{" "}
                      <strong className="text-foreground">{activeSub.endDate}</strong>
                    </span>
                    <span>
                      Remaining:{" "}
                      <strong className={daysLeft <= 7 ? "text-amber-500 font-bold" : "text-emerald-500 font-bold"}>
                        {daysLeft > 0 ? `${daysLeft} days` : "Expiring today"}
                      </strong>
                    </span>
                    <span>
                      Paid: <strong className="text-foreground font-mono">₹{activeSub.finalPrice.toLocaleString("en-IN")}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href="/dashboard/memberships"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-card border border-border hover:bg-accent text-foreground transition-colors"
                  >
                    <CreditCard className="h-3.5 w-3.5 text-primary" /> Manage Plan
                  </Link>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CreditCard className="h-4 w-4 text-muted-foreground/60" />
              <span>No active membership subscription currently on file for this member.</span>
            </div>
            <Link
              href="/dashboard/memberships"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all"
            >
              Assign Membership Plan
            </Link>
          </div>
        );
      })()}

      {/* Grid of Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact & Personal Information */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-foreground">
              Personal & Contact Details
            </h3>
          </div>
          <div className="divide-y divide-border/40 text-xs">
            <div className="grid grid-cols-3 py-2.5">
              <span className="text-muted-foreground">Phone:</span>
              <span className="col-span-2 font-semibold text-foreground flex items-center gap-1">
                <Phone className="w-3 h-3 text-muted-foreground" />
                {member.phone}
              </span>
            </div>
            <div className="grid grid-cols-3 py-2.5">
              <span className="text-muted-foreground">Email:</span>
              <span className="col-span-2 font-medium text-foreground flex items-center gap-1">
                <Mail className="w-3 h-3 text-muted-foreground" />
                {member.email || "—"}
              </span>
            </div>
            <div className="grid grid-cols-3 py-2.5">
              <span className="text-muted-foreground">Gender:</span>
              <span className="col-span-2 font-medium text-foreground">
                {member.gender || "—"}
              </span>
            </div>
            <div className="grid grid-cols-3 py-2.5">
              <span className="text-muted-foreground">Date of Birth:</span>
              <span className="col-span-2 font-medium text-foreground">
                {member.dateOfBirth ? new Date(member.dateOfBirth).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "—"}
              </span>
            </div>
            <div className="grid grid-cols-3 py-2.5">
              <span className="text-muted-foreground">Address:</span>
              <span className="col-span-2 font-medium text-foreground">
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
            <div className="grid grid-cols-3 py-2.5">
              <span className="text-muted-foreground">Notes:</span>
              <span className="col-span-2 text-muted-foreground italic">
                {member.notes || "None recorded"}
              </span>
            </div>
          </div>
        </div>

        {/* Emergency Contact & Membership Metadata */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
              <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                <HeartPulse className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-foreground">
                Emergency Contact
              </h3>
            </div>
            <div className="divide-y divide-border/40 text-xs">
              <div className="grid grid-cols-3 py-2.5">
                <span className="text-muted-foreground">Name:</span>
                <span className="col-span-2 font-semibold text-foreground">
                  {member.emergencyContactName || "—"}
                </span>
              </div>
              <div className="grid grid-cols-3 py-2.5">
                <span className="text-muted-foreground">Phone:</span>
                <span className="col-span-2 font-medium text-foreground">
                  {member.emergencyContactPhone || "—"}
                </span>
              </div>
              <div className="grid grid-cols-3 py-2.5">
                <span className="text-muted-foreground">Relationship:</span>
                <span className="col-span-2 font-medium text-foreground">
                  {member.emergencyContactRelationship || "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <Building2 className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-foreground">
                Branch Assignment
              </h3>
            </div>
            <div className="divide-y divide-border/40 text-xs">
              <div className="grid grid-cols-3 py-2.5">
                <span className="text-muted-foreground">Current Branch:</span>
                <span className="col-span-2 font-semibold text-foreground">
                  {member.branchName || "Branch"}
                </span>
              </div>
              <div className="grid grid-cols-3 py-2.5">
                <span className="text-muted-foreground">Branch ID:</span>
                <span className="col-span-2 font-mono text-[11px] text-muted-foreground">
                  {member.branchId}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transfer History */}
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/40 flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">
            Branch Transfer History ({member.transfers?.length || 0})
          </h3>
        </div>
        <div className="p-0">
          {!member.transfers || member.transfers.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No branch transfers recorded for this member.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/30 uppercase tracking-wider text-[10px] text-muted-foreground font-semibold border-b border-border/40">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">From Branch</th>
                    <th className="px-4 py-2.5">To Branch</th>
                    <th className="px-4 py-2.5">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {member.transfers.map((t) => (
                    <tr key={t.id} className="hover:bg-accent/40">
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {new Date(t.transferredAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {t.fromBranchName || t.fromBranchId}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-emerald-500">
                        {t.toBranchName || t.toBranchId}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground italic">
                        {t.reason || "None specified"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Membership Subscriptions */}
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">
              Membership Subscriptions ({subscriptions.length})
            </h3>
          </div>
          <Link
            href="/dashboard/memberships"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Manage Subscriptions →
          </Link>
        </div>
        <div className="p-0">
          {subscriptions.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No historical membership subscriptions recorded for this member.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/30 uppercase tracking-wider text-[10px] text-muted-foreground font-semibold border-b border-border/40">
                  <tr>
                    <th className="px-4 py-2.5">Plan</th>
                    <th className="px-4 py-2.5">Branch</th>
                    <th className="px-4 py-2.5">Start Date</th>
                    <th className="px-4 py-2.5">End Date</th>
                    <th className="px-4 py-2.5">Final Price</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {subscriptions.map((s) => (
                    <tr key={s.id} className="hover:bg-accent/40">
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {s.planName} ({s.planCode})
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {s.homeBranchName || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{s.startDate}</td>
                      <td className="px-4 py-2.5 text-foreground font-medium">
                        {s.endDate}
                      </td>
                      <td className="px-4 py-2.5 font-bold font-mono text-foreground">
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
        </div>
      </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border/80 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-foreground">
                Change Member Status
              </h2>
              <button
                onClick={() => setShowStatusModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleStatusSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as MemberStatus)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value={MemberStatus.ACTIVE}>ACTIVE</option>
                  <option value={MemberStatus.INACTIVE}>INACTIVE</option>
                  <option value={MemberStatus.SUSPENDED}>SUSPENDED</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Reason for status change
                </label>
                <input
                  type="text"
                  placeholder="e.g. Requested temporary pause, Medical reason"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={statusLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                >
                  {statusLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Branch Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border/80 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-primary" />
                Transfer Member to Branch
              </h2>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Target Destination Branch
                </label>
                <select
                  value={targetBranchId}
                  onChange={(e) => setTargetBranchId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Reason for Transfer
                </label>
                <input
                  type="text"
                  placeholder="e.g. Relocation, Member requested"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                >
                  {transferLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Transfer Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-red-500 flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Archive Member
              </h2>
              <button
                onClick={() => setShowArchiveModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Archiving disables attendance check-ins and marks the member inactive. This action can only be audited and undone by an organization owner.
            </p>
            <form onSubmit={handleArchiveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Reason for Archival
                </label>
                <input
                  type="text"
                  placeholder="e.g. Left permanently, Relocated abroad"
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowArchiveModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={archiveLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm"
                >
                  {archiveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm Archive"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
