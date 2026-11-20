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
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Sparkles,
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
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Tax Invoices Ledger
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {totalCount} Invoices
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Issue, void, and print GST tax invoices with itemized SAC code lines and CGST/SGST/IGST breakdown.
          </p>
        </div>

        <button
          onClick={() => {
            setCreateBranchId(branches[0]?.id || "");
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Create Invoice
        </button>
      </div>

      {/* Navigation Sub-menu */}
      <BillingNav />

      {/* Filters Bar */}
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {["ALL", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  statusFilter === status
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
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
                placeholder="Search invoice #, member..."
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

      {/* Invoices Table */}
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 bg-red-500/10 text-red-500 text-xs border-b border-red-500/20">
            {error}
          </div>
        )}
        {loading ? (
          <div className="py-20 text-center text-xs text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
            Loading invoices...
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-20 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-bold text-foreground">No invoices found</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting filters or create a new invoice</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-border/60 bg-muted/40 uppercase tracking-wider text-[10px] text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Balance Due</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-accent/40 transition-colors group">
                    <td className="py-3.5 px-4 font-mono font-bold text-primary">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-foreground">
                        {inv.customerSnapshot?.name || `${inv.member?.firstName} ${inv.member?.lastName}`}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{inv.member?.phone}</div>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      {inv.branch?.name || "Main"}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">{inv.issueDate}</td>
                    <td className="py-3.5 px-4 text-muted-foreground">{inv.dueDate}</td>
                    <td className="py-3.5 px-4 font-bold font-mono text-foreground">
                      {formatCurrency(inv.totalAmount)}
                    </td>
                    <td className="py-3.5 px-4 font-bold font-mono text-amber-500">
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
                            : inv.status === "VOID"
                            ? "bg-muted text-muted-foreground border-border"
                            : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenPrintModal(inv.id)}
                          className="p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="Print / View Invoice"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>

                        {inv.status !== "VOID" && inv.status !== "PAID" && (
                          <button
                            onClick={() => handleOpenVoidModal(inv)}
                            className="p-1.5 rounded-lg border border-border bg-card hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                            title="Void Invoice"
                          >
                            <Ban className="h-3.5 w-3.5" />
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
              Showing <span className="font-semibold text-foreground">{invoices.length}</span> of{" "}
              <span className="font-semibold text-foreground">{totalCount}</span> invoices
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

      {/* MODAL: CREATE INVOICE */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-card rounded-2xl border border-border/80 shadow-2xl max-w-2xl w-full p-6 my-8 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Create Tax Invoice
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateInvoiceSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Member <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={createMemberId}
                    onChange={(e) => setCreateMemberId(e.target.value)}
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
                    value={createBranchId}
                    onChange={(e) => setCreateBranchId(e.target.value)}
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
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={createIssueDate}
                    onChange={(e) => setCreateIssueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={createDueDate}
                    onChange={(e) => setCreateDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground"
                  />
                </div>
              </div>

              {/* Tax Mode */}
              <div className="flex items-center gap-4 py-1 text-xs">
                <span className="font-semibold text-foreground">Tax Pricing Mode:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="taxMode"
                    value="EXCLUSIVE"
                    checked={createTaxMode === "EXCLUSIVE"}
                    onChange={() => setCreateTaxMode("EXCLUSIVE")}
                    className="text-primary"
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
                    className="text-primary"
                  />
                  <span>Tax Inclusive (GST included)</span>
                </label>
              </div>

              {/* Line Items */}
              <div className="border border-border/60 rounded-xl p-3.5 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Line Items</span>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Plus className="h-3 w-3" />
                    Add Item
                  </button>
                </div>

                {lineItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-card p-2 rounded-xl text-xs border border-border/60">
                    <div className="col-span-4">
                      <input
                        type="text"
                        placeholder="Description *"
                        required
                        value={item.description}
                        onChange={(e) => handleLineItemChange(idx, "description", e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="SAC Code"
                        value={item.sacHsnCode}
                        onChange={(e) => handleLineItemChange(idx, "sacHsnCode", e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono"
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
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono"
                      />
                    </div>
                    <div className="col-span-2">
                      <select
                        value={item.taxRate}
                        onChange={(e) => handleLineItemChange(idx, "taxRate", Number(e.target.value))}
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground"
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
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-center font-mono"
                      />
                    </div>
                    <div className="col-span-1 text-center">
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(idx)}
                          className="text-red-500 hover:text-red-700"
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
                    <div className="pt-2 border-t border-border/40 text-right space-y-1 text-xs">
                      <div>
                        <span className="text-muted-foreground">Taxable Amount: </span>
                        <span className="font-semibold font-mono text-foreground">{formatCurrency(subtotal)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tax (GST): </span>
                        <span className="font-semibold font-mono text-foreground">{formatCurrency(tax)}</span>
                      </div>
                      <div className="text-sm font-bold text-emerald-500 pt-1">
                        <span>Total Payable: </span>
                        <span className="font-mono">{formatCurrency(total)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Notes / Terms
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional payment instructions or terms..."
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
                  {modalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Issue Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRINT / PREVIEW TAX INVOICE */}
      {showPrintModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-card rounded-2xl border border-border/80 shadow-2xl max-w-3xl w-full p-6 my-8 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4 print:hidden">
              <span className="text-sm font-bold text-foreground">
                Tax Invoice Preview ({selectedInvoice.invoiceNumber})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Invoice
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Printable Tax Invoice Layout */}
            <div className="p-6 bg-white text-zinc-900 border border-zinc-200 rounded-xl text-xs space-y-6 shadow-sm">
              {/* Header: Gym Supplier Details & Invoice Meta */}
              <div className="flex items-start justify-between border-b border-zinc-200 pb-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-900 uppercase tracking-tight">
                    {selectedInvoice.supplierSnapshot?.tradeName || selectedInvoice.supplierSnapshot?.legalName}
                  </h3>
                  <p className="text-[11px] text-zinc-600 mt-0.5">
                    {selectedInvoice.supplierSnapshot?.addressLine1}, {selectedInvoice.supplierSnapshot?.city},{" "}
                    {selectedInvoice.supplierSnapshot?.state} - {selectedInvoice.supplierSnapshot?.postalCode}
                  </p>
                  <p className="text-[11px] font-mono text-zinc-600 mt-1">
                    GSTIN: <span className="font-semibold">{selectedInvoice.supplierSnapshot?.gstin}</span> | State Code:{" "}
                    {selectedInvoice.supplierSnapshot?.stateCode}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-base font-bold text-zinc-900">TAX INVOICE</div>
                  <div className="font-mono text-zinc-800 font-bold">{selectedInvoice.invoiceNumber}</div>
                  <div className="text-zinc-600 mt-1">Issue Date: {selectedInvoice.issueDate}</div>
                  <div className="text-zinc-600">Due Date: {selectedInvoice.dueDate}</div>
                </div>
              </div>

              {/* Billed To / Recipient Details */}
              <div className="grid grid-cols-2 gap-4 pb-2">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Billed To (Member):</span>
                  <div className="font-bold text-zinc-900 text-sm mt-0.5">
                    {selectedInvoice.customerSnapshot?.name}
                  </div>
                  <div className="text-zinc-600">Member #: {selectedInvoice.customerSnapshot?.memberNumber}</div>
                  <div className="text-zinc-600">Phone: {selectedInvoice.customerSnapshot?.phone}</div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Place of Supply:</span>
                  <div className="font-semibold text-zinc-800">
                    State Code: {selectedInvoice.placeOfSupply}
                  </div>
                  <div className="text-zinc-600">
                    Supply Type: {selectedInvoice.taxSnapshot?.isInterState ? "Inter-State (IGST)" : "Intra-State (CGST + SGST)"}
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-y border-zinc-200 bg-zinc-50 text-zinc-600 font-semibold">
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
                <tbody className="divide-y divide-zinc-200">
                  {selectedInvoice.items?.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="py-2 px-3 text-zinc-500">{idx + 1}</td>
                      <td className="py-2 px-3 font-semibold text-zinc-900">{item.description}</td>
                      <td className="py-2 px-3 font-mono text-zinc-600">{item.sacHsnCode || "999723"}</td>
                      <td className="py-2 px-3 text-right">{item.quantity}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatCurrency(item.taxableAmount)}</td>
                      <td className="py-2 px-3 text-right">{item.taxRate}%</td>
                      <td className="py-2 px-3 text-right font-bold font-mono">{formatCurrency(item.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Financial Totals & Tax Split Breakdown */}
              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-1.5 text-right font-mono text-xs">
                  <div className="flex justify-between text-zinc-700">
                    <span>Taxable Value:</span>
                    <span>{formatCurrency(selectedInvoice.taxableAmount)}</span>
                  </div>
                  {selectedInvoice.taxSnapshot?.isInterState ? (
                    <div className="flex justify-between text-zinc-700">
                      <span>IGST:</span>
                      <span>{formatCurrency(selectedInvoice.igstAmount)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-zinc-700">
                        <span>CGST (9%):</span>
                        <span>{formatCurrency(selectedInvoice.cgstAmount)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-700">
                        <span>SGST (9%):</span>
                        <span>{formatCurrency(selectedInvoice.sgstAmount)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-bold text-zinc-950 pt-1 border-t border-zinc-200 text-sm">
                    <span>Invoice Total:</span>
                    <span>{formatCurrency(selectedInvoice.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-bold">
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
              <div className="pt-4 border-t border-zinc-200 text-[10px] text-zinc-500">
                <p className="font-semibold text-zinc-700">Terms & Conditions:</p>
                <p>1. Fees once paid are non-refundable and non-transferable.</p>
                <p>2. Gym rules and operating hours must be strictly observed.</p>
                <p>3. This is an official computer-generated Tax Invoice and requires no physical signature.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VOID INVOICE */}
      {showVoidModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-red-500/30 shadow-2xl max-w-md w-full p-6 animate-scaleIn">
            <h2 className="text-base font-bold text-red-500 flex items-center gap-2 mb-2">
              <Ban className="h-4 w-4" />
              Void Invoice {selectedInvoice.invoiceNumber}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Voiding cancels the invoice while preserving the audit record. Voided invoice numbers are archived and never reused.
            </p>

            {modalError && (
              <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleVoidSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Reason for Cancellation <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Created with incorrect billing details upon customer request..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setShowVoidModal(false)}
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
                  {modalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm Void"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
