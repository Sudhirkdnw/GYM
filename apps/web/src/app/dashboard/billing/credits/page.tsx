"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import {
  MemberCreditAccountData,
  MemberCreditEntryData,
  MemberData,
  PaymentMethod,
  CreditEntryType,
  PaginatedResult,
} from "@gymos/shared-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BillingNav } from "@/components/billing/BillingNav";
import {
  Search,
  RotateCcw,
  Wallet,
  Plus,
  History,
  AlertTriangle,
  CheckCircle2,
  X,
  User,
} from "lucide-react";

export default function MemberCreditsPage() {
  const router = useRouter();
  const { organization, isAuthenticated, isLoading: authLoading } = useAuth();

  const [creditAccounts, setCreditAccounts] = useState<MemberCreditAccountData[]>([]);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");

  // Modals
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);

  // Deposit Form State
  const [depositMemberId, setDepositMemberId] = useState("");
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>(PaymentMethod.UPI);
  const [depositReference, setDepositReference] = useState("");
  const [submittingDeposit, setSubmittingDeposit] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState(false);

  // Ledger Drawer/Modal State
  const [selectedAccount, setSelectedAccount] = useState<MemberCreditAccountData | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<MemberCreditEntryData[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const fetchCredits = useCallback(async () => {
    if (!organization) return;
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("limit", "15");
      if (search) params.append("search", search);

      const res = await apiClient<PaginatedResult<MemberCreditAccountData>>(
        `billing/credits?${params.toString()}`
      );
      setCreditAccounts(res.items || []);
      setTotalPages(res.meta.totalPages || 1);
      setTotalCount(res.meta.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load member credit accounts");
    } finally {
      setLoading(false);
    }
  }, [organization, page, search]);

  const fetchMembers = useCallback(async () => {
    if (!organization) return;
    try {
      const res = await apiClient<PaginatedResult<MemberData>>("members?limit=100");
      setMembers(res.items || []);
    } catch {
      // fallback
    }
  }, [organization]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (organization) {
      fetchCredits();
      fetchMembers();
    }
  }, [organization, fetchCredits, fetchMembers]);

  // View Ledger for an Account
  const handleOpenLedger = async (account: MemberCreditAccountData) => {
    setSelectedAccount(account);
    setShowLedgerModal(true);

    try {
      setLedgerLoading(true);
      const res = await apiClient<MemberCreditEntryData[] | PaginatedResult<MemberCreditEntryData>>(
        `billing/credits/${account.memberId}/ledger`
      );
      if (Array.isArray(res)) {
        setLedgerEntries(res);
      } else if (res && res.items) {
        setLedgerEntries(res.items);
      } else {
        setLedgerEntries([]);
      }
    } catch {
      // fallback
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositMemberId || depositAmount <= 0) {
      setDepositError("Please select a member and enter a valid positive amount");
      return;
    }

    try {
      setSubmittingDeposit(true);
      setDepositError(null);

      await apiClient("billing/credits/deposit", {
        method: "POST",
        body: JSON.stringify({
          memberId: depositMemberId,
          amount: depositAmount,
          paymentMethod: depositMethod,
          referenceNote: depositReference || undefined,
          idempotencyKey: `deposit-${depositMemberId}-${Date.now()}`,
        }),
      });

      setDepositSuccess(true);
      setTimeout(() => {
        setShowDepositModal(false);
        setDepositSuccess(false);
        setDepositMemberId("");
        setDepositAmount(0);
        setDepositReference("");
        fetchCredits();
      }, 1500);
    } catch (err) {
      setDepositError(err instanceof Error ? err.message : "Failed to deposit credit");
    } finally {
      setSubmittingDeposit(false);
    }
  };

  const totalOutstandingCredit = creditAccounts.reduce(
    (acc, curr) => acc + Number(curr.currentBalance || 0),
    0
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Member Credit Wallets
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage prepaid member balances, overpayment credits, and view immutable credit ledgers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCredits()}
            className="border-zinc-200 dark:border-zinc-800"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setDepositError(null);
              setDepositSuccess(false);
              setShowDepositModal(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Deposit Advance Credit
          </Button>
        </div>
      </div>

      {/* Sub-Nav */}
      <BillingNav />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium">
              <span>Total Credit Liability</span>
              <Wallet className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              ₹{totalOutstandingCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Held in member wallets for future renewals/purchases
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium">
              <span>Active Wallets</span>
              <User className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {totalCount}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Members with positive credit balance
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium">
              <span>Ledger Security</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-base font-semibold text-zinc-800 dark:text-zinc-200">
              Append-Only Ledger
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Every deposit, overpayment, and redemption is audit-logged
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter / Search */}
      <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
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
            {search && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="text-xs text-zinc-500 dark:text-zinc-400"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-zinc-400">
            <RotateCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
            Loading credit accounts...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            {error}
          </div>
        ) : creditAccounts.length === 0 ? (
          <div className="p-12 text-center text-zinc-400">
            <Wallet className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
            <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
              No Member Credit Wallets Found
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
              Members will appear here once they overpay an invoice or deposit advance funds.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3 text-right">Available Balance</th>
                  <th className="px-4 py-3">Last Activity</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {creditAccounts.map((account) => (
                  <tr
                    key={account.id}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {account.member?.firstName} {account.member?.lastName}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {account.member?.memberNumber} • {account.member?.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-base">
                        ₹{Number(account.currentBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(account.updatedAt).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenLedger(account)}
                          className="text-xs border-zinc-200 dark:border-zinc-800"
                        >
                          <History className="w-3.5 h-3.5 mr-1" />
                          View Ledger
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setDepositMemberId(account.memberId);
                            setDepositAmount(0);
                            setDepositReference("");
                            setDepositError(null);
                            setDepositSuccess(false);
                            setShowDepositModal(true);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Deposit
                        </Button>
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

      {/* DEPOSIT CREDIT MODAL */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Deposit Advance Credit
              </h3>
              <button
                onClick={() => setShowDepositModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {depositSuccess ? (
              <div className="py-8 text-center text-emerald-600 space-y-2">
                <CheckCircle2 className="w-12 h-12 mx-auto" />
                <h4 className="text-base font-semibold">Credit Deposited Successfully!</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Member wallet balance and ledger entry updated.
                </p>
              </div>
            ) : (
              <form onSubmit={handleDepositSubmit} className="space-y-4">
                {depositError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{depositError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Select Member *
                  </label>
                  <select
                    required
                    value={depositMemberId}
                    onChange={(e) => setDepositMemberId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Choose Member --</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName} ({m.memberNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Deposit Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={depositAmount || ""}
                    onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 5000"
                    className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Received Through *
                  </label>
                  <select
                    value={depositMethod}
                    onChange={(e) => setDepositMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={PaymentMethod.UPI}>UPI</option>
                    <option value={PaymentMethod.CASH}>Cash</option>
                    <option value={PaymentMethod.CARD}>Card</option>
                    <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
                    <option value={PaymentMethod.CHEQUE}>Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Reference / Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Advance for quarterly renewal"
                    value={depositReference}
                    onChange={(e) => setDepositReference(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDepositModal(false)}
                    disabled={submittingDeposit}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submittingDeposit}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs"
                  >
                    {submittingDeposit ? "Processing..." : `Deposit ₹${depositAmount.toLocaleString("en-IN")}`}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* VIEW LEDGER MODAL */}
      {showLedgerModal && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl max-w-3xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  Credit Wallet Ledger
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {selectedAccount.member?.firstName} {selectedAccount.member?.lastName} • Balance: ₹{Number(selectedAccount.currentBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <button
                onClick={() => setShowLedgerModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {ledgerLoading ? (
                <div className="py-12 text-center text-zinc-400">
                  <RotateCcw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                  Loading transactions...
                </div>
              ) : ledgerEntries.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 text-xs">
                  No credit transactions recorded yet.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50 uppercase font-semibold text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {ledgerEntries.map((entry) => {
                      const isCredit =
                        entry.entryType === CreditEntryType.CREDIT_ADJUSTMENT ||
                        entry.entryType === CreditEntryType.CREDIT_FROM_OVERPAYMENT;
                      return (
                        <tr key={entry.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                          <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                            {new Date(entry.createdAt).toLocaleString("en-IN")}
                          </td>
                          <td className="px-3 py-2.5">
                            {entry.entryType === CreditEntryType.CREDIT_FROM_OVERPAYMENT ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                                Overpayment Credit
                              </span>
                            ) : entry.entryType === CreditEntryType.CREDIT_ADJUSTMENT ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400">
                                Advance Deposit
                              </span>
                            ) : entry.entryType === CreditEntryType.CREDIT_APPLIED ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-400">
                                Applied To Invoice
                              </span>
                            ) : entry.entryType === CreditEntryType.CREDIT_REFUND ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400">
                                Credit Refund
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
                                Credit Reversal
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium">
                            <span
                              className={
                                isCredit
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }
                            >
                              {isCredit ? "+" : "-"}₹
                              {Number(entry.amount).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-300">
                            {entry.description || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLedgerModal(false)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
