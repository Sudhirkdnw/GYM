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
    <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Digital Access Pass & Badge Credentials
            </h3>
            <p className="text-xs text-muted-foreground">
              Dynamic rolling QR pass and physical barcode credentials for front-desk access.
            </p>
          </div>
        </div>

        {pass && (
          <span
            className={`text-xs font-bold uppercase px-3 py-1 rounded-full border ${
              pass.status === PassStatus.ACTIVE
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : pass.status === PassStatus.SUSPENDED
                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                : "bg-red-500/10 text-red-500 border-red-500/20"
            }`}
          >
            {pass.status}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-500 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-muted-foreground text-xs">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
          Loading access pass credentials...
        </div>
      ) : !pass ? (
        <div className="py-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted/50 border border-border flex items-center justify-center mx-auto mb-3 text-muted-foreground">
            <CreditCard className="h-6 w-6" />
          </div>
          <p className="font-semibold text-foreground text-sm">
            No digital access pass issued yet
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Issue an access pass to enable dynamic mobile QR token scanning and physical badge passcode generation.
          </p>
          {canManagePass && (
            <button
              onClick={() => {
                setNewRawPasscode(null);
                setShowIssueModal(true);
              }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all"
            >
              <KeyRound className="h-4 w-4" /> Issue Member Access Pass
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20">
              <span className="text-[11px] font-medium text-muted-foreground block mb-1">
                Physical Badge Code
              </span>
              <span className="font-mono font-bold text-foreground text-xs tracking-wider">
                {pass.passCodeMasked || "None Generated"}
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20">
              <span className="text-[11px] font-medium text-muted-foreground block mb-1">
                Issued Date
              </span>
              <span className="text-xs font-semibold text-foreground">
                {new Date(pass.createdAt).toLocaleDateString([], {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20">
              <span className="text-[11px] font-medium text-muted-foreground block mb-1">
                Last Access Recorded
              </span>
              <span className="text-xs font-semibold text-foreground">
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
            <button
              onClick={() => setShowQrModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all"
            >
              <Eye className="h-3.5 w-3.5" /> View Dynamic QR Pass
            </button>

            <button
              onClick={handleCopyWebLink}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-card border border-border hover:bg-accent text-foreground transition-colors"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Link Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-primary" /> Copy Member Pass Link
                </>
              )}
            </button>

            {canManagePass && (
              <>
                <button
                  onClick={() => {
                    setNewRawPasscode(null);
                    setShowIssueModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-card border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RotateCw className="h-3.5 w-3.5" /> Rotate Credentials
                </button>

                <button
                  onClick={() => setShowRevokeModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-card border border-red-500/20 hover:bg-red-500/10 text-red-500 transition-colors"
                >
                  <XCircle className="h-3.5 w-3.5" /> Revoke Pass
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal 1: Issue / Rotate Pass Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border/80 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scaleIn relative">
            <button
              onClick={() => setShowIssueModal(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-2">
              <KeyRound className="h-5 w-5 text-primary" />
              {pass ? "Rotate Access Credentials" : "Issue Member Access Pass"}
            </h3>

            {newRawPasscode ? (
              <div className="space-y-4 py-2">
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
                  <Check className="h-8 w-8 text-emerald-500 mx-auto mb-1" />
                  <span className="text-xs font-bold text-emerald-500 block">
                    Access Pass Issued Successfully!
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Physical Badge Passcode (save or print immediately):
                  </p>
                  <div className="mt-2 p-2.5 bg-background rounded-xl border border-emerald-500/30 font-mono font-bold text-base text-foreground select-all">
                    {newRawPasscode}
                  </div>
                </div>

                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-500 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    This raw passcode is hashed with argon2id and will never be shown again. Print it on the member&apos;s physical card or share securely.
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(newRawPasscode);
                      setCopiedPasscode(true);
                      setTimeout(() => setCopiedPasscode(false), 2000);
                    }}
                    className="w-full py-2 rounded-xl border border-border bg-card text-xs font-semibold hover:bg-accent"
                  >
                    {copiedPasscode ? "Passcode Copied!" : "Copy Passcode"}
                  </button>
                  <button
                    onClick={() => {
                      setShowIssueModal(false);
                      setNewRawPasscode(null);
                    }}
                    className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <p className="text-xs text-muted-foreground">
                  Issuing credentials will generate an encrypted HMAC signing secret and rolling dynamic QR token for <strong className="text-foreground">{memberName}</strong>.
                </p>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-muted/20">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Generate Physical Badge Passcode
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Creates a 16-character alphanumeric code for physical cards.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={generateBadge}
                    onChange={(e) => setGenerateBadge(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowIssueModal(false)}
                    className="w-full py-2 rounded-xl border border-border bg-card text-xs font-semibold hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleIssuePass}
                    disabled={isIssuing}
                    className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isIssuing ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Issuing...
                      </span>
                    ) : (
                      "Confirm & Issue Pass"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 2: Revoke Pass Modal */}
      {showRevokeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scaleIn relative">
            <button
              onClick={() => setShowRevokeModal(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-base font-bold text-red-500 flex items-center gap-2 mb-2">
              <XCircle className="h-5 w-5" />
              Revoke Member Access Pass
            </h3>

            <p className="text-xs text-muted-foreground mb-4">
              Revoking this pass immediately invalidates all active dynamic QR tokens and physical badges for <strong className="text-foreground">{memberName}</strong>.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Revocation Reason (Required)
                </label>
                <input
                  type="text"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="e.g. Card lost, membership cancelled..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background/50 text-foreground focus:ring-2 focus:ring-red-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20">
                <span className="text-xs font-semibold text-foreground">
                  Issue Replacement Pass Immediately
                </span>
                <input
                  type="checkbox"
                  checked={issueReplacement}
                  onChange={(e) => setIssueReplacement(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-red-500 focus:ring-red-500 cursor-pointer"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowRevokeModal(false)}
                  className="w-full py-2 rounded-xl border border-border bg-card text-xs font-semibold hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRevokePass}
                  disabled={!revokeReason.trim() || isRevoking}
                  className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {isRevoking ? "Revoking..." : "Revoke Pass"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: View Live Dynamic QR Code Pass */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-card border border-border/80 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center animate-scaleIn relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <span className="text-[10px] uppercase font-bold tracking-wider text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full inline-block mb-2">
              GymOS Rolling Pass
            </span>

            <h3 className="text-lg font-bold text-foreground">
              {memberName}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Front-Desk Check-In Pass
            </p>

            <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-inner flex flex-col items-center justify-center mx-auto w-64 h-64 relative">
              <canvas ref={canvasRef} className="rounded-lg" />
              {qrLoading && (
                <div className="absolute inset-0 bg-white/80 rounded-2xl flex items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
              )}
            </div>

            {/* Circular Rolling Timer */}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
              <Clock className="h-4 w-4 text-primary animate-pulse" />
              <span>Refreshes in {timeLeft}s</span>
              <button
                onClick={fetchQrToken}
                disabled={qrLoading}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                title="Force refresh token"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${qrLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
