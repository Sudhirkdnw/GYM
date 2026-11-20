"use client";

import React, { useState, useEffect } from "react";
import { apiClient, ApiClientError } from "@/lib/api-client";
import {
  MemberData,
  PaginatedResult,
  CheckInResponse,
  BranchData,
} from "@gymos/shared-types";
import { Button } from "@/components/ui/button";
import {
  Search,
  User,
  X,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { sound } from "./sound";

interface ManualCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: BranchData | null;
  onSuccess: (res: CheckInResponse) => void;
}

export function ManualCheckInModal({
  isOpen,
  onClose,
  branch,
  onSuccess,
}: ManualCheckInModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<MemberData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberData | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkInResult, setCheckInResult] = useState<CheckInResponse | null>(null);

  // Search debouncing
  useEffect(() => {
    if (!searchTerm.trim() || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        setError(null);
        const res = await apiClient<PaginatedResult<MemberData>>(
          `/members?search=${encodeURIComponent(searchTerm.trim())}&limit=5`
        );
        setSearchResults(res.items || []);
      } catch (err: unknown) {
        setError((err as Error).message || "Failed to search members");
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSelectMember = (member: MemberData) => {
    setSelectedMember(member);
    setError(null);
  };

  const handleReset = () => {
    setSelectedMember(null);
    setSearchTerm("");
    setSearchResults([]);
    setNotes("");
    setError(null);
    setCheckInResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) {
      setError("Please select a member to check in.");
      return;
    }
    if (!branch) {
      setError("Active branch context required for check-in.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const res = await apiClient<CheckInResponse>("/attendance/manual", {
        method: "POST",
        body: JSON.stringify({
          branchId: branch.id,
          memberId: selectedMember.id,
          notes: notes.trim() || undefined,
        }),
      });

      setCheckInResult(res);
      if (res.duesNotice?.hasDues) {
        sound.playWarning();
      } else {
        sound.playSuccess();
      }
      onSuccess(res);
    } catch (err: unknown) {
      sound.playRejection();
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError((err as Error).message || "Check-in failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl animate-in fade-in-50 zoom-in-95">
        <button
          onClick={() => {
            handleReset();
            onClose();
          }}
          className="absolute right-4 top-4 rounded-md p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <User className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Manual Member Check-In
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Branch: <strong className="text-zinc-700 dark:text-zinc-300">{branch?.name || "No branch selected"}</strong>
          </p>
        </div>

        {/* Check-In Success Result State */}
        {checkInResult ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
              <h3 className="font-bold text-emerald-900 dark:text-emerald-200 text-base">
                Check-In Successful!
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                {checkInResult.member.firstName} {checkInResult.member.lastName} ({checkInResult.member.memberNumber})
              </p>
              {checkInResult.record && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Arrival: {new Date(checkInResult.record.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>

            {checkInResult.duesNotice?.hasDues && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-200">
                  <span className="font-bold">Overdue Payment Warning</span>
                  <div className="text-[11px] mt-0.5 text-amber-700 dark:text-amber-300">
                    Overdue: ₹{checkInResult.duesNotice.overdueAmount.toLocaleString("en-IN")}
                    {checkInResult.duesNotice.invoiceNumber ? ` • Invoice #${checkInResult.duesNotice.invoiceNumber}` : ""}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  handleReset();
                }}
              >
                Check In Another
              </Button>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  handleReset();
                  onClose();
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Search Input */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Find Member (Name, Member #, or Phone)
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="e.g. John Doe, M-1002, 9876543210..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  autoFocus
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-zinc-400" />
                )}
              </div>
            </div>

            {/* Member Search Results Dropdown */}
            {searchResults.length > 0 && !selectedMember && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-800">
                {searchResults.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectMember(m)}
                    className="w-full text-left p-2.5 hover:bg-emerald-50/50 dark:hover:bg-zinc-800/80 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {m.firstName} {m.lastName}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {m.memberNumber} • {m.phone || "No phone"}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                        m.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {m.status}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Member Preview Card */}
            {selectedMember && (
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    {selectedMember.firstName} {selectedMember.lastName}
                  </div>
                  <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                    ID: {selectedMember.memberNumber} • Phone: {selectedMember.phone}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 text-zinc-500 hover:text-zinc-700"
                  onClick={() => setSelectedMember(null)}
                >
                  Change
                </Button>
              </div>
            )}

            {/* Notes Input */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Staff Note (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Card forgotten, guest verified by desk..."
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Error Banner */}
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <span className="text-xs text-red-800 dark:text-red-200">{error}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-full text-xs"
                onClick={() => {
                  handleReset();
                  onClose();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!selectedMember || isSubmitting}
                className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking In...
                  </span>
                ) : (
                  "Confirm Check-In"
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
