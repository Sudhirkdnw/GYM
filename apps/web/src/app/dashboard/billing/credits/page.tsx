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
import { BillingNav } from "@/components/billing/BillingNav";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
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
  ChevronLeft,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
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
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Member Credit Wallets
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage prepaid member balances, overpayment credits, and view immutable audit ledgers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchCredits()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#131622] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 transition-colors shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={() => {
              setDepositError(null);
              setDepositSuccess(false);
              setShowDepositModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Deposit Advance Credit
          </button>
        </div>
      </div>

      {/* Sub Nav */}
      <BillingNav />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total Credit Liability</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              ₹{totalOutstandingCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <p className="text-xs text-slate-400 mt-1">
              Held in member wallets for future invoices & renewals
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Active Wallets</span>
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {totalCount}
            </span>
            <p className="text-xs text-slate-400 mt-1">
              Members with a registered credit account
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Security Architecture</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-base font-semibold text-slate-900 dark:text-white">
              Append-Only Ledger
            </span>
            <p className="text-xs text-slate-400 mt-1">
              All deposits and invoice settlements are tamper-evident
            </p>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.08] shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
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
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#131622] overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <RotateCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-500" />
            <p className="text-xs">Loading credit accounts...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : creditAccounts.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No Member Credit Wallets Found"
            description="Members will appear here once they overpay an invoice or deposit advance funds."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-white/[0.08] uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Member</th>
                  <th className="px-5 py-3.5 text-right">Available Balance</th>
                  <th className="px-5 py-3.5">Last Activity</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {creditAccounts.map((account) => (
                  <tr
                    key={account.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-violet-600/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {account.member?.firstName?.[0]}
                          {account.member?.lastName?.[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {account.member?.firstName} {account.member?.lastName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {account.member?.memberNumber} • {account.member?.phone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        ₹{Number(account.currentBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                      {new Date(account.updatedAt).toLocaleString("en-IN")}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenLedger(account)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          <History className="w-3.5 h-3.5" />
                          Ledger
                        </button>
                        <button
                          onClick={() => {
                            setDepositMemberId(account.memberId);
                            setDepositAmount(0);
                            setDepositReference("");
                            setDepositError(null);
                            setDepositSuccess(false);
                            setShowDepositModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Deposit
                        </button>
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

      {/* DEPOSIT CREDIT MODAL */}
      <Modal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        title="Deposit Advance Credit"
        description="Add advance balance to a member's digital wallet for automated invoice deduction."
        maxWidth="md"
      >
        {depositSuccess ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-semibold text-slate-900 dark:text-white">
              Credit Deposited Successfully!
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Member wallet balance and ledger entry have been updated.
            </p>
          </div>
        ) : (
          <form onSubmit={handleDepositSubmit} className="space-y-4">
            {depositError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{depositError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Select Member *
              </label>
              <select
                required
                value={depositMemberId}
                onChange={(e) => setDepositMemberId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
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
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
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
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Received Through *
              </label>
              <select
                value={depositMethod}
                onChange={(e) => setDepositMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value={PaymentMethod.UPI}>UPI / QR</option>
                <option value={PaymentMethod.CASH}>Cash</option>
                <option value={PaymentMethod.CARD}>Credit/Debit Card</option>
                <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
                <option value={PaymentMethod.CHEQUE}>Cheque</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reference / Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Advance deposit for quarterly renewal"
                value={depositReference}
                onChange={(e) => setDepositReference(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setShowDepositModal(false)}
                disabled={submittingDeposit}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingDeposit}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 transition-colors"
              >
                {submittingDeposit ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    Deposit ₹{depositAmount.toLocaleString("en-IN")}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* VIEW LEDGER MODAL */}
      <Modal
        isOpen={showLedgerModal && !!selectedAccount}
        onClose={() => setShowLedgerModal(false)}
        title="Credit Wallet Ledger"
        description={`${selectedAccount?.member?.firstName} ${selectedAccount?.member?.lastName} (${selectedAccount?.member?.memberNumber}) • Balance: ₹${Number(selectedAccount?.currentBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          {ledgerLoading ? (
            <div className="py-12 text-center text-slate-400">
              <RotateCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-500" />
              <p className="text-xs">Loading transaction ledger...</p>
            </div>
          ) : ledgerEntries.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No ledger entries recorded yet.</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden">
              {ledgerEntries.map((entry) => {
                const isCredit =
                  entry.entryType === CreditEntryType.CREDIT_FROM_OVERPAYMENT ||
                  entry.entryType === CreditEntryType.CREDIT_ADJUSTMENT;

                return (
                  <div
                    key={entry.id}
                    className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isCredit
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-rose-500/10 text-rose-500"
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{entry.entryType.replace(/_/g, " ")}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {new Date(entry.createdAt).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {entry.description || "System balance adjustment"}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`font-bold text-sm ${
                          isCredit
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {isCredit ? "+" : "-"}₹{Number(entry.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Bal: ₹{Number(entry.balanceAfter ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-white/[0.08]">
            <button
              onClick={() => setShowLedgerModal(false)}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
