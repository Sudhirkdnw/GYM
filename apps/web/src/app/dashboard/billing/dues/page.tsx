"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import {
  InvoiceData,
  PaymentMethod,
  PaginatedResult,
} from "@gymos/shared-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BillingNav } from "@/components/billing/BillingNav";
import {
  Search,
  RotateCcw,
  Clock,
  AlertTriangle,
  DollarSign,
  CheckCircle2,
  X,
  CreditCard,
  Building,
} from "lucide-react";

interface MemberDuesItem {
  memberId: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  branchId: string;
  branchName: string;
  totalDue: number;
  invoiceCount: number;
  oldestDueDate: string;
  daysOverdue: number;
  bracket: "CURRENT" | "1-30" | "31-60" | "61-90" | "90+";
}

interface AgingSummary {
  bracketCurrent: number;
  bracket30: number;
  bracket60: number;
  bracket90Plus: number;
  totalOutstanding: number;
  totalOverdueInvoices: number;
  affectedMembers: number;
}

interface DuesResponse {
  agingSummary: AgingSummary;
  members: PaginatedResult<MemberDuesItem>;
}

export default function OutstandingDuesPage() {
  const router = useRouter();
  const { organization, branches, isAuthenticated, isLoading: authLoading } = useAuth();

  const [agingSummary, setAgingSummary] = useState<AgingSummary | null>(null);
  const [membersWithDues, setMembersWithDues] = useState<MemberDuesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [bracketFilter, setBracketFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  // Collect Payment Modal
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberDuesItem | null>(null);
  const [memberInvoices, setMemberInvoices] = useState<InvoiceData[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>(PaymentMethod.UPI);
  const [payReference, setPayReference] = useState("");
  const [payBankName, setPayBankName] = useState("");
  const [payChequeNumber, setPayChequeNumber] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [allocations, setAllocations] = useState<{ [invoiceId: string]: number }>({});
  const [retainExcess, setRetainExcess] = useState(true);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const fetchDues = useCallback(async () => {
    if (!organization) return;
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("limit", "15");
      if (branchFilter) params.append("branchId", branchFilter);
      if (bracketFilter !== "ALL") params.append("bracket", bracketFilter);
      if (search) params.append("search", search);

      const res = await apiClient<DuesResponse>(`billing/dues?${params.toString()}`);
      setAgingSummary(res.agingSummary);
      setMembersWithDues(res.members.items || []);
      setTotalPages(res.members.meta.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load outstanding dues data");
    } finally {
      setLoading(false);
    }
  }, [organization, page, branchFilter, bracketFilter, search]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (organization) {
      fetchDues();
    }
  }, [organization, fetchDues]);

  // Open Collect Payment Modal for a Member
  const handleOpenCollectModal = async (member: MemberDuesItem) => {
    setSelectedMember(member);
    setPaymentError(null);
    setPaymentSuccess(false);
    setPayAmount(member.totalDue);
    setPayMethod(PaymentMethod.UPI);
    setPayReference("");
    setPayBankName("");
    setPayChequeNumber("");
    setPayNotes("");
    setShowCollectModal(true);

    try {
      setInvoicesLoading(true);
      const res = await apiClient<PaginatedResult<InvoiceData>>(
        `billing/invoices?memberId=${member.memberId}&status=ISSUED&limit=50`
      );
      const invoices = res.items || [];
      // Also get partially paid
      const resPartially = await apiClient<PaginatedResult<InvoiceData>>(
        `billing/invoices?memberId=${member.memberId}&status=PARTIALLY_PAID&limit=50`
      );
      const allUnpaid = [...invoices, ...(resPartially.items || [])];
      setMemberInvoices(allUnpaid);

      // Auto allocate to oldest invoices first
      let remaining = member.totalDue;
      const initialAllocations: { [id: string]: number } = {};
      for (const inv of allUnpaid) {
        if (remaining <= 0) break;
        const alloc = Math.min(Number(inv.balanceDue), remaining);
        initialAllocations[inv.id] = alloc;
        remaining -= alloc;
      }
      setAllocations(initialAllocations);
    } catch {
      // fallback
    } finally {
      setInvoicesLoading(false);
    }
  };

  const handleAmountChange = (newAmount: number) => {
    setPayAmount(newAmount);
    // Auto-reallocate
    let remaining = newAmount;
    const newAllocations: { [id: string]: number } = {};
    for (const inv of memberInvoices) {
      if (remaining <= 0) break;
      const alloc = Math.min(Number(inv.balanceDue), remaining);
      newAllocations[inv.id] = alloc;
      remaining -= alloc;
    }
    setAllocations(newAllocations);
  };

  const handleAllocationChange = (invoiceId: string, val: number) => {
    const updated = { ...allocations, [invoiceId]: val };
    setAllocations(updated);
    const sum = Object.values(updated).reduce((acc, curr) => acc + curr, 0);
    setPayAmount(sum);
  };

  const totalAllocated = Object.values(allocations).reduce((acc, curr) => acc + (curr || 0), 0);
  const excessAmount = Math.max(0, payAmount - totalAllocated);

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    if (payAmount <= 0) {
      setPaymentError("Payment amount must be greater than zero");
      return;
    }

    try {
      setSubmittingPayment(true);
      setPaymentError(null);

      const allocationList = Object.entries(allocations)
        .filter(([, amt]) => amt > 0)
        .map(([invoiceId, allocatedAmount]) => ({
          invoiceId,
          allocatedAmount,
        }));

      await apiClient("billing/payments", {
        method: "POST",
        body: JSON.stringify({
          memberId: selectedMember.memberId,
          branchId: selectedMember.branchId,
          amount: payAmount,
          paymentMethod: payMethod,
          referenceNumber: payReference || undefined,
          bankName: payBankName || undefined,
          chequeNumber: payChequeNumber || undefined,
          notes: payNotes || undefined,
          allocations: allocationList,
          retainExcessInCredit: retainExcess,
          idempotencyKey: `due-pay-${selectedMember.memberId}-${Date.now()}`,
        }),
      });

      setPaymentSuccess(true);
      setTimeout(() => {
        setShowCollectModal(false);
        fetchDues();
      }, 1500);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Breadcrumb & Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Outstanding Dues & Aging
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Monitor receivables, track overdue member accounts, and collect outstanding balances.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDues()}
            className="border-zinc-200 dark:border-zinc-800"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Billing Sub-Navigation */}
      <BillingNav />

      {/* Aging KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm col-span-2 sm:col-span-1 lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium">
              <span>Total Dues</span>
              <DollarSign className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2 text-xl font-bold text-rose-600 dark:text-rose-400">
              ₹{(agingSummary?.totalOutstanding || 0).toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {agingSummary?.affectedMembers || 0} members affected
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium">
              <span>Current</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              ₹{(agingSummary?.bracketCurrent || 0).toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-zinc-400 mt-1">Due in 0-30 days</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium">
              <span>31-60 Days</span>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            </div>
            <div className="mt-2 text-lg font-bold text-amber-600 dark:text-amber-400">
              ₹{(agingSummary?.bracket30 || 0).toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-zinc-400 mt-1">Grace period</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium">
              <span>61-90 Days</span>
              <span className="w-2 h-2 rounded-full bg-orange-500" />
            </div>
            <div className="mt-2 text-lg font-bold text-orange-600 dark:text-orange-400">
              ₹{(agingSummary?.bracket60 || 0).toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-zinc-400 mt-1">Critical overdue</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium">
              <span>90+ Days</span>
              <span className="w-2 h-2 rounded-full bg-rose-600" />
            </div>
            <div className="mt-2 text-lg font-bold text-rose-600 dark:text-rose-400">
              ₹{(agingSummary?.bracket90Plus || 0).toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-zinc-400 mt-1">High risk bad debt</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium">
              <span>Overdue Invoices</span>
              <Clock className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {agingSummary?.totalOverdueInvoices || 0}
            </div>
            <p className="text-xs text-zinc-400 mt-1">Total pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search member name or phone..."
                className="w-full pl-9 pr-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Branch Filter */}
            <div>
              <select
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Branches</option>
                {branches?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Aging Bracket Filter */}
            <div>
              <select
                value={bracketFilter}
                onChange={(e) => {
                  setBracketFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">All Aging Brackets</option>
                <option value="CURRENT">Current (0-30 Days)</option>
                <option value="1-30">1-30 Days Overdue</option>
                <option value="31-60">31-60 Days Overdue</option>
                <option value="61-90">61-90 Days Overdue</option>
                <option value="90+">90+ Days Overdue</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-center">
              {(search || branchFilter || bracketFilter !== "ALL") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setBranchFilter("");
                    setBracketFilter("ALL");
                    setPage(1);
                  }}
                  className="text-xs text-zinc-500 dark:text-zinc-400"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table / Member Dues List */}
      <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-zinc-400">
            <RotateCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
            Loading outstanding dues ledger...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            {error}
          </div>
        ) : membersWithDues.length === 0 ? (
          <div className="p-12 text-center text-zinc-400">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
            <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
              No Outstanding Dues Found
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
              All member accounts are fully settled, or no matching records match the selected filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3 text-right">Outstanding Due</th>
                  <th className="px-4 py-3 text-center">Unpaid Invoices</th>
                  <th className="px-4 py-3">Oldest Due Date</th>
                  <th className="px-4 py-3">Aging Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {membersWithDues.map((member) => (
                  <tr
                    key={member.memberId}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {member.firstName} {member.lastName}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {member.memberNumber} • {member.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{member.branchName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold text-rose-600 dark:text-rose-400">
                        ₹{Number(member.totalDue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {member.invoiceCount} {member.invoiceCount === 1 ? "invoice" : "invoices"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-xs">
                      {member.oldestDueDate ? (
                        <div>
                          <div>{new Date(member.oldestDueDate).toLocaleDateString("en-IN")}</div>
                          <div className="text-zinc-400">({member.daysOverdue} days ago)</div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {member.bracket === "CURRENT" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          Current (0-30d)
                        </span>
                      ) : member.bracket === "1-30" || member.bracket === "31-60" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          {member.bracket} Days Overdue
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                          {member.bracket} Days Overdue
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        onClick={() => handleOpenCollectModal(member)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm"
                      >
                        <CreditCard className="w-3.5 h-3.5 mr-1" />
                        Collect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="text-xs"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* COLLECT PAYMENT MODAL */}
      {showCollectModal && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  Collect Member Dues
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {selectedMember.firstName} {selectedMember.lastName} ({selectedMember.memberNumber}) • Total Outstanding: ₹{selectedMember.totalDue.toLocaleString("en-IN")}
                </p>
              </div>
              <button
                onClick={() => setShowCollectModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {paymentSuccess ? (
              <div className="py-8 text-center text-emerald-600 space-y-2">
                <CheckCircle2 className="w-12 h-12 mx-auto" />
                <h4 className="text-base font-semibold">Payment Collected Successfully!</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Invoice dues updated and financial ledger reconciled.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitPayment} className="space-y-4">
                {paymentError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{paymentError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Payment Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={payAmount || ""}
                      onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Payment Method *
                    </label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                      className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value={PaymentMethod.UPI}>UPI (GPay / PhonePe / Paytm)</option>
                      <option value={PaymentMethod.CASH}>Cash</option>
                      <option value={PaymentMethod.CARD}>Credit / Debit Card</option>
                      <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer (NEFT/IMPS)</option>
                      <option value={PaymentMethod.CHEQUE}>Cheque</option>
                      <option value={PaymentMethod.MEMBER_CREDIT}>Member Credit Wallet</option>
                    </select>
                  </div>
                </div>

                {/* Conditional Method Fields */}
                {payMethod === PaymentMethod.UPI && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      UPI UTR / Transaction ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 332490184712"
                      value={payReference}
                      onChange={(e) => setPayReference(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                )}

                {payMethod === PaymentMethod.BANK_TRANSFER && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. HDFC Bank"
                        value={payBankName}
                        onChange={(e) => setPayBankName(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        UTR / Transfer Reference
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. N103829471"
                        value={payReference}
                        onChange={(e) => setPayReference(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                )}

                {payMethod === PaymentMethod.CHEQUE && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Cheque Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 000124"
                        value={payChequeNumber}
                        onChange={(e) => setPayChequeNumber(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. SBI"
                        value={payBankName}
                        onChange={(e) => setPayBankName(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                )}

                {/* Invoices to Allocate */}
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 bg-zinc-50 dark:bg-zinc-800/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Invoice Allocation Breakdown
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Allocated: ₹{totalAllocated.toLocaleString("en-IN")} / ₹{payAmount.toLocaleString("en-IN")}
                    </span>
                  </div>

                  {invoicesLoading ? (
                    <div className="text-center py-4 text-xs text-zinc-400">
                      Loading invoices...
                    </div>
                  ) : memberInvoices.length === 0 ? (
                    <div className="text-center py-4 text-xs text-zinc-400">
                      No unpaid invoices found. Any collected amount will be added to member credit.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {memberInvoices.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between text-xs bg-white dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700"
                        >
                          <div>
                            <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                              {inv.invoiceNumber}
                            </span>
                            <div className="text-zinc-400 text-[11px]">
                              Due: ₹{Number(inv.balanceDue).toLocaleString("en-IN")} • Date:{" "}
                              {new Date(inv.issueDate).toLocaleDateString("en-IN")}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-400">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={Number(inv.balanceDue)}
                              value={allocations[inv.id] ?? 0}
                              onChange={(e) =>
                                handleAllocationChange(inv.id, parseFloat(e.target.value) || 0)
                              }
                              className="w-24 px-2 py-1 text-right text-xs rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {excessAmount > 0 && (
                    <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        Excess / Overpayment: ₹{excessAmount.toLocaleString("en-IN")}
                      </span>
                      <label className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={retainExcess}
                          onChange={(e) => setRetainExcess(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Retain in Member Wallet</span>
                      </label>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Internal Note / Remarks
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Optional collection note..."
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCollectModal(false)}
                    disabled={submittingPayment}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submittingPayment}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs"
                  >
                    {submittingPayment ? "Processing..." : `Record ₹${payAmount.toLocaleString("en-IN")} Payment`}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
