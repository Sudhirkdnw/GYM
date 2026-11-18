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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  ArrowLeft,
  UserPlus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Shield,
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
      router.push("/login");
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

  const handleRemove = async (orgUserId: string) => {
    const confirmRemove = window.confirm(
      "Are you sure you want to remove this staff assignment? They will lose branch-scoped operational access.",
    );
    if (!confirmRemove) return;

    setActionLoading(orgUserId);
    setStatusMessage(null);

    try {
      await apiClient(`/branches/${branchId}/staff/${orgUserId}`, {
        method: "DELETE",
      });

      setStatusMessage({
        type: "success",
        text: "Staff assignment removed successfully.",
      });
      await fetchData();
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: (err as Error).message || "Failed to remove staff assignment",
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-sm text-zinc-500">
        Loading staff assignments...
      </div>
    );
  }

  if (error || !branch) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link
          href={`/dashboard/branches/${branchId}`}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 mb-4"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Branch
        </Link>
        <div className="p-4 rounded-lg bg-red-50 text-red-800 text-sm">
          {error || "Branch not found"}
        </div>
      </div>
    );
  }

  const canManageStaff = organization?.permissions.includes(
    Permission.ORGANIZATION_BRANCH_STAFF_MANAGE,
  );

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 max-w-4xl">
      <div className="mb-6">
        <Link
          href={`/dashboard/branches/${branchId}`}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-2 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Back to {branch.name}
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-600" />
            Branch Staff Assignments
          </h1>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Assign trainers, receptionists, or managers to{" "}
          <strong>{branch.name}</strong> ({branch.branchCode}).
        </p>
      </div>

      {statusMessage && (
        <div
          className={`mb-6 p-4 rounded-lg text-sm flex items-center gap-2 ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
              : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Add Staff Assignment Form */}
      {canManageStaff && branch.status === "ACTIVE" && (
        <Card className="border-zinc-200 dark:border-zinc-800 mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-emerald-600" />
              Assign Team Member to this Branch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAssign} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <select
                  required
                  value={selectedOrgUserId}
                  onChange={(e) => setSelectedOrgUserId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select an organization staff member...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName} ({m.email}) — Role: {m.role}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={isAssigning || !selectedOrgUserId}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shrink-0"
              >
                {isAssigning ? "Assigning..." : "Assign Staff"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Assigned Staff Table */}
      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>Current Branch Staff</span>
            <span className="text-xs font-normal text-zinc-500">
              {assignments.filter((a) => a.status === "ACTIVE").length} active staff
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {assignments.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              No staff members are assigned to this branch yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Staff Member</th>
                    <th className="py-2.5 px-4 font-semibold">Org Role</th>
                    <th className="py-2.5 px-4 font-semibold">Assignment Status</th>
                    <th className="py-2.5 px-4 font-semibold">Assigned On</th>
                    {canManageStaff && (
                      <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {assignments.map((assignment) => {
                    const isBusy = actionLoading === assignment.organizationUserId;
                    const isActive = assignment.status === "ACTIVE";
                    return (
                      <tr
                        key={assignment.id}
                        className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40"
                      >
                        <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                          <div>
                            {assignment.user?.firstName} {assignment.user?.lastName}
                          </div>
                          <span className="text-[11px] text-zinc-400 font-normal">
                            {assignment.user?.email}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                            <Shield className="h-3 w-3 text-zinc-400" />
                            {assignment.user?.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isActive
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                          >
                            {assignment.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-zinc-500">
                          {new Date(assignment.assignedAt).toLocaleDateString()}
                        </td>
                        {canManageStaff && (
                          <td className="py-3 px-4 text-right">
                            {isActive && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isBusy}
                                onClick={() => handleRemove(assignment.organizationUserId)}
                                className="h-7 text-xs px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Remove
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
