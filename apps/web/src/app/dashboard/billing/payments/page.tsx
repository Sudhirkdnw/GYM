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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Payment Transactions Ledger
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manual payment recording, invoice allocation, receipts, and refund reversals
          </p>
        </div>

        <Button
          onClick={() => {
            setPayBranchId(branches[0]?.id || "");
            setPayMemberId("");
            setPayAmount(0);
            setPayReference("");
            setShowRecordModal(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Record Payment
        </Button>
      </div>

      {/* Navigation Sub-menu */}
      <BillingNav />

      {/* Filter Bar */}
      <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm mb-6">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {["ALL", "UPI", "CASH", "CARD", "BANK_TRANSFER", "CHEQUE", "MEMBER_CREDIT"].map((method) => (
              <button
                key={method}
                onClick={() => {
                  setMethodFilter(method);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  methodFilter === method
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
                className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500"
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
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search receipt #, UTR, member..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
        <CardContent className="p-0">
          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs border-b border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}
          {loading ? (
            <div className="py-16 text-center text-sm text-zinc-500">
              Loading payment ledger...
            </div>
          ) : payments.length === 0 ? (
            <div className="py-16 text-center">
              <CreditCard className="h-10 w-10 text-zinc-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No payment transactions found</p>
              <p className="text-xs text-zinc-500 mt-1">Record a new payment to update ledger</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 bg-zinc-50 dark:bg-zinc-900/80">
                  <tr>
                    <th className="py-3 px-4 font-medium">Receipt #</th>
                    <th className="py-3 px-4 font-medium">Member</th>
                    <th className="py-3 px-4 font-medium">Branch</th>
                    <th className="py-3 px-4 font-medium">Method</th>
                    <th className="py-3 px-4 font-medium">Reference</th>
                    <th className="py-3 px-4 font-medium">Amount</th>
                    <th className="py-3 px-4 font-medium">Paid At</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        {p.paymentNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {p.member?.firstName} {p.member?.lastName}
                        </div>
                        <div className="text-[10px] text-zinc-500">{p.member?.phone}</div>
                      </td>
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                        {p.branch?.name || "Main"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {p.method}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-500">
                        {p.transactionReference || p.chequeNumber || "—"}
                      </td>
                      <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="py-3 px-4 text-zinc-500">{p.paidAt.slice(0, 10)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                            p.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400"
                              : p.status === "PENDING"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400"
                              : p.status === "PARTIALLY_REFUNDED"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-400"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400"
                          }`}
                        >
                          {p.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetailModal(p.id)}
                            className="h-7 px-2 text-zinc-600 dark:text-zinc-400 hover:text-emerald-600"
                            title="View Receipt"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          {organization?.role !== "RECEPTIONIST" &&
                            p.status !== "REFUNDED" &&
                            p.status !== "FAILED" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenRefundModal(p.id)}
                                className="h-7 px-2 text-zinc-600 dark:text-zinc-400 hover:text-rose-600"
                                title="Issue Refund"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
              <span>
                Showing {payments.length} of {totalCount} transactions
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-7 px-2"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-2 font-medium">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-7 px-2"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* =========================================================================
          MODAL: RECORD PAYMENT
          ========================================================================= */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl max-w-xl w-full p-6 my-8">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                Record Payment Received
              </h2>
              <button
                onClick={() => setShowRecordModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleRecordSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Member *
                  </label>
                  <select
                    required
                    value={payMemberId}
                    onChange={(e) => setPayMemberId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500"
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
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Branch *
                  </label>
                  <select
                    required
                    value={payBranchId}
                    onChange={(e) => setPayBranchId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.branchCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Payment Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="UPI">UPI (QR / GooglePay / PhonePe / Paytm)</option>
                    <option value="CASH">Cash (Front Desk)</option>
                    <option value="CARD">Credit / Debit Card (POS)</option>
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT / IMPS)</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="MEMBER_CREDIT">Member Store Credit</option>
                  </select>
                </div>
              </div>

              {/* Offline references */}
              {payMethod === "UPI" && (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    12-Digit UPI UTR / Transaction Reference *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 432109876543"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono"
                  />
                </div>
              )}

              {payMethod === "CARD" && (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    POS Terminal Approval / Auth Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AUTH-987213"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono"
                  />
                </div>
              )}

              {payMethod === "CHEQUE" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Cheque # *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 000124"
                      value={payChequeNumber}
                      onChange={(e) => setPayChequeNumber(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. HDFC Bank"
                      value={payBankName}
                      onChange={(e) => setPayBankName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                    />
                  </div>
                </div>
              )}

              {/* Invoice Allocation Section */}
              {unpaidInvoices.length > 0 && (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    <span>Allocate Payment to Invoices:</span>
                    <span className="text-[11px] font-normal text-zinc-500">
                      Unpaid invoices for this member
                    </span>
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {unpaidInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between text-xs p-2 rounded bg-zinc-50 dark:bg-zinc-800/60"
                      >
                        <div>
                          <div className="font-mono font-medium text-emerald-600">{inv.invoiceNumber}</div>
                          <div className="text-[10px] text-zinc-500">Due: {formatCurrency(inv.balanceDue)}</div>
                        </div>

                        <div className="w-32">
                          <input
                            type="number"
                            min="0"
                            max={inv.balanceDue}
                            step="0.01"
                            value={allocations[inv.id] || ""}
                            onChange={(e) =>
                              setAllocations({
                                ...allocations,
                                [inv.id]: Number(e.target.value),
                              })
                            }
                            placeholder="Amount"
                            className="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-right font-medium"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <label className="flex items-center gap-2 pt-1 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={retainExcess}
                      onChange={(e) => setRetainExcess(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Retain any surplus payment as Member Store Credit in wallet</span>
                  </label>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Optional internal remarks..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRecordModal(false)}
                  disabled={modalLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={modalLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {modalLoading ? "Recording..." : "Record Payment & Issue Receipt"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: PAYMENT DETAIL / RECEIPT
          ========================================================================= */}
      {showDetailModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Receipt {selectedPayment.paymentNumber}
              </span>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Member:</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {selectedPayment.member?.firstName} {selectedPayment.member?.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Branch:</span>
                  <span>{selectedPayment.branch?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Method:</span>
                  <span className="font-semibold">{selectedPayment.method}</span>
                </div>
                {selectedPayment.transactionReference && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Reference:</span>
                    <span className="font-mono">{selectedPayment.transactionReference}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-zinc-200 dark:border-zinc-700 pt-2 text-sm font-bold">
                  <span>Amount Received:</span>
                  <span className="text-emerald-600">{formatCurrency(selectedPayment.amount)}</span>
                </div>
              </div>

              {/* Allocations Breakdown */}
              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Invoice Allocations</h4>
                {selectedPayment.allocations?.length === 0 ? (
                  <p className="text-zinc-500">Unapplied / stored as member credit</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedPayment.allocations?.map((a) => (
                      <div
                        key={a.id}
                        className="flex justify-between p-2 rounded bg-zinc-50 dark:bg-zinc-800/60"
                      >
                        <span className="font-mono">{a.invoice?.invoiceNumber}</span>
                        <span className="font-semibold">{formatCurrency(a.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-zinc-200 dark:border-zinc-800">
              <Button onClick={() => setShowDetailModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: PROCESS REFUND
          ========================================================================= */}
      {showRefundModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl max-w-md w-full p-6">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-2">
              <RotateCcw className="h-5 w-5 text-rose-600" />
              Issue Refund for {selectedPayment.paymentNumber}
            </h2>
            <p className="text-xs text-zinc-500 mb-4">
              Disburses a refund and automatically records allocation reversals to restore invoice balances.
            </p>

            {modalError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleRefundSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Refund Amount (₹) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedPayment.amount}
                  step="0.01"
                  required
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Reason for Refund *
                </label>
                <textarea
                  required
                  rows={2}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Member relocated; partial refund authorized by manager..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Disbursement Bank / UTR Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. REF-UPI-492193"
                  value={refundReference}
                  onChange={(e) => setRefundReference(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRefundModal(false)}
                  disabled={modalLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={modalLoading}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {modalLoading ? "Processing..." : "Confirm Refund"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
