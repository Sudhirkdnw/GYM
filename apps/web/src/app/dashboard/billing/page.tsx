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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Billing & Financial Records
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Tax invoices, manual payment reconciliation, outstanding dues, and credit management
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            disabled={loading}
            className="border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Link href="/dashboard/billing/invoices">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Navigation Sub-menu */}
      <BillingNav />

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-sm mb-6 flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="ghost" onClick={fetchDashboardData}>
            Retry
          </Button>
        </div>
      )}

      {/* Topline KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Today's Collections */}
        <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Today&apos;s Collections
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {loading ? "..." : formatCurrency(kpis?.todayCollections || 0)}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Received today across branches
            </p>
          </CardContent>
        </Card>

        {/* Month-to-Date Collections */}
        <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              MTD Revenue
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <IndianRupee className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {loading ? "..." : formatCurrency(kpis?.mtdCollections || 0)}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Calendar month collections
            </p>
          </CardContent>
        </Card>

        {/* Total Outstanding Dues */}
        <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Total Outstanding Dues
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {loading ? "..." : formatCurrency(kpis?.totalOutstandingDues || 0)}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Link
                href="/dashboard/billing/dues"
                className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
              >
                <span>View aging report</span>
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Status Distribution */}
        <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Active Invoices
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {loading ? "..." : kpis?.activeInvoicesCount || 0}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              <span className="text-emerald-600 font-semibold">{kpis?.paidInvoicesCount || 0} Paid</span>
              {" • "}
              <span className="text-rose-600 font-semibold">{kpis?.overdueInvoicesCount || 0} Overdue</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Two-Column Grid: Payment Methods & Branch Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Payment Methods Distribution */}
        <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <PieChart className="h-4 w-4 text-emerald-600" />
              Payment Methods Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {methods.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                No recorded payments yet
              </div>
            ) : (
              <div className="space-y-3.5">
                {methods.map((m) => (
                  <div key={m.method} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-zinc-700 dark:text-zinc-300">{m.method}</span>
                      <span className="text-zinc-900 dark:text-zinc-100 font-semibold">
                        {formatCurrency(m.totalAmount)} ({m.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${Math.min(m.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Branch Collections (Gym Owner View) or Recent Invoices */}
        <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <Building2 className="h-4 w-4 text-emerald-600" />
              {organization?.role === "GYM_OWNER"
                ? "Branch Performance Breakdown"
                : "Recent Invoices"}
            </CardTitle>
            <Link
              href="/dashboard/billing/invoices"
              className="text-xs font-medium text-emerald-600 hover:underline flex items-center gap-1"
            >
              <span>View all invoices</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {organization?.role === "GYM_OWNER" && branchPerf.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                    <tr>
                      <th className="py-2.5 font-medium">Branch</th>
                      <th className="py-2.5 font-medium">Total Collections</th>
                      <th className="py-2.5 font-medium">Outstanding Dues</th>
                      <th className="py-2.5 font-medium">Invoices</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {branchPerf.map((bp) => (
                      <tr key={bp.branchId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                        <td className="py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                          {bp.branchName} ({bp.branchCode})
                        </td>
                        <td className="py-3 text-emerald-600 dark:text-emerald-400 font-semibold">
                          {formatCurrency(bp.collections)}
                        </td>
                        <td className="py-3 text-amber-600 dark:text-amber-400 font-semibold">
                          {formatCurrency(bp.dues)}
                        </td>
                        <td className="py-3 text-zinc-600 dark:text-zinc-400">{bp.invoicesCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                    <tr>
                      <th className="py-2.5 font-medium">Invoice #</th>
                      <th className="py-2.5 font-medium">Member</th>
                      <th className="py-2.5 font-medium">Total</th>
                      <th className="py-2.5 font-medium">Balance Due</th>
                      <th className="py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {recentInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                        <td className="py-2.5 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                          {inv.customerSnapshot?.name || inv.member?.firstName}
                        </td>
                        <td className="py-2.5 font-semibold text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(inv.totalAmount)}
                        </td>
                        <td className="py-2.5 text-amber-600 dark:text-amber-400 font-medium">
                          {formatCurrency(inv.balanceDue)}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                              inv.status === "PAID"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400"
                                : inv.status === "PARTIALLY_PAID"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400"
                                : inv.status === "OVERDUE"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400"
                                : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Payments Feed */}
      <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            Recent Payment Transactions
          </CardTitle>
          <Link
            href="/dashboard/billing/payments"
            className="text-xs font-medium text-emerald-600 hover:underline flex items-center gap-1"
          >
            <span>View payment ledger</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {recentPayments.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-500">
              No recent payments recorded
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
                  <tr>
                    <th className="py-2.5 font-medium">Receipt #</th>
                    <th className="py-2.5 font-medium">Member</th>
                    <th className="py-2.5 font-medium">Method</th>
                    <th className="py-2.5 font-medium">Reference</th>
                    <th className="py-2.5 font-medium">Amount</th>
                    <th className="py-2.5 font-medium">Date</th>
                    <th className="py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {recentPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="py-3 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        {p.paymentNumber}
                      </td>
                      <td className="py-3 font-medium text-zinc-900 dark:text-zinc-100">
                        {p.member?.firstName} {p.member?.lastName}
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {p.method}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-zinc-500">
                        {p.transactionReference || p.chequeNumber || "—"}
                      </td>
                      <td className="py-3 font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="py-3 text-zinc-500">{p.paidAt.slice(0, 10)}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                            p.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400"
                              : p.status === "PENDING"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
