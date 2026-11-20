"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import {
  FinancialKpiData,
  PaymentMethodDistributionData,
  BranchPerformanceData,
  PaymentData,
  InvoiceData,
  PaginatedResult,
} from "@gymos/shared-types";
import { BillingNav } from "@/components/billing/BillingNav";
import {
  IndianRupee,
  TrendingUp,
  Clock,
  FileText,
  CreditCard,
  Building2,
  Plus,
  ArrowUpRight,
  ExternalLink,
  PieChart,
  RefreshCw,
  Receipt,
  Sparkles,
  Wallet,
} from "lucide-react";

export default function BillingOverviewPage() {
  const router = useRouter();
  const { organization, isAuthenticated, isLoading: authLoading } = useAuth();

  const [kpis, setKpis] = useState<FinancialKpiData | null>(null);
  const [methods, setMethods] = useState<PaymentMethodDistributionData[]>([]);
  const [branchPerf, setBranchPerf] = useState<BranchPerformanceData[]>([]);
  const [recentPayments, setRecentPayments] = useState<PaymentData[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!organization) return;
    try {
      setLoading(true);
      setError(null);

      const [kpiRes, methodsRes, paymentsRes, invoicesRes] = await Promise.all([
        apiClient<FinancialKpiData>("billing/reports/kpis"),
        apiClient<PaymentMethodDistributionData[]>("billing/reports/payment-methods"),
        apiClient<PaginatedResult<PaymentData>>("billing/payments?limit=5"),
        apiClient<PaginatedResult<InvoiceData>>("billing/invoices?limit=5"),
      ]);

      setKpis(kpiRes);
      setMethods(methodsRes);
      setRecentPayments(paymentsRes.items || []);
      setRecentInvoices(invoicesRes.items || []);

      if (organization.role === "GYM_OWNER") {
        try {
          const perfRes = await apiClient<BranchPerformanceData[]>("billing/reports/branch-performance");
          setBranchPerf(perfRes);
        } catch {
          // Non-blocking for non-owner or single-branch
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load financial overview");
    } finally {
      setLoading(false);
    }
  }, [organization]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (organization) {
      fetchDashboardData();
    }
  }, [authLoading, isAuthenticated, organization, router, fetchDashboardData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Receipt className="h-6 w-6 text-primary" />
              Finance & Billing
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Ledger
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Tax invoices, payment reconciliation receipts, outstanding dues, and customer credit deposits.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-card hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh Ledger"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-primary" : ""}`} />
          </button>

          <Link
            href="/dashboard/billing/invoices"
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all"
          >
            <Plus className="h-4 w-4" />
            Create Invoice
          </Link>
        </div>
      </div>

      {/* Navigation Sub-menu */}
      <BillingNav />

      {error && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchDashboardData}
            className="font-semibold underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Topline KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Collections */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Today&apos;s Collections</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {loading ? "..." : formatCurrency(kpis?.todayCollections || 0)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Received today across active desks
          </p>
        </div>

        {/* Month-to-Date Collections */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>MTD Revenue</span>
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <IndianRupee className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {loading ? "..." : formatCurrency(kpis?.mtdCollections || 0)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Calendar month total collections
          </p>
        </div>

        {/* Total Outstanding Dues */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Total Outstanding Dues</span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-500">
            {loading ? "..." : formatCurrency(kpis?.totalOutstandingDues || 0)}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Link
              href="/dashboard/billing/dues"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
            >
              <span>View aging report</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Invoice Status Distribution */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Active Invoices</span>
            <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {loading ? "..." : kpis?.activeInvoicesCount || 0}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            <span className="text-emerald-500 font-semibold">{kpis?.paidInvoicesCount || 0} Paid</span>
            {" • "}
            <span className="text-red-500 font-semibold">{kpis?.overdueInvoicesCount || 0} Overdue</span>
          </p>
        </div>
      </div>

      {/* Two-Column Grid: Payment Methods & Branch Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Methods Distribution */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm lg:col-span-1 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <PieChart className="h-4 w-4 text-primary" />
            Payment Methods Breakdown
          </div>
          {methods.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No recorded payments yet
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              {methods.map((m) => (
                <div key={m.method} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-foreground">{m.method}</span>
                    <span className="text-foreground font-mono font-bold">
                      {formatCurrency(m.totalAmount)}{" "}
                      <span className="text-muted-foreground font-normal">({m.percentage}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(m.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Branch Collections (Gym Owner View) or Recent Invoices */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl shadow-sm lg:col-span-2 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-4 border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Building2 className="h-4 w-4 text-primary" />
                {organization?.role === "GYM_OWNER"
                  ? "Branch Financial Performance"
                  : "Recent Invoices"}
              </div>
              <Link
                href="/dashboard/billing/invoices"
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <span>View all invoices</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              {organization?.role === "GYM_OWNER" && branchPerf.length > 0 ? (
                <table className="w-full text-xs text-left">
                  <thead className="border-b border-border/40 bg-muted/30 uppercase tracking-wider text-[10px] text-muted-foreground font-semibold">
                    <tr>
                      <th className="py-3 px-4">Branch</th>
                      <th className="py-3 px-4">Total Collections</th>
                      <th className="py-3 px-4">Outstanding Dues</th>
                      <th className="py-3 px-4">Invoices</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {branchPerf.map((bp) => (
                      <tr key={bp.branchId} className="hover:bg-accent/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-foreground">
                          {bp.branchName} ({bp.branchCode})
                        </td>
                        <td className="py-3.5 px-4 text-emerald-500 font-bold font-mono">
                          {formatCurrency(bp.collections)}
                        </td>
                        <td className="py-3.5 px-4 text-amber-500 font-bold font-mono">
                          {formatCurrency(bp.dues)}
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground">{bp.invoicesCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="border-b border-border/40 bg-muted/30 uppercase tracking-wider text-[10px] text-muted-foreground font-semibold">
                    <tr>
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4">Total</th>
                      <th className="py-3 px-4">Balance Due</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {recentInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-accent/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-primary">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-foreground">
                          {inv.customerSnapshot?.name || inv.member?.firstName}
                        </td>
                        <td className="py-3.5 px-4 font-bold font-mono text-foreground">
                          {formatCurrency(inv.totalAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-amber-500 font-bold font-mono">
                          {formatCurrency(inv.balanceDue)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
                              inv.status === "PAID"
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : inv.status === "PARTIALLY_PAID"
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                : inv.status === "OVERDUE"
                                ? "bg-red-500/10 text-red-500 border-red-500/20"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Payments Feed */}
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <CreditCard className="h-4 w-4 text-primary" />
            Recent Payment Receipts
          </div>
          <Link
            href="/dashboard/billing/payments"
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <span>View payment ledger</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          {recentPayments.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No recent payments recorded
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="border-b border-border/40 bg-muted/30 uppercase tracking-wider text-[10px] text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {recentPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-accent/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-primary">
                      {p.paymentNumber}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-foreground">
                      {p.member?.firstName} {p.member?.lastName}
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
                            : "bg-red-500/10 text-red-500 border-red-500/20"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
