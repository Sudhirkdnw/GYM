"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import {
  PaymentData,
  PaymentDetailData,
  MemberData,
  InvoiceData,
  PaymentMethod,
  PaginatedResult,
} from "@gymos/shared-types";
import { BillingNav } from "@/components/billing/BillingNav";
import {
  Search,
  Plus,
  RotateCcw,
  CreditCard,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  Receipt,
  Building2,
  Wallet,
} from "lucide-react";

export default function PaymentsPage() {
  const router = useRouter();
  const { organization, branches, isAuthenticated, isLoading: authLoading } = useAuth();

  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [methodFilter, setMethodFilter] = useState<string>("ALL");
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  // Modals state
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);

  const [selectedPayment, setSelectedPayment] = useState<PaymentDetailData | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Record Payment Form State
  const [payMemberId, setPayMemberId] = useState("");
  const [payBranchId, setPayBranchId] = useState("");
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>(PaymentMethod.UPI);
  const [payReference, setPayReference] = useState("");
  const [payBankName, setPayBankName] = useState("");
  const [payChequeNumber, setPayChequeNumber] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [unpaidInvoices, setUnpaidInvoices] = useState<InvoiceData[]>([]);
  const [allocations, setAllocations] = useState<{ [invoiceId: string]: number }>({});
  const [retainExcess, setRetainExcess] = useState(true);

  // Refund Form State
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState("");
  const [refundReference, setRefundReference] = useState("");

  const fetchPayments = useCallback(async () => {
    if (!organization) return;
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("limit", "15");
      if (methodFilter !== "ALL") params.append("method", methodFilter);
      if (branchFilter) params.append("branchId", branchFilter);
      if (search) params.append("search", search);

      const res = await apiClient<PaginatedResult<PaymentData>>(`billing/payments?${params.toString()}`);
      setPayments(res.items || []);
      setTotalPages(res.meta.totalPages || 1);
      setTotalCount(res.meta.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payment transactions");
    } finally {
      setLoading(false);
    }
  }, [organization, page, methodFilter, branchFilter, search]);

  const fetchMembers = useCallback(async () => {
    if (!organization) return;
    try {
      const res = await apiClient<PaginatedResult<MemberData>>("members?limit=100");
      setMembers(res.items || []);
    } catch {
      // Non-blocking
    }
  }, [organization]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (organization) {
      fetchPayments();
      fetchMembers();
    }
  }, [authLoading, isAuthenticated, organization, router, fetchPayments, fetchMembers]);

  // Fetch unpaid invoices when member is selected in Record Payment
  useEffect(() => {
    if (!payMemberId) {
      setUnpaidInvoices([]);
      setAllocations({});
      return;
    }

    const loadMemberInvoices = async () => {
      try {
        const res = await apiClient<PaginatedResult<InvoiceData>>(
          `billing/invoices?memberId=${payMemberId}&limit=50`,
        );
        const dueOnly = (res.items || []).filter(
          (inv) => inv.balanceDue > 0 && inv.status !== "VOID" && inv.status !== "REFUNDED",
        );
        setUnpaidInvoices(dueOnly);

        // Pre-allocate first invoice
        if (dueOnly.length > 0 && dueOnly[0]) {
          setPayAmount(dueOnly[0].balanceDue);
          setAllocations({ [dueOnly[0].id]: dueOnly[0].balanceDue });
        }
      } catch {
        // Non-blocking
      }
    };

    loadMemberInvoices();
  }, [payMemberId]);

  const handleOpenDetailModal = async (paymentId: string) => {
    try {
      setModalLoading(true);
      const detail = await apiClient<PaymentDetailData>(`billing/payments/${paymentId}`);
      setSelectedPayment(detail);
      setShowDetailModal(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load payment details");
    } finally {
      setModalLoading(false);
    }
  };

  const handleOpenRefundModal = async (paymentId: string) => {
    try {
      setModalLoading(true);
      const detail = await apiClient<PaymentDetailData>(`billing/payments/${paymentId}`);
      setSelectedPayment(detail);

      const totalRefunded = (detail.refunds || []).reduce((sum, r) => sum + r.amount, 0);
      const availableToRefund = Math.max(0, detail.amount - totalRefunded);

      setRefundAmount(availableToRefund);
      setRefundReason("");
      setRefundReference("");
      setModalError(null);
      setShowRefundModal(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load payment for refund");
    } finally {
      setModalLoading(false);
    }
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setModalLoading(true);
      setModalError(null);

      const targetBranch = payBranchId || branches[0]?.id;
      if (!targetBranch) throw new Error("Please select a branch");
      if (!payMemberId) throw new Error("Please select a member");
      if (payAmount <= 0) throw new Error("Payment amount must be greater than zero");

      const allocationItems = Object.entries(allocations)
        .filter(([_, amt]) => amt > 0)
        .map(([invoiceId, amt]) => ({ invoiceId, amount: Number(amt) }));

      await apiClient("billing/payments", {
        method: "POST",
        body: JSON.stringify({
          branchId: targetBranch,
          memberId: payMemberId,
          amount: Number(payAmount),
          method: payMethod,
          transactionReference: payReference,
          bankName: payBankName,
          chequeNumber: payChequeNumber,
          notes: payNotes,
          allocations: allocationItems,
          retainExcessAsCredit: retainExcess,
        }),
      });

      setShowRecordModal(false);
      fetchPayments();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setModalLoading(false);
    }
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;
    try {
      setModalLoading(true);
      setModalError(null);

      await apiClient(`billing/payments/${selectedPayment.id}/refund`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(refundAmount),
          reason: refundReason,
          reference: refundReference,
        }),
      });

      setShowRefundModal(false);
      fetchPayments();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to process refund");
    } finally {
      setModalLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-primary" />
              Payment Receipts Ledger
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {totalCount} Receipts
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manual payment recording, invoice allocation, receipts, and refund reversals.
          </p>
        </div>

        <button
          onClick={() => {
            setPayBranchId(branches[0]?.id || "");
            setPayMemberId("");
            setPayAmount(0);
            setPayReference("");
            setShowRecordModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Record Payment
        </button>
      </div>

      {/* Navigation Sub-menu */}
      <BillingNav />

      {/* Filter Bar */}
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {["ALL", "UPI", "CASH", "CARD", "BANK_TRANSFER", "CHEQUE", "MEMBER_CREDIT"].map((method) => (
              <button
                key={method}
                onClick={() => {
                  setMethodFilter(method);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  methodFilter === method
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                {method.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            {branches.length > 1 && (
              <select
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 text-xs rounded-xl border border-border bg-background/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            <div className="relative flex-1 md:w-64">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search receipt #, UTR, member..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-border bg-background/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 bg-red-500/10 text-red-500 text-xs border-b border-red-500/20">
            {error}
          </div>
        )}
        {loading ? (
          <div className="py-20 text-center text-xs text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
            Loading payment ledger...
          </div>
        ) : payments.length === 0 ? (
          <div className="py-20 text-center">
            <CreditCard className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-bold text-foreground">No payment transactions found</p>
            <p className="text-xs text-muted-foreground mt-1">Record a new payment to update ledger</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-border/60 bg-muted/40 uppercase tracking-wider text-[10px] text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Paid At</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-accent/40 transition-colors group">
                    <td className="py-3.5 px-4 font-mono font-bold text-primary">
                      {p.paymentNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-foreground">
                        {p.member?.firstName} {p.member?.lastName}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{p.member?.phone}</div>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground font-medium">
                      {p.branch?.name || "Main"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-muted text-muted-foreground border border-border/60">
                        {p.method}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-muted-foreground text-[11px]">
                      {p.transactionReference || p.chequeNumber || "—"}
                    </td>
                    <td className="py-3.5 px-4 font-bold font-mono text-emerald-500">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">{p.paidAt.slice(0, 10)}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
                          p.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : p.status === "PENDING"
                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                            : p.status === "PARTIALLY_REFUNDED"
                            ? "bg-purple-500/10 text-purple-500 border-purple-500/20"
                            : "bg-red-500/10 text-red-500 border-red-500/20"
                        }`}
                      >
                        {p.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDetailModal(p.id)}
                          className="p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="View Receipt"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {organization?.role !== "RECEPTIONIST" &&
                          p.status !== "REFUNDED" &&
                          p.status !== "FAILED" && (
                            <button
                              onClick={() => handleOpenRefundModal(p.id)}
                              className="p-1.5 rounded-lg border border-border bg-card hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                              title="Issue Refund"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
            <span>
              Showing <span className="font-semibold text-foreground">{payments.length}</span> of{" "}
              <span className="font-semibold text-foreground">{totalCount}</span> receipts
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1 rounded-xl border border-border bg-card hover:bg-accent disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 font-medium">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2.5 py-1 rounded-xl border border-border bg-card hover:bg-accent disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: RECORD PAYMENT */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-card rounded-2xl border border-border/80 shadow-2xl max-w-xl w-full p-6 my-8 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Record Member Payment
              </h2>
              <button
                onClick={() => setShowRecordModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleRecordSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Member <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={payMemberId}
                    onChange={(e) => setPayMemberId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Select Member</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName} ({m.memberNumber}) - {m.phone}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Branch <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={payBranchId}
                    onChange={(e) => setPayBranchId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.branchCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Amount Paid (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Payment Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value={PaymentMethod.UPI}>UPI (GPay / PhonePe / QR)</option>
                    <option value={PaymentMethod.CASH}>Cash (Front-Desk)</option>
                    <option value={PaymentMethod.CARD}>Credit / Debit Card (POS)</option>
                    <option value={PaymentMethod.BANK_TRANSFER}>NEFT / IMPS / RTGS</option>
                    <option value={PaymentMethod.CHEQUE}>Cheque</option>
                    <option value={PaymentMethod.MEMBER_CREDIT}>Member Wallet Credit</option>
                  </select>
                </div>
              </div>

              {/* Reference and details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Transaction Ref / UTR / Auth Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 402918239012"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground font-mono"
                  />
                </div>

                {payMethod === PaymentMethod.CHEQUE && (
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Cheque # & Bank
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Cheque #"
                        value={payChequeNumber}
                        onChange={(e) => setPayChequeNumber(e.target.value)}
                        className="w-1/2 px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Bank Name"
                        value={payBankName}
                        onChange={(e) => setPayBankName(e.target.value)}
                        className="w-1/2 px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Unpaid Invoices Allocation */}
              {unpaidInvoices.length > 0 && (
                <div className="border border-border/60 rounded-xl p-3.5 space-y-2.5 bg-muted/20">
                  <span className="text-xs font-bold text-foreground block">
                    Allocate to Outstanding Invoices
                  </span>
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {unpaidInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between p-2 rounded-xl border border-border/60 bg-card text-xs"
                      >
                        <div>
                          <span className="font-mono font-bold text-primary">{inv.invoiceNumber}</span>
                          <span className="text-muted-foreground ml-2">
                            (Due: {formatCurrency(inv.balanceDue)})
                          </span>
                        </div>
                        <div className="w-28">
                          <input
                            type="number"
                            min="0"
                            max={inv.balanceDue}
                            step="0.01"
                            value={allocations[inv.id] || 0}
                            onChange={(e) =>
                              setAllocations({
                                ...allocations,
                                [inv.id]: Number(e.target.value),
                              })
                            }
                            className="w-full px-2 py-1 text-right rounded-lg border border-border bg-background text-foreground font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={retainExcess}
                        onChange={(e) => setRetainExcess(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <span>Store unallocated surplus as Member Wallet Credit</span>
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Internal Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional staff remarks..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  disabled={modalLoading}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50"
                >
                  {modalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Record Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETAIL / RECEIPT VIEW */}
      {showDetailModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-border/80 shadow-2xl max-w-lg w-full p-6 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
              <span className="text-sm font-bold text-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                Payment Receipt ({selectedPayment.paymentNumber})
              </span>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-muted/20 border border-border/60 rounded-xl space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-border/40">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-bold font-mono text-base text-emerald-500">
                  {formatCurrency(selectedPayment.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Member:</span>
                <span className="font-semibold text-foreground">
                  {selectedPayment.member?.firstName} {selectedPayment.member?.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method:</span>
                <span className="font-semibold text-foreground">{selectedPayment.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reference:</span>
                <span className="font-mono text-foreground">{selectedPayment.transactionReference || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid At:</span>
                <span className="text-foreground">{selectedPayment.paidAt}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-bold text-emerald-500">{selectedPayment.status}</span>
              </div>

              {/* Invoice Allocations */}
              {selectedPayment.allocations && selectedPayment.allocations.length > 0 && (
                <div className="pt-2 border-t border-border/40 space-y-1.5">
                  <span className="font-semibold text-foreground block">Allocated Invoices:</span>
                  {selectedPayment.allocations.map((a) => (
                    <div key={a.id} className="flex justify-between text-[11px] text-muted-foreground">
                      <span className="font-mono">{a.invoice?.invoiceNumber || a.invoiceId}</span>
                      <span className="font-mono font-medium text-foreground">{formatCurrency(a.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-accent"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REFUND PAYMENT */}
      {showRefundModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-red-500/30 shadow-2xl max-w-md w-full p-6 animate-scaleIn">
            <h2 className="text-base font-bold text-red-500 flex items-center gap-2 mb-2">
              <RotateCcw className="h-4 w-4" />
              Issue Refund ({selectedPayment.paymentNumber})
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Reverse customer payment and adjust invoice allocations automatically.
            </p>

            {modalError && (
              <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleRefundSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Refund Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Refund Reason <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Accidental duplicate payment, customer cancellation"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Bank / UPI Refund Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. REF-8392819"
                  value={refundReference}
                  onChange={(e) => setRefundReference(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  disabled={modalLoading}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm disabled:opacity-50"
                >
                  {modalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm Refund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
