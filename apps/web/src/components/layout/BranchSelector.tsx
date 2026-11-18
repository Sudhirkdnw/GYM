"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { MapPin, ChevronDown, Check, Building } from "lucide-react";
import Link from "next/link";

export function BranchSelector() {
  const { branches, selectedBranch, selectBranch, organization } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  if (!organization || branches.length === 0) {
    return null;
  }

  const handleSelect = async (branchId: string) => {
    try {
      setIsChanging(true);
      await selectBranch(branchId);
      setIsOpen(false);
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isChanging}
        className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 transition-colors"
        title="Select Branch"
      >
        <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="font-semibold max-w-[120px] sm:max-w-[160px] truncate">
          {selectedBranch ? selectedBranch.name : "Select Branch"}
        </span>
        <ChevronDown className="h-3 w-3 opacity-70 shrink-0" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-1.5 w-56 rounded-md border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 z-50 animate-in fade-in zoom-in-95">
            <div className="px-2 py-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <span>Gym Branches</span>
              <Link
                href="/dashboard/branches"
                onClick={() => setIsOpen(false)}
                className="text-emerald-600 hover:underline capitalize font-normal text-xs"
              >
                Manage
              </Link>
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {branches.map((b) => {
                const isSelected = selectedBranch?.id === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => handleSelect(b.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-sm text-left transition-colors ${
                      isSelected
                        ? "bg-emerald-50 text-emerald-900 font-semibold dark:bg-emerald-950/50 dark:text-emerald-200"
                        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Building className="h-3.5 w-3.5 opacity-60 shrink-0" />
                      <div className="truncate">
                        <div className="truncate">{b.name}</div>
                        <div className="text-[10px] text-zinc-400 font-normal">
                          {b.branchCode} {b.city ? `• ${b.city}` : ""}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
