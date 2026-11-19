"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import {
  InvoiceData,
  InvoiceDetailData,
  MemberData,
  PaginatedResult,
} from "@gymos/shared-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BillingNav } from "@/components/billing/BillingNav";
import {
  Search,
  Plus,
  Printer,
  Ban,
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function InvoicesPage() {
  const router = useRouter();
  const { organization, branches, isAuthenticated, isLoading: authLoading } = useAuth();

  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetailData | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Create Invoice Form State
  const [createMemberId, setCreateMemberId] = useState("");
  const [createBranchId, setCreateBranchId] = useState("");
  const [createIssueDate, setCreateIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [createDueDate, setCreateDueDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [createTaxMode, setCreateTaxMode] = useState<"EXCLUSIVE" | "INCLUSIVE">("EXCLUSIVE");
  const [createNotes, setCreateNotes] = useState("");
  const [lineItems, setLineItems] = useState<
    Array<{
      description: string;
      sacHsnCode: string;
      quantity: number;
      unitPrice: number;
      discountAmount: number;
      taxRate: number;
    }>
  >([
    {
      description: "Annual Gym Membership",
      sacHsnCode: "999723",
      quantity: 1,
      unitPrice: 15000,
      discountAmount: 0,
      taxRate: 18,
    },
  ]);

  // Void Form State
  const [voidReason, setVoidReason] = useState("");

  const fetchInvoices = useCallback(async () => {
    if (!organization) return;
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("limit", "15");
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (branchFilter) params.append("branchId", branchFilter);
      if (search) params.append("search", search);

      const res = await apiClient<PaginatedResult<InvoiceData>>(`billing/invoices?${params.toString()}`);
      setInvoices(res.items || []);
      setTotalPages(res.meta.totalPages || 1);
      setTotalCount(res.meta.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [organization, page, statusFilter, branchFilter, search]);

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
      fetchInvoices();
      fetchMembers();
    }
  }, [authLoading, isAuthenticated, organization, router, fetchInvoices, fetchMembers]);

  const handleOpenPrintModal = async (invoiceId: string) => {
    try {
      setModalLoading(true);
      const detail = await apiClient<InvoiceDetailData>(`billing/invoices/${invoiceId}`);
      setSelectedInvoice(detail);
      setShowPrintModal(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load invoice details");
    } finally {
      setModalLoading(false);
    }
  };

  const handleOpenVoidModal = (inv: InvoiceData) => {
    setSelectedInvoice(inv as unknown as InvoiceDetailData);
    setVoidReason("");
    setModalError(null);
    setShowVoidModal(true);
  };

  const handleVoidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    try {
      setModalLoading(true);
      setModalError(null);
      await apiClient(`billing/invoices/${selectedInvoice.id}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: voidReason }),
      });
      setShowVoidModal(false);
      fetchInvoices();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to void invoice");
    } finally {
      setModalLoading(false);
    }
  };

  const handleAddLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        description: "",
        sacHsnCode: "999723",
        quantity: 1,
        unitPrice: 0,
        discountAmount: 0,
        taxRate: 18,
      },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleLineItemChange = (index: number, field: string, value: string | number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const calculateCreateTotals = () => {
    let subtotal = 0;
    let tax = 0;
    for (const item of lineItems) {
      const gross = (item.quantity || 1) * (item.unitPrice || 0);
      const discounted = Math.max(0, gross - (item.discountAmount || 0));
      const rate = item.taxRate || 0;
      if (createTaxMode === "INCLUSIVE") {
        const taxable = discounted / (1 + rate / 100);
        subtotal += taxable;
        tax += discounted - taxable;
      } else {
        const itemTax = (discounted * rate) / 100;
        subtotal += discounted;
        tax += itemTax;
      }
    }
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setModalLoading(true);
      setModalError(null);

      const targetBranch = createBranchId || branches[0]?.id;
      if (!targetBranch) {
        throw new Error("Please select a branch");
      }
      if (!createMemberId) {
        throw new Error("Please select a member");
      }

      await apiClient("billing/invoices", {
        method: "POST",
        body: JSON.stringify({
          branchId: targetBranch,
          memberId: createMemberId,
          issueDate: createIssueDate,
          dueDate: createDueDate,
          taxMode: createTaxMode,
          notes: createNotes,
          items: lineItems.map((li) => ({
            itemType: "MEMBERSHIP",
            description: li.description,
            sacHsnCode: li.sacHsnCode,
            quantity: Number(li.quantity),
            unitPrice: Number(li.unitPrice),
            discountAmount: Number(li.discountAmount),
            taxRate: Number(li.taxRate),
          })),
        }),
      });

      setShowCreateModal(false);
      fetchInvoices();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to create invoice");
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
            Invoices Management
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Create, issue, void, and print GST tax invoices for gym members
          </p>
        </div>

        <Button
          onClick={() => {
            setCreateBranchId(branches[0]?.id || "");
            setShowCreateModal(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Create Invoice
        </Button>
      </div>

      {/* Navigation Sub-menu */}
      <BillingNav />

      {/* Filters Bar */}
      <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm mb-6">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {["ALL", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === status
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {status.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* Search & Branch Select */}
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
                placeholder="Search invoice #, member..."
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

      {/* Invoices Table */}
      <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-sm">
        <CardContent className="p-0">
          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs border-b border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}
          {loading ? (
            <div className="py-16 text-center text-sm text-zinc-500">
              Loading invoices...
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="h-10 w-10 text-zinc-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No invoices found</p>
              <p className="text-xs text-zinc-500 mt-1">Try adjusting filters or create a new invoice</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 bg-zinc-50 dark:bg-zinc-900/80">
                  <tr>
                    <th className="py-3 px-4 font-medium">Invoice #</th>
                    <th className="py-3 px-4 font-medium">Member</th>
                    <th className="py-3 px-4 font-medium">Branch</th>
                    <th className="py-3 px-4 font-medium">Issue Date</th>
                    <th className="py-3 px-4 font-medium">Due Date</th>
                    <th className="py-3 px-4 font-medium">Total</th>
                    <th className="py-3 px-4 font-medium">Balance Due</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {inv.customerSnapshot?.name || `${inv.member?.firstName} ${inv.member?.lastName}`}
                        </div>
                        <div className="text-[10px] text-zinc-500">{inv.member?.phone}</div>
                      </td>
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                        {inv.branch?.name || "Main"}
                      </td>
                      <td className="py-3 px-4 text-zinc-500">{inv.issueDate}</td>
                      <td className="py-3 px-4 text-zinc-500">{inv.dueDate}</td>
                      <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(inv.totalAmount)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-amber-600 dark:text-amber-400">
                        {formatCurrency(inv.balanceDue)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                            inv.status === "PAID"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400"
                              : inv.status === "PARTIALLY_PAID"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400"
                              : inv.status === "OVERDUE"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400"
                              : inv.status === "VOID"
                              ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenPrintModal(inv.id)}
                            className="h-7 px-2 text-zinc-600 dark:text-zinc-400 hover:text-emerald-600"
                            title="Print / View Invoice"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>

                          {inv.status !== "VOID" && inv.status !== "PAID" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenVoidModal(inv)}
                              className="h-7 px-2 text-zinc-600 dark:text-zinc-400 hover:text-rose-600"
                              title="Void Invoice"
                            >
                              <Ban className="h-3.5 w-3.5" />
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

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
              <span>
                Showing {invoices.length} of {totalCount} invoices
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
          MODAL: CREATE INVOICE
          ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl max-w-2xl w-full p-6 my-8">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                Create Tax Invoice
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
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

            <form onSubmit={handleCreateInvoiceSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Member *
                  </label>
                  <select
                    required
                    value={createMemberId}
                    onChange={(e) => setCreateMemberId(e.target.value)}
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
                    value={createBranchId}
                    onChange={(e) => setCreateBranchId(e.target.value)}
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
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={createIssueDate}
                    onChange={(e) => setCreateIssueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={createDueDate}
                    onChange={(e) => setCreateDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Tax Mode */}
              <div className="flex items-center gap-4 py-1 text-xs">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">Tax Pricing Mode:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="taxMode"
                    value="EXCLUSIVE"
                    checked={createTaxMode === "EXCLUSIVE"}
                    onChange={() => setCreateTaxMode("EXCLUSIVE")}
                    className="text-emerald-600"
                  />
                  <span>Tax Exclusive (Base + GST)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="taxMode"
                    value="INCLUSIVE"
                    checked={createTaxMode === "INCLUSIVE"}
                    onChange={() => setCreateTaxMode("INCLUSIVE")}
                    className="text-emerald-600"
                  />
                  <span>Tax Inclusive (GST included)</span>
                </label>
              </div>

              {/* Line Items */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Line Items</span>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Add Item
                  </button>
                </div>

                {lineItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg text-xs">
                    <div className="col-span-4">
                      <input
                        type="text"
                        placeholder="Description *"
                        required
                        value={item.description}
                        onChange={(e) => handleLineItemChange(idx, "description", e.target.value)}
                        className="w-full px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="SAC Code"
                        value={item.sacHsnCode}
                        onChange={(e) => handleLineItemChange(idx, "sacHsnCode", e.target.value)}
                        className="w-full px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Unit Price *"
                        required
                        value={item.unitPrice}
                        onChange={(e) => handleLineItemChange(idx, "unitPrice", Number(e.target.value))}
                        className="w-full px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                      />
                    </div>
                    <div className="col-span-2">
                      <select
                        value={item.taxRate}
                        onChange={(e) => handleLineItemChange(idx, "taxRate", Number(e.target.value))}
                        className="w-full px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                      >
                        <option value="0">0% (Nil)</option>
                        <option value="5">5% GST</option>
                        <option value="12">12% GST</option>
                        <option value="18">18% GST</option>
                        <option value="28">28% GST</option>
                      </select>
                    </div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleLineItemChange(idx, "quantity", Number(e.target.value))}
                        className="w-full px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-center"
                      />
                    </div>
                    <div className="col-span-1 text-center">
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(idx)}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <X className="h-4 w-4 mx-auto" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Calculation Summary Preview */}
                {(() => {
                  const { subtotal, tax, total } = calculateCreateTotals();
                  return (
                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 text-right space-y-1 text-xs">
                      <div>
                        <span className="text-zinc-500">Taxable Amount: </span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(subtotal)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Tax (GST): </span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(tax)}</span>
                      </div>
                      <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        <span>Total Payable: </span>
                        <span>{formatCurrency(total)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Notes / Terms
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional payment instructions or terms..."
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={modalLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={modalLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {modalLoading ? "Creating..." : "Issue Invoice"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: PRINT / PREVIEW TAX INVOICE
          ========================================================================= */}
      {showPrintModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl max-w-3xl w-full p-6 my-8">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4 print:hidden">
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Tax Invoice Preview ({selectedInvoice.invoiceNumber})
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => window.print()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Invoice
                </Button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Tax Invoice Layout */}
            <div className="p-6 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs space-y-6 text-zinc-800 dark:text-zinc-200">
              {/* Header: Gym Supplier Details & Invoice Meta */}
              <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">
                    {selectedInvoice.supplierSnapshot?.tradeName || selectedInvoice.supplierSnapshot?.legalName}
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {selectedInvoice.supplierSnapshot?.addressLine1}, {selectedInvoice.supplierSnapshot?.city},{" "}
                    {selectedInvoice.supplierSnapshot?.state} - {selectedInvoice.supplierSnapshot?.postalCode}
                  </p>
                  <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mt-1">
                    GSTIN: <span className="font-semibold">{selectedInvoice.supplierSnapshot?.gstin}</span> | State Code:{" "}
                    {selectedInvoice.supplierSnapshot?.stateCode}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-base font-bold text-zinc-900 dark:text-zinc-50">TAX INVOICE</div>
                  <div className="font-mono text-emerald-600 font-semibold">{selectedInvoice.invoiceNumber}</div>
                  <div className="text-zinc-500 mt-1">Issue Date: {selectedInvoice.issueDate}</div>
                  <div className="text-zinc-500">Due Date: {selectedInvoice.dueDate}</div>
                </div>
              </div>

              {/* Billed To / Recipient Details */}
              <div className="grid grid-cols-2 gap-4 pb-2">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Billed To (Member):</span>
                  <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm mt-0.5">
                    {selectedInvoice.customerSnapshot?.name}
                  </div>
                  <div className="text-zinc-500">Member #: {selectedInvoice.customerSnapshot?.memberNumber}</div>
                  <div className="text-zinc-500">Phone: {selectedInvoice.customerSnapshot?.phone}</div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Place of Supply:</span>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                    State Code: {selectedInvoice.placeOfSupply}
                  </div>
                  <div className="text-zinc-500">
                    Supply Type: {selectedInvoice.taxSnapshot?.isInterState ? "Inter-State (IGST)" : "Intra-State (CGST + SGST)"}
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-y border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 font-medium">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3">SAC Code</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3 text-right">Unit Price</th>
                    <th className="py-2 px-3 text-right">Taxable</th>
                    <th className="py-2 px-3 text-right">GST Rate</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {selectedInvoice.items?.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="py-2 px-3 text-zinc-400">{idx + 1}</td>
                      <td className="py-2 px-3 font-medium text-zinc-900 dark:text-zinc-100">{item.description}</td>
                      <td className="py-2 px-3 font-mono text-zinc-500">{item.sacHsnCode || "999723"}</td>
                      <td className="py-2 px-3 text-right">{item.quantity}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(item.taxableAmount)}</td>
                      <td className="py-2 px-3 text-right">{item.taxRate}%</td>
                      <td className="py-2 px-3 text-right font-semibold">{formatCurrency(item.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Financial Totals & Tax Split Breakdown */}
              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-1.5 text-right">
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>Taxable Value:</span>
                    <span>{formatCurrency(selectedInvoice.taxableAmount)}</span>
                  </div>
                  {selectedInvoice.taxSnapshot?.isInterState ? (
                    <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                      <span>IGST:</span>
                      <span>{formatCurrency(selectedInvoice.igstAmount)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                        <span>CGST (9%):</span>
                        <span>{formatCurrency(selectedInvoice.cgstAmount)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                        <span>SGST (9%):</span>
                        <span>{formatCurrency(selectedInvoice.sgstAmount)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-bold text-zinc-900 dark:text-zinc-50 pt-1 border-t border-zinc-200 dark:border-zinc-800 text-sm">
                    <span>Invoice Total:</span>
                    <span>{formatCurrency(selectedInvoice.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Amount Paid:</span>
                    <span>{formatCurrency(selectedInvoice.allocatedAmount)}</span>
                  </div>
                  <div className="flex justify-between text-amber-600 font-bold text-sm">
                    <span>Balance Due:</span>
                    <span>{formatCurrency(selectedInvoice.balanceDue)}</span>
                  </div>
                </div>
              </div>

              {/* Terms & Footer */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-500">
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">Terms & Conditions:</p>
                <p>1. Fees once paid are non-refundable and non-transferable.</p>
                <p>2. Gym rules and operating hours must be strictly observed.</p>
                <p>3. This is an official computer-generated Tax Invoice and requires no physical signature.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: VOID INVOICE
          ========================================================================= */}
      {showVoidModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl max-w-md w-full p-6">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-2">
              <Ban className="h-5 w-5 text-rose-600" />
              Void Invoice {selectedInvoice.invoiceNumber}
            </h2>
            <p className="text-xs text-zinc-500 mb-4">
              Voiding cancels the invoice while preserving the audit record. Voided invoice numbers are archived and never reused.
            </p>

            {modalError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleVoidSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Reason for Cancellation *
                </label>
                <textarea
                  required
                  rows={3}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Created with incorrect billing details upon customer request..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVoidModal(false)}
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
                  {modalLoading ? "Voiding..." : "Confirm Void"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
