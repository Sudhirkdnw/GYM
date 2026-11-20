"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import {
  Layers,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface FeatureCatalogItem {
  key: string;
  domain: string;
  name: string;
  description?: string;
  valueType: string;
}

export default function PlatformFeaturesPage() {
  const [features, setFeatures] = useState<FeatureCatalogItem[]>([]);
  const [grouped, setGrouped] = useState<Record<string, FeatureCatalogItem[]>>({});
  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCatalog() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await apiClient<{
          all: FeatureCatalogItem[];
          grouped: Record<string, FeatureCatalogItem[]>;
        }>("/platform/features");
        setFeatures(res.all || []);
        setGrouped(res.grouped || {});
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load feature catalog",
        );
      } finally {
        setIsLoading(false);
      }
    }
    loadCatalog();
  }, []);

  const domainNames = Object.keys(grouped);

  const filteredFeatures = features.filter((f) => {
    const matchesDomain =
      selectedDomain === "ALL" || f.domain === selectedDomain;
    const matchesSearch =
      !search.trim() ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.key.toLowerCase().includes(search.toLowerCase()) ||
      (f.description && f.description.toLowerCase().includes(search.toLowerCase()));
    return matchesDomain && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="h-6 w-6 text-violet-600 dark:text-violet-400" />
          <span>GymOS Product Feature Catalog ({features.length} Modules)</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
          Complete authoritative registry of modules, features, quotas, and service capabilities in GymOS.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#0e0f17] p-3 rounded-xl border border-slate-200 dark:border-white/[0.08] shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search features by name or key..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#141522] border border-slate-200 dark:border-white/[0.08] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-400 shrink-0" />
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="bg-slate-50 dark:bg-[#141522] border border-slate-200 dark:border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
          >
            <option value="ALL">All Domains ({features.length})</option>
            {domainNames.map((d) => (
              <option key={d} value={d}>
                {d.toUpperCase()} ({(grouped[d] || []).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-950/20 p-4 text-red-800 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFeatures.map((f) => (
            <div
              key={f.key}
              className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0e0f17] p-4 flex flex-col justify-between hover:border-violet-500/40 shadow-sm transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:border dark:border-violet-500/30 px-2 py-0.5 text-[9px] font-bold dark:text-violet-300 uppercase">
                    {f.domain}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                    {f.valueType}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm mt-2">{f.name}</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 line-clamp-2">
                  {f.description || "Module functionality"}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between text-[11px] font-mono text-slate-400 dark:text-zinc-500">
                <span className="truncate max-w-[200px]">{f.key}</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
