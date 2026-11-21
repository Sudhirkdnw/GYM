"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import {
  FileText,
  ArrowLeft,
  Save,
  Send,
  Eye,
  Code2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Search,
  History,
  RotateCcw,
  Sparkles,
  X,
  FileCode,
} from "lucide-react";

interface EmailTemplateItem {
  id: string;
  code: string;
  name: string;
  category: string;
  subject: string;
  htmlBody: string;
  textBody?: string | null;
  availableVariables: string[];
  sampleVariables?: Record<string, string> | null;
  isActive: boolean;
  version: number;
  history?: Array<{
    version: number;
    subject: string;
    htmlBody: string;
    textBody?: string;
    updatedAt: string;
  }> | null;
  updatedAt: string;
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"html" | "text" | "preview" | "history">("html");

  // Form State for selected template
  const [editSubject, setEditSubject] = useState("");
  const [editHtmlBody, setEditHtmlBody] = useState("");
  const [editTextBody, setEditTextBody] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  // Preview State
  const [previewData, setPreviewData] = useState<{
    renderedSubject: string;
    renderedHtml: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [targetTestEmail, setTargetTestEmail] = useState("");
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);

  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadTemplates = async (selectCode?: string) => {
    try {
      setIsLoading(true);
      const res = await apiClient<EmailTemplateItem[]>("/platform/settings/email-templates");
      setTemplates(res);

      if (res.length > 0) {
        const toSelect = selectCode
          ? res.find((t) => t.code === selectCode) || res[0]
          : selectedTemplate
          ? res.find((t) => t.code === selectedTemplate.code) || res[0]
          : res[0];

        if (toSelect) {
          selectTemplate(toSelect);
        }
      }
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to load email templates",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const selectTemplate = (template: EmailTemplateItem) => {
    setSelectedTemplate(template);
    setEditSubject(template.subject);
    setEditHtmlBody(template.htmlBody);
    setEditTextBody(template.textBody || "");
    setEditIsActive(template.isActive);
    setStatusMessage(null);
    updatePreview(template.code, template.htmlBody, template.subject, template.sampleVariables || undefined);
  };

  const updatePreview = async (
    code: string,
    html: string,
    subject: string,
    sampleVariables?: Record<string, string>,
  ) => {
    try {
      const res = await apiClient<{
        renderedSubject: string;
        renderedHtml: string;
      }>(`/platform/settings/email-templates/${code}/preview`, {
        method: "POST",
        body: JSON.stringify({ sampleVariables }),
      });
      setPreviewData(res);
    } catch {
      // Fallback client-side interpolation
      const vars = sampleVariables || {};
      const interpolate = (str: string) =>
        str.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => vars[k] || `{{${k}}}`);
      setPreviewData({
        renderedSubject: interpolate(subject),
        renderedHtml: interpolate(html),
      });
    }
  };

  const handleCopyVariable = (varName: string) => {
    const text = `{{${varName}}}`;
    navigator.clipboard.writeText(text);
    setCopiedVariable(varName);
    setTimeout(() => setCopiedVariable(null), 1800);
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;

    try {
      setIsSaving(true);
      setStatusMessage(null);

      const res = await apiClient<{ success: boolean; message: string; template: EmailTemplateItem }>(
        `/platform/settings/email-templates/${selectedTemplate.code}`,
        {
          method: "PUT",
          body: JSON.stringify({
            subject: editSubject,
            htmlBody: editHtmlBody,
            textBody: editTextBody,
            isActive: editIsActive,
          }),
        },
      );

      setStatusMessage({
        type: "success",
        text: res.message,
      });

      await loadTemplates(selectedTemplate.code);
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update email template",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate || !targetTestEmail.trim()) return;

    try {
      setIsSendingTest(true);
      setStatusMessage(null);

      const res = await apiClient<{ success: boolean; message: string }>(
        `/platform/settings/email-templates/${selectedTemplate.code}/test-send`,
        {
          method: "POST",
          body: JSON.stringify({ targetEmail: targetTestEmail.trim() }),
        },
      );

      setStatusMessage({
        type: "success",
        text: res.message,
      });
      setIsTestModalOpen(false);
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to dispatch test template email",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter((tpl) => {
    const matchesCategory = selectedCategory === "ALL" || tpl.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === "" ||
      tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = ["ALL", "AUTHENTICATION", "ONBOARDING", "BILLING"];

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/[0.08] pb-6">
        <div>
          <Link
            href="/platform/settings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Settings Hub</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Email Template Studio
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Manage 10 platform transactional emails, customize HTML & plain text, and preview live variables.
              </p>
            </div>
          </div>
        </div>

        {selectedTemplate && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTestModalOpen(true)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#12131a] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-700 dark:text-zinc-300 transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5 text-amber-500" />
              <span>Send Test</span>
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Saving..." : "Save Template"}</span>
            </button>
          </div>
        )}
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-2.5 ${
            statusMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Template List (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Search & Categories */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-4 shadow-sm space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-colors ${
                    selectedCategory === cat
                      ? "bg-amber-600 text-white"
                      : "bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-white/[0.1]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* List of Templates */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-white/[0.05]">
            {filteredTemplates.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No templates found matching your filter.
              </div>
            ) : (
              filteredTemplates.map((tpl) => {
                const isSelected = selectedTemplate?.id === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => selectTemplate(tpl)}
                    className={`w-full text-left p-4 transition-all flex flex-col gap-1.5 ${
                      isSelected
                        ? "bg-amber-500/10 border-l-4 border-l-amber-500 dark:bg-amber-500/10"
                        : "hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {tpl.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-zinc-400">
                        v{tpl.version}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      {tpl.subject}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        {tpl.category}
                      </span>
                      <span
                        className={`text-[10px] font-semibold ${
                          tpl.isActive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-400"
                        }`}
                      >
                        {tpl.isActive ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Template Editor & Preview (8 cols) */}
        {selectedTemplate ? (
          <div className="lg:col-span-8 space-y-4">
            {/* Meta & Subject Card */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {selectedTemplate.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Identifier: {selectedTemplate.code} • Version: v{selectedTemplate.version}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                    Active:
                  </label>
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                  />
                </div>
              </div>

              {/* Subject Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Email Subject Line <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editSubject}
                  onChange={(e) => {
                    setEditSubject(e.target.value);
                    updatePreview(selectedTemplate.code, editHtmlBody, e.target.value, selectedTemplate.sampleVariables || undefined);
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              {/* Available Variables Pills */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center justify-between">
                  <span>Available Variables (Click to copy placeholder):</span>
                  {copiedVariable && (
                    <span className="text-emerald-500 font-normal">
                      Copied &#123;&#123;{copiedVariable}&#125;&#125;!
                    </span>
                  )}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedTemplate.availableVariables || []).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleCopyVariable(v)}
                      className="px-2 py-0.5 rounded-lg text-[11px] font-mono bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors flex items-center gap-1"
                    >
                      <span>&#123;&#123;{v}&#125;&#125;</span>
                      {copiedVariable === v ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-2.5 h-2.5 opacity-60" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Editor Tabs Card */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12131a] overflow-hidden shadow-sm">
              {/* Tab Selector Header */}
              <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-[#090a0f] border-b border-slate-200 dark:border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("html")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeTab === "html"
                        ? "bg-white dark:bg-[#1a1c27] text-amber-600 dark:text-amber-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>HTML Template</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("text")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeTab === "text"
                        ? "bg-white dark:bg-[#1a1c27] text-amber-600 dark:text-amber-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>Plain Text Fallback</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("preview");
                      updatePreview(selectedTemplate.code, editHtmlBody, editSubject, selectedTemplate.sampleVariables || undefined);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeTab === "preview"
                        ? "bg-white dark:bg-[#1a1c27] text-amber-600 dark:text-amber-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Live Preview</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("history")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeTab === "history"
                        ? "bg-white dark:bg-[#1a1c27] text-amber-600 dark:text-amber-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>History ({selectedTemplate.history?.length || 0})</span>
                  </button>
                </div>
              </div>

              {/* Tab 1: HTML Body */}
              {activeTab === "html" && (
                <div className="p-4 space-y-2">
                  <textarea
                    rows={16}
                    value={editHtmlBody}
                    onChange={(e) => {
                      setEditHtmlBody(e.target.value);
                      updatePreview(selectedTemplate.code, e.target.value, editSubject, selectedTemplate.sampleVariables || undefined);
                    }}
                    className="w-full p-4 rounded-xl text-xs font-mono border border-slate-200 dark:border-white/[0.1] bg-slate-950 text-emerald-400 dark:bg-[#07080c] focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-400">
                    Tip: Script tags and insecure attributes are automatically stripped on save for recipient safety.
                  </p>
                </div>
              )}

              {/* Tab 2: Plain Text Body */}
              {activeTab === "text" && (
                <div className="p-4 space-y-2">
                  <textarea
                    rows={16}
                    value={editTextBody}
                    onChange={(e) => setEditTextBody(e.target.value)}
                    className="w-full p-4 rounded-xl text-xs font-mono border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
                    placeholder="Plain text fallback for email clients that do not support rich HTML..."
                  />
                </div>
              )}

              {/* Tab 3: Live Preview */}
              {activeTab === "preview" && (
                <div className="p-5 space-y-4">
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#090a0f] border border-slate-200 dark:border-white/[0.08] text-xs space-y-1">
                    <p className="text-slate-500 dark:text-zinc-400">
                      <strong>Subject Preview:</strong>{" "}
                      <span className="text-slate-900 dark:text-white">
                        {previewData?.renderedSubject || editSubject}
                      </span>
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white overflow-hidden shadow-sm">
                    <iframe
                      title="Email Preview"
                      srcDoc={previewData?.renderedHtml || editHtmlBody}
                      className="w-full min-h-[460px] border-0"
                    />
                  </div>
                </div>
              )}

              {/* Tab 4: Version History */}
              {activeTab === "history" && (
                <div className="p-5 space-y-4">
                  {!selectedTemplate.history || selectedTemplate.history.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">
                      No previous revisions found for this template (Currently on initial version v1).
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedTemplate.history.map((h, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0b0c12] text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-white">
                              Version {h.version}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(h.updatedAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-zinc-300">
                            <strong>Subject:</strong> {h.subject}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setEditSubject(h.subject);
                              setEditHtmlBody(h.htmlBody);
                              if (h.textBody) setEditTextBody(h.textBody);
                              setActiveTab("html");
                            }}
                            className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline pt-1 inline-flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restore this revision into editor</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Modal: Send Test Template Email */}
      {isTestModalOpen && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#12131a] border border-slate-200 dark:border-white/[0.1] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Send Test Email ({selectedTemplate.code})
                </h3>
              </div>
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Dispatches a test rendered version of <strong>{selectedTemplate.name}</strong> populated with sample variables to your test inbox.
            </p>

            <form onSubmit={handleSendTestEmail} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  required
                  value={targetTestEmail}
                  onChange={(e) => setTargetTestEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#0b0c12] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="test@yourdomain.com"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingTest}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingTest ? "Dispatching..." : "Send Test Email"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
