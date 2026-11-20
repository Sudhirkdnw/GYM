"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import {
  BranchData,
  BranchStaffAssignmentData,
  UserRole,
  Permission,
} from "@gymos/shared-types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Users,
  ArrowLeft,
  UserPlus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Shield,
  Mail,
  Calendar,
} from "lucide-react";

interface OrgMember {
  id: string; // organization_users.id
  userId: string;
  role: UserRole;
  email: string;
  firstName: string;
  lastName: string;
}

export default function BranchStaffManagementPage() {
  const { organization, isAuthenticated, isLoading: authLoading } = useAuth();
  const params = useParams();
  const branchId = params.branchId as string;
  const router = useRouter();

  const [branch, setBranch] = useState<BranchData | null>(null);
  const [assignments, setAssignments] = useState<BranchStaffAssignmentData[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedOrgUserId, setSelectedOrgUserId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [branchData, staffList, membersList] = await Promise.all([
        apiClient<BranchData>(`/branches/${branchId}`),
        apiClient<BranchStaffAssignmentData[]>(`/branches/${branchId}/staff`),
        apiClient<OrgMember[]>("/organizations/current/members"),
      ]);

      setBranch(branchData);
      setAssignments(staffList || []);
      setMembers(membersList || []);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load branch staff data");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    if (organization && branchId) {
      fetchData();
    }
  }, [authLoading, isAuthenticated, organization, branchId, fetchData, router]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgUserId) return;

    setIsAssigning(true);
    setStatusMessage(null);

    try {
      await apiClient(`/branches/${branchId}/staff`, {
        method: "POST",
        body: JSON.stringify({ organizationUserId: selectedOrgUserId }),
      });

      setStatusMessage({
        type: "success",
        text: "Staff member assigned successfully!",
      });
      setSelectedOrgUserId("");
      await fetchData();
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: (err as Error).message || "Failed to assign staff member",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassign = async (assignmentId: string, staffName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to unassign ${staffName} from this branch?`,
    );
    if (!confirmed) return;

    setActionLoading(assignmentId);
    setStatusMessage(null);

    try {
      await apiClient(`/branches/${branchId}/staff/${assignmentId}`, {
        method: "DELETE",
      });

      setStatusMessage({
        type: "success",
        text: `${staffName} unassigned successfully!`,
      });
      await fetchData();
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: (err as Error).message || "Failed to unassign staff member",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const canManageStaff = organization?.permissions?.includes(
    Permission.ORGANIZATION_BRANCH_STAFF_MANAGE,
  );

  const assignedOrgUserIds = new Set(assignments.map((a) => a.organizationUserId));
  const availableMembers = members.filter((m) => !assignedOrgUserIds.has(m.id));

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href={`/dashboard/branches/${branchId}`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to {branch?.name || "Branch"}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-600/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              Branch Staff Deployment
            </h1>
            <Badge variant="secondary">{branch?.name}</Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Assign trainers, receptionists, and managers to this branch location.
          </p>
        </div>

        <button
          onClick={() => fetchData()}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#131622] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 transition-colors shadow-sm self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 border shadow-sm ${
            statusMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Assign New Staff Form */}
      {canManageStaff && (
        <div className="p-5 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm">
          <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
            Deploy Staff to {branch?.name}
          </h3>

          <form onSubmit={handleAssign} className="flex flex-col sm:flex-row items-center gap-3">
            <select
              value={selectedOrgUserId}
              onChange={(e) => setSelectedOrgUserId(e.target.value)}
              className="w-full sm:flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="">-- Choose Team Member to Deploy --</option>
              {availableMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName} ({m.email}) — {m.role}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={!selectedOrgUserId || isAssigning}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-500/20 disabled:opacity-50 transition-all shrink-0"
            >
              {isAssigning ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  Assign Member
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Assigned Staff Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#131622] overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <RotateCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-500" />
            <p className="text-xs">Loading deployed staff...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : assignments.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Staff Assigned Yet"
            description="Use the assignment selector above to deploy team members to this facility."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-white/[0.08] uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Staff Member</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Assignment Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {assignments.map((assignment) => {
                  const staffName = assignment.user
                    ? `${assignment.user.firstName} ${assignment.user.lastName}`
                    : "Staff Member";
                  const isBusy = actionLoading === assignment.id;

                  return (
                    <tr
                      key={assignment.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-violet-600/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {assignment.user?.firstName?.[0] || "U"}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {staffName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {assignment.user?.email || "—"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300">
                          {assignment.user?.role || "STAFF"}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {assignment.assignedAt
                              ? new Date(assignment.assignedAt).toLocaleDateString("en-IN")
                              : "—"}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        {canManageStaff && (
                          <button
                            disabled={isBusy}
                            onClick={() => handleUnassign(assignment.id, staffName)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors disabled:opacity-50"
                            title="Unassign from branch"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Unassign
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
