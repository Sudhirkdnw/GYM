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
import { BillingNav } from "@/components/billing/BillingNav";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Search,
  RotateCcw,
  Clock,
  AlertTriangle,
  CreditCard,
  Building,
  CheckCircle2,
  X,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
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
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Outstanding Dues & Aging
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitor receivables, track overdue member accounts, and reconcile aging buckets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchDues()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#131622] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 transition-colors shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Sub Nav */}
      <BillingNav />

      {/* Aging KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Outstanding */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total Outstanding</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              ₹{(agingSummary?.totalOutstanding || 0).toLocaleString("en-IN")}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {agingSummary?.affectedMembers || 0} members affected
            </p>
          </div>
        </div>

        {/* Current (0-30 Days) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Current</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              ₹{(agingSummary?.bracketCurrent || 0).toLocaleString("en-IN")}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">0-30 days period</p>
          </div>
        </div>

        {/* 31-60 Days */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>31-60 Days</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              ₹{(agingSummary?.bracket30 || 0).toLocaleString("en-IN")}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">Grace period</p>
          </div>
        </div>

        {/* 61-90 Days */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>61-90 Days</span>
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50" />
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold tracking-tight text-orange-600 dark:text-orange-400">
              ₹{(agingSummary?.bracket60 || 0).toLocaleString("en-IN")}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">Critical overdue</p>
          </div>
        </div>

        {/* 90+ Days */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>90+ Days</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shadow-sm shadow-rose-600/50" />
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              ₹{(agingSummary?.bracket90Plus || 0).toLocaleString("en-IN")}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">High risk balance</p>
          </div>
        </div>

        {/* Overdue Invoices */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Pending Invoices</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {agingSummary?.totalOverdueInvoices || 0}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">Unsettled invoices</p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search member name or phone..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div>
            <select
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="">All Branches</option>
              {branches?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={bracketFilter}
              onChange={(e) => {
                setBracketFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="ALL">All Aging Brackets</option>
              <option value="CURRENT">Current (0-30 Days)</option>
              <option value="1-30">1-30 Days Overdue</option>
              <option value="31-60">31-60 Days Overdue</option>
              <option value="61-90">61-90 Days Overdue</option>
              <option value="90+">90+ Days Overdue</option>
            </select>
          </div>

          <div className="flex items-center justify-end">
            {(search || branchFilter || bracketFilter !== "ALL") && (
              <button
                onClick={() => {
                  setSearch("");
                  setBranchFilter("");
                  setBracketFilter("ALL");
                  setPage(1);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#131622] overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <RotateCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-500" />
            <p className="text-xs">Loading outstanding dues ledger...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : membersWithDues.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No Outstanding Dues Found"
            description="All member accounts are fully settled, or no matching records match your filter criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-white/[0.08] uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Member</th>
                  <th className="px-5 py-3.5">Branch</th>
                  <th className="px-5 py-3.5 text-right">Outstanding Due</th>
                  <th className="px-5 py-3.5 text-center">Unpaid Invoices</th>
                  <th className="px-5 py-3.5">Oldest Due Date</th>
                  <th className="px-5 py-3.5">Aging Bracket</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {membersWithDues.map((member) => (
                  <tr
                    key={member.memberId}
                    className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-violet-600/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {member.firstName?.[0]}
                          {member.lastName?.[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {member.firstName} {member.lastName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {member.memberNumber} • {member.phone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span>{member.branchName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="font-bold text-rose-600 dark:text-rose-400 text-sm">
                        ₹{Number(member.totalDue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300">
                        {member.invoiceCount} {member.invoiceCount === 1 ? "invoice" : "invoices"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                      {member.oldestDueDate ? (
                        <div>
                          <div className="font-medium">
                            {new Date(member.oldestDueDate).toLocaleDateString("en-IN")}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            ({member.daysOverdue} days ago)
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {member.bracket === "CURRENT" ? (
                        <Badge variant="success">Current (0-30d)</Badge>
                      ) : member.bracket === "1-30" || member.bracket === "31-60" ? (
                        <Badge variant="warning">{member.bracket} Days Overdue</Badge>
                      ) : (
                        <Badge variant="destructive">{member.bracket} Days Overdue</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleOpenCollectModal(member)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Collect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.01] text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* COLLECT PAYMENT MODAL */}
      <Modal
        isOpen={showCollectModal && !!selectedMember}
        onClose={() => setShowCollectModal(false)}
        title="Collect Member Dues"
        description={`${selectedMember?.firstName} ${selectedMember?.lastName} (${selectedMember?.memberNumber}) • Outstanding: ₹${(selectedMember?.totalDue || 0).toLocaleString("en-IN")}`}
        maxWidth="xl"
      >
        {paymentSuccess ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-semibold text-slate-900 dark:text-white">
              Payment Collected Successfully!
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Invoice dues have been updated and financial balances reconciled.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmitPayment} className="space-y-4">
            {paymentError && (
              <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-200 dark:border-rose-800">
                {paymentError}
              </div>
            )}

            {/* Total Payment Amount & Method */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Payment Amount Received (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Payment Method *
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value={PaymentMethod.UPI}>UPI / QR Code</option>
                  <option value={PaymentMethod.CASH}>Cash</option>
                  <option value={PaymentMethod.CARD}>Credit / Debit Card</option>
                  <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
                  <option value={PaymentMethod.CHEQUE}>Cheque</option>
                </select>
              </div>
            </div>

            {/* Method Specific Fields */}
            {payMethod === PaymentMethod.UPI && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  UPI Transaction ID / Ref
                </label>
                <input
                  type="text"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="e.g. 423985729182"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
            )}

            {payMethod === PaymentMethod.CHEQUE && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Cheque Number
                  </label>
                  <input
                    type="text"
                    value={payChequeNumber}
                    onChange={(e) => setPayChequeNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={payBankName}
                    onChange={(e) => setPayBankName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>
            )}

            {/* Unpaid Invoices Allocation Breakdown */}
            <div className="border border-slate-200 dark:border-white/[0.08] rounded-xl p-3 bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-violet-500" />
                  Invoice Allocations
                </span>
                <span className="text-[11px] text-slate-500">
                  Allocated: ₹{totalAllocated.toLocaleString("en-IN")} / ₹{payAmount.toLocaleString("en-IN")}
                </span>
              </div>

              {invoicesLoading ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  Loading member invoices...
                </div>
              ) : memberInvoices.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No pending invoices found for this member.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {memberInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between text-xs bg-white dark:bg-[#131622] p-2.5 rounded-lg border border-slate-200 dark:border-white/[0.06]"
                    >
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {inv.invoiceNumber}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          Due: {new Date(inv.dueDate).toLocaleDateString("en-IN")} • Balance: ₹{Number(inv.balanceDue).toLocaleString("en-IN")}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">Apply:</span>
                        <input
                          type="number"
                          step="0.01"
                          max={Number(inv.balanceDue)}
                          min={0}
                          value={allocations[inv.id] || 0}
                          onChange={(e) =>
                            handleAllocationChange(inv.id, parseFloat(e.target.value) || 0)
                          }
                          className="w-24 px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-right font-semibold"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Excess Amount Notice */}
              {excessAmount > 0 && (
                <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs">
                  <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                    Excess Amount: ₹{excessAmount.toLocaleString("en-IN")}
                  </span>
                  <label className="flex items-center gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={retainExcess}
                      onChange={(e) => setRetainExcess(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    Retain in Member Credit Wallet
                  </label>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Internal Remarks / Receipt Notes
              </label>
              <textarea
                rows={2}
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Optional notes regarding this payment settlement..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setShowCollectModal(false)}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingPayment}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 transition-colors"
              >
                {submittingPayment ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-3.5 h-3.5" />
                    Confirm Collection (₹{payAmount.toLocaleString("en-IN")})
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
