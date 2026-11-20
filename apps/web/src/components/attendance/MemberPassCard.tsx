"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import QRCode from "qrcode";
import { apiClient, ApiClientError } from "@/lib/api-client";
import {
  MemberAccessPassData,
  DynamicPassTokenResponse,
  PassStatus,
  Permission,
} from "@gymos/shared-types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
  RotateCw,
  XCircle,
  Eye,
  X,
  Clock,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface MemberPassCardProps {
  memberId: string;
  memberName: string;
  permissions: Permission[];
}

export function MemberPassCard({
  memberId,
  memberName,
  permissions,
}: MemberPassCardProps) {
  const [pass, setPass] = useState<MemberAccessPassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Issue modal
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [generateBadge, setGenerateBadge] = useState(true);
  const [isIssuing, setIsIssuing] = useState(false);
  const [newRawPasscode, setNewRawPasscode] = useState<string | null>(null);

  // Revoke modal
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [issueReplacement, setIssueReplacement] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  // Dynamic QR Preview Modal
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrToken, setQrToken] = useState<DynamicPassTokenResponse | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(90);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Copy state
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPasscode, setCopiedPasscode] = useState(false);

  const canManagePass = permissions.includes(Permission.ATTENDANCE_PASS_MANAGE);
  const canReadAttendance = permissions.includes(Permission.ATTENDANCE_READ);

  const fetchPass = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<MemberAccessPassData>(
        `/attendance/members/${memberId}/pass`
      );
      setPass(res);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.statusCode === 404) {
        setPass(null); // No pass issued yet
      } else {
        setError((err as Error).message || "Failed to load access pass metadata");
      }
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    if (canReadAttendance) {
      fetchPass();
    }
  }, [canReadAttendance, fetchPass]);

  // Handle Pass Issuance
  const handleIssuePass = async () => {
    try {
      setIsIssuing(true);
      setError(null);
      const res = await apiClient<{
        pass: MemberAccessPassData;
        rawPhysicalPasscode?: string;
      }>(`/attendance/members/${memberId}/pass/issue`, {
        method: "POST",
        body: JSON.stringify({ generatePhysicalBadge: generateBadge }),
      });

      setPass(res.pass);
      if (res.rawPhysicalPasscode) {
        setNewRawPasscode(res.rawPhysicalPasscode);
      } else {
        setShowIssueModal(false);
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to issue pass");
    } finally {
      setIsIssuing(false);
    }
  };

  // Handle Pass Revocation
  const handleRevokePass = async () => {
    if (!revokeReason.trim()) return;
    try {
      setIsRevoking(true);
      setError(null);
      const updated = await apiClient<MemberAccessPassData>(
        `/attendance/members/${memberId}/pass/revoke`,
        {
          method: "POST",
          body: JSON.stringify({
            reason: revokeReason.trim(),
            issueReplacement,
          }),
        }
      );
      setPass(updated);
      setShowRevokeModal(false);
      setRevokeReason("");
      setIssueReplacement(false);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to revoke pass");
    } finally {
      setIsRevoking(false);
    }
  };

  // Handle Web Pass Link Copy
  const handleCopyWebLink = async () => {
    try {
      const res = await apiClient<{ passToken: string; webPassUrl: string }>(
        `/attendance/members/${memberId}/pass/web-link`
      );
      // Construct public link relative to current origin
      const fullUrl = `${window.location.origin}/pass/${res.passToken}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to generate web pass link");
    }
  };

  // Fetch Dynamic QR Token & Draw Canvas
  const fetchQrToken = useCallback(async () => {
    try {
      setQrLoading(true);
      const res = await apiClient<DynamicPassTokenResponse>(
        `/attendance/members/${memberId}/pass/token`
      );
      setQrToken(res);
      setTimeLeft(90);

      // Render to canvas
      if (canvasRef.current) {
        await QRCode.toCanvas(canvasRef.current, res.token, {
          width: 220,
          margin: 1,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to generate dynamic pass token");
    } finally {
      setQrLoading(false);
    }
  }, [memberId]);

  // QR Modal countdown & refresh
  useEffect(() => {
    if (!showQrModal) return;
    fetchQrToken();

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          fetchQrToken();
          return 90;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showQrModal, fetchQrToken]);

  // Re-draw canvas whenever qrToken changes and canvasRef is ready
  useEffect(() => {
    if (qrToken && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, qrToken.token, {
        width: 220,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      }).catch(() => {});
    }
  }, [qrToken]);

  if (!canReadAttendance) return null;

  return (
    <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm mt-6">
      <CardHeader className="p-4 pb-2 border-b border-zinc-100 dark:border-zinc-800 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-emerald-600" />
            Digital Access Pass & Badge Credentials
          </CardTitle>
          <CardDescription className="text-xs text-zinc-500">
            Dynamic QR pass and physical barcode credentials for front-desk access.
          </CardDescription>
        </div>

        {pass && (
          <span
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
              pass.status === PassStatus.ACTIVE
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : pass.status === PassStatus.SUSPENDED
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            {pass.status}
          </span>
        )}
      </CardHeader>

      <CardContent className="p-4 text-xs">
        {error && (
          <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-2.5 text-xs text-red-800 dark:text-red-200 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-6 text-center text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-1 text-emerald-500" />
            Loading access pass credentials...
          </div>
        ) : !pass ? (
          <div className="py-6 text-center">
            <CreditCard className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">
              No digital access pass issued for this member yet.
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5 max-w-sm mx-auto">
              Issue an access pass to enable dynamic mobile QR token scanning and physical badge passcode generation.
            </p>
            {canManagePass && (
              <Button
                size="sm"
                onClick={() => {
                  setNewRawPasscode(null);
                  setShowIssueModal(true);
                }}
                className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
              >
                <KeyRound className="h-3.5 w-3.5" /> Issue Member Access Pass
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg p-3 border border-zinc-100 dark:border-zinc-800">
              <div>
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block">
                  Physical Badge Code
                </span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-xs">
                  {pass.passCodeMasked || "None Generated"}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block">
                  Issued Date
                </span>
                <span className="text-zinc-800 dark:text-zinc-200">
                  {new Date(pass.createdAt).toLocaleDateString([], {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block">
                  Last Access Recorded
                </span>
                <span className="text-zinc-800 dark:text-zinc-200">
                  {pass.lastScannedAt
                    ? new Date(pass.lastScannedAt).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Never used"}
                </span>
              </div>
            </div>

            {/* Pass Actions Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowQrModal(true)}
                className="text-xs gap-1.5 h-8"
              >
                <Eye className="h-3.5 w-3.5 text-emerald-600" /> View Dynamic QR Pass
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyWebLink}
                className="text-xs gap-1.5 h-8"
              >
                {copiedLink ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" /> Link Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy Member Pass Link
                  </>
                )}
              </Button>

              {canManagePass && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNewRawPasscode(null);
                      setShowIssueModal(true);
                    }}
                    className="text-xs gap-1.5 text-zinc-600 dark:text-zinc-400 h-8 hover:text-zinc-900"
                  >
                    <RotateCw className="h-3.5 w-3.5" /> Rotate Credentials
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowRevokeModal(true)}
                    className="text-xs gap-1.5 text-red-600 dark:text-red-400 h-8 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Revoke Pass
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Modal 1: Issue / Rotate Pass Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl animate-in fade-in-50">
            <button
              onClick={() => setShowIssueModal(false)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-600"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-2">
              <KeyRound className="h-5 w-5 text-emerald-600" />
              {pass ? "Rotate Access Credentials" : "Issue Member Access Pass"}
            </h3>

            {newRawPasscode ? (
              <div className="space-y-4 py-2">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 p-4 text-center">
                  <Check className="h-8 w-8 text-emerald-600 mx-auto mb-1" />
                  <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 block">
                    Access Pass Issued Successfully!
                  </span>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Physical Badge Passcode (save or print immediately):
                  </p>
                  <div className="mt-2 p-2 bg-white dark:bg-zinc-900 rounded border border-emerald-300 dark:border-emerald-700 font-mono font-bold text-base text-zinc-900 dark:text-zinc-100 select-all">
                    {newRawPasscode}
                  </div>
                </div>

                <div className="rounded bg-amber-50 dark:bg-amber-950/30 p-2.5 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    This raw passcode is hashed with argon2id and will never be shown again. Print it on the member&apos;s physical card or share securely.
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="w-full text-xs"
                    onClick={async () => {
                      await navigator.clipboard.writeText(newRawPasscode);
                      setCopiedPasscode(true);
                      setTimeout(() => setCopiedPasscode(false), 2000);
                    }}
                  >
                    {copiedPasscode ? "Passcode Copied!" : "Copy Passcode"}
                  </Button>
                  <Button
                    className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      setShowIssueModal(false);
                      setNewRawPasscode(null);
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Issuing credentials will generate an encrypted HMAC signing secret and rolling dynamic QR token for <strong>{memberName}</strong>.
                </p>

                <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                  <div>
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block">
                      Generate Physical Badge Passcode
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      Creates a 16-character alphanumeric code for physical cards.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={generateBadge}
                    onChange={(e) => setGenerateBadge(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => setShowIssueModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleIssuePass}
                    disabled={isIssuing}
                    className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {isIssuing ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Issuing...
                      </span>
                    ) : (
                      "Confirm & Issue Pass"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 2: Revoke Pass Modal */}
      {showRevokeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl animate-in fade-in-50">
            <button
              onClick={() => setShowRevokeModal(false)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-600"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-base font-bold text-red-600 dark:text-red-400 flex items-center gap-2 mb-2">
              <XCircle className="h-5 w-5" />
              Revoke Member Access Pass
            </h3>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">
              Revoking this pass immediately invalidates all active dynamic QR tokens and physical badges for <strong>{memberName}</strong>.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Revocation Reason (Required)
                </label>
                <input
                  type="text"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="e.g. Card lost, membership cancelled..."
                  className="w-full px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Issue Replacement Pass Immediately
                </span>
                <input
                  type="checkbox"
                  checked={issueReplacement}
                  onChange={(e) => setIssueReplacement(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-red-600 focus:ring-red-500 cursor-pointer"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() => setShowRevokeModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRevokePass}
                  disabled={!revokeReason.trim() || isRevoking}
                  className="w-full text-xs bg-red-600 hover:bg-red-700 text-white"
                >
                  {isRevoking ? "Revoking..." : "Revoke Pass"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: View Live Dynamic QR Code Pass */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl text-center animate-in fade-in-50 zoom-in-95">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full inline-block mb-2">
              GymOS Rolling Pass
            </span>

            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {memberName}
            </h3>
            <p className="text-xs text-zinc-500 mb-4">
              Front-Desk Check-In Pass
            </p>

            <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-inner flex flex-col items-center justify-center mx-auto w-64 h-64 relative">
              <canvas ref={canvasRef} className="rounded" />
              {qrLoading && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                </div>
              )}
            </div>

            {/* Circular Rolling Timer */}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              <Clock className="h-4 w-4 text-emerald-600 animate-pulse" />
              <span>Refreshes in {timeLeft}s</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={fetchQrToken}
                disabled={qrLoading}
                className="h-6 px-1.5 text-zinc-400 hover:text-zinc-700"
                title="Force refresh token"
              >
                <RefreshCw className={`h-3 w-3 ${qrLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
