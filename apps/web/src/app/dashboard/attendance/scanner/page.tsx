"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { useAuth } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import {
  CheckInResponse,
  AttendanceMethod,
  Permission,
} from "@gymos/shared-types";
import { Button } from "@/components/ui/button";
import { AttendanceNav } from "@/components/attendance/AttendanceNav";
import { ManualCheckInModal } from "@/components/attendance/ManualCheckInModal";
import { sound } from "@/components/attendance/sound";
import {
  QrCode,
  Camera,
  CameraOff,
  AlertTriangle,
  AlertCircle,
  CreditCard,
  UserCheck,
  ShieldAlert,
  Loader2,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

export default function FrontDeskScannerPage() {
  const router = useRouter();
  const { organization, selectedBranch, isAuthenticated, isLoading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<"camera" | "passcode">("camera");
  const [cameraState, setCameraState] = useState<
    "idle" | "requesting" | "active" | "denied" | "unavailable" | "unsupported"
  >("idle");
  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState<number>(0);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [manualBadgeCode, setManualBadgeCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanResult, setScanResult] = useState<CheckInResponse | null>(null);
  const [scanError, setScanError] = useState<{ code: string; message: string } | null>(null);
  const [resetCountdown, setResetCountdown] = useState<number>(4);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);
  const lastScannedTokenRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);

  const permissions = organization?.permissions || [];
  const canCheckIn =
    permissions.includes(Permission.ATTENDANCE_CHECKIN) ||
    permissions.includes(Permission.ATTENDANCE_MANUAL);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Post Check-In Request to Backend
  const handleCheckInPayload = useCallback(
    async (payload: { qrToken?: string; badgeCode?: string; method: AttendanceMethod }) => {
      if (isProcessingRef.current || isSubmitting) return;

      if (!selectedBranch?.id) {
        sound.playError();
        setScanError({
          code: "BRANCH_REQUIRED",
          message: "No active branch selected. Please select a branch from the top header.",
        });
        return;
      }

      try {
        isProcessingRef.current = true;
        setIsSubmitting(true);
        setScanError(null);
        setScanResult(null);

        const response = await apiClient<CheckInResponse>("/attendance/check-in/qr", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            branchId: selectedBranch.id,
          }),
        });

        sound.playSuccess();
        setScanResult(response);
        setResetCountdown(4);

        if (payload.badgeCode) {
          setManualBadgeCode("");
        }
      } catch (err: unknown) {
        sound.playError();
        if (err instanceof ApiClientError) {
          const errData = err.errorResponse as Record<string, unknown> | undefined;
          const errorCode =
            (typeof errData?.code === "string" ? errData.code : undefined) ||
            err.errorResponse?.error ||
            `HTTP_${err.statusCode}`;
          const errorMsg = err.errorResponse?.message || err.message;
          setScanError({
            code: errorCode,
            message: Array.isArray(errorMsg) ? errorMsg.join(", ") : errorMsg,
          });
        } else {
          setScanError({
            code: "SCAN_FAILED",
            message: (err as Error).message || "An unexpected validation error occurred",
          });
        }
        setResetCountdown(5);
      } finally {
        setIsSubmitting(false);
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 1500);
      }
    },
    [isSubmitting, selectedBranch?.id]
  );

  // Auto-reset timer
  useEffect(() => {
    if (!scanResult && !scanError) return;

    const timer = setInterval(() => {
      setResetCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setScanResult(null);
          setScanError(null);
          return 4;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [scanResult, scanError]);

  // Video Frame Scanning Loop via jsQR
  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(tick);
      return;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(tick);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code && code.data && !isProcessingRef.current) {
      const now = Date.now();
      const rawToken = code.data.trim();

      if (rawToken === lastScannedTokenRef.current && now - lastScannedTimeRef.current < 4000) {
        // Debounce same QR
      } else {
        lastScannedTokenRef.current = rawToken;
        lastScannedTimeRef.current = now;

        handleCheckInPayload({
          qrToken: rawToken,
          method: AttendanceMethod.QR_SCAN,
        });
      }
    }

    animationFrameRef.current = requestAnimationFrame(tick);
  }, [handleCheckInPayload]);

  // Start Camera
  const startCamera = useCallback(
    async (deviceIndex: number = 0) => {
      stopCamera();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState("unsupported");
        return;
      }

      try {
        setCameraState("requesting");

        let constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        if (videoDevices.length > 0 && videoDevices[deviceIndex]) {
          constraints = {
            video: {
              deviceId: { exact: videoDevices[deviceIndex].deviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          };
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play();
        }

        setCameraState("active");
        animationFrameRef.current = requestAnimationFrame(tick);

        const devices = await navigator.mediaDevices.enumerateDevices();
        const vInputs = devices.filter((d) => d.kind === "videoinput");
        setVideoDevices(vInputs);
      } catch (err: unknown) {
        console.error("Camera access failed:", err);
        const name = (err as Error).name;
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setCameraState("denied");
        } else {
          setCameraState("unavailable");
        }
      }
    },
    [stopCamera, tick, videoDevices]
  );

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const handleBadgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBadgeCode.trim()) return;
    handleCheckInPayload({
      badgeCode: manualBadgeCode.trim().toUpperCase(),
      method: AttendanceMethod.RFID_CARD,
    });
  };

  if (!canCheckIn) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-12 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20">
        <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Permission Denied</h2>
        <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
          You do not have permission to perform front-desk member check-in.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-white/[0.06]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <QrCode className="h-7 w-7 text-violet-600 dark:text-violet-400" />
            <span>Front-Desk Scanner Mode</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-zinc-400 flex items-center gap-2">
            <span>Active Branch:</span>
            <strong className="text-slate-800 dark:text-zinc-200 font-semibold">
              {selectedBranch?.name || "Please select branch"}
            </strong>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            className="text-xs gap-1.5 border-slate-200 dark:border-white/[0.08]"
            onClick={() => setIsManualModalOpen(true)}
          >
            <UserCheck className="h-4 w-4 text-emerald-500" />
            <span>Member Search Check-In</span>
          </Button>
          <Link href="/dashboard/attendance">
            <Button variant="ghost" className="text-xs text-slate-600 dark:text-zinc-400 gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Live Floor</span>
            </Button>
          </Link>
        </div>
      </div>

      <AttendanceNav />

      {/* Tabs: Camera Scanner vs Badge */}
      <div className="inline-flex p-1 rounded-xl border bg-slate-100/80 border-slate-200/80 dark:bg-white/[0.04] dark:border-white/[0.08]">
        <button
          onClick={() => setActiveTab("camera")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "camera"
              ? "bg-white text-slate-900 shadow-sm dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:text-white dark:shadow-glow dark:shadow-violet-500/25"
              : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Camera className="h-3.5 w-3.5" />
          <span>Camera Scanner</span>
        </button>
        <button
          onClick={() => {
            setActiveTab("passcode");
            stopCamera();
            setCameraState("idle");
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === "passcode"
              ? "bg-white text-slate-900 shadow-sm dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:text-white dark:shadow-glow dark:shadow-violet-500/25"
              : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <CreditCard className="h-3.5 w-3.5" />
          <span>Physical Badge / Passcode</span>
        </button>
      </div>

      {/* Visual Feedback Overlays */}
      {(scanResult || scanError) && (
        <div className="animate-in fade-in-50 zoom-in-95 duration-200">
          {scanResult && (
            <div className="p-5 rounded-2xl border bg-emerald-50/90 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-100 shadow-lg">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-lg">
                    {scanResult.member.firstName[0]}
                    {scanResult.member.lastName[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {scanResult.member.firstName} {scanResult.member.lastName}
                      </h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200">
                        CHECKED IN
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
                      ID: <strong className="text-slate-800 dark:text-zinc-200 font-mono">{scanResult.member.memberNumber}</strong> • Plan:{" "}
                      <strong className="text-emerald-700 dark:text-emerald-300">{scanResult.membership?.planName || "General Admission"}</strong>
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 block">
                    Auto-resets in {resetCountdown}s
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setScanResult(null);
                      setScanError(null);
                    }}
                    className="text-xs h-6 px-2 text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 mt-1"
                  >
                    Scan Next Now
                  </Button>
                </div>
              </div>

              {scanResult.duesNotice?.hasDues && (
                <div className="mt-3.5 rounded-xl bg-amber-100/90 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/50 p-3 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 dark:text-amber-200">
                    <strong className="block">Outstanding Dues Warning</strong>
                    <span className="text-[11px]">
                      Overdue Balance: ₹{scanResult.duesNotice.overdueAmount.toLocaleString("en-IN")}
                      {scanResult.duesNotice.invoiceNumber ? ` • Invoice #${scanResult.duesNotice.invoiceNumber}` : ""}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {scanError && (
            <div className="p-5 rounded-2xl border bg-rose-50/90 border-rose-300 dark:bg-rose-950/40 dark:border-rose-500/30 text-rose-900 dark:text-rose-100 shadow-lg">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="h-12 w-12 rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Check-In Denied
                      </h2>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200">
                        {scanError.code}
                      </span>
                    </div>
                    <p className="text-xs text-rose-800 dark:text-rose-300 mt-0.5 font-medium">
                      {scanError.message}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 block">
                    Resets in {resetCountdown}s
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setScanResult(null);
                      setScanError(null);
                    }}
                    className="text-xs h-6 px-2 text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 mt-1"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Camera Viewport Mode */}
      {activeTab === "camera" && (
        <div className="rounded-2xl border overflow-hidden bg-white border-slate-200 shadow-sm dark:bg-[#131622] dark:border-white/[0.08] dark:shadow-card-dark">
          <div className="relative bg-slate-950 flex flex-col items-center justify-center min-h-[380px] sm:min-h-[460px] overflow-hidden">
            <video
              ref={videoRef}
              className={`w-full max-h-[500px] object-cover ${
                cameraState === "active" ? "block" : "hidden"
              }`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Viewfinder Target */}
            {cameraState === "active" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-64 h-64 sm:w-72 sm:h-72 border-2 border-violet-500/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] overflow-hidden">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-violet-400 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-violet-400 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-violet-400 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-violet-400 rounded-br-lg" />
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-violet-400 to-transparent shadow-[0_0_12px_#8b5cf6] animate-bounce" />
                </div>
              </div>
            )}

            {/* Idle State */}
            {cameraState === "idle" && (
              <div className="p-8 text-center text-zinc-300">
                <Camera className="h-12 w-12 text-zinc-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">Front-Desk Scanner Ready</h3>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto mt-1 mb-5">
                  Position the browser camera facing the member&apos;s phone or printed gym pass.
                </p>
                <Button
                  onClick={() => startCamera(selectedDeviceIndex)}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs gap-2 shadow-glow shadow-violet-500/25"
                >
                  <Camera className="h-4 w-4" />
                  <span>Enable Camera Scanner</span>
                </Button>
              </div>
            )}

            {cameraState === "requesting" && (
              <div className="p-8 text-center text-zinc-300">
                <Loader2 className="h-10 w-10 text-violet-400 animate-spin mx-auto mb-3" />
                <p className="text-sm font-semibold text-white">Requesting Camera Permissions...</p>
                <p className="text-xs text-zinc-400 mt-1">Please approve the browser camera prompt to continue.</p>
              </div>
            )}

            {cameraState === "denied" && (
              <div className="p-8 text-center text-zinc-300 max-w-sm">
                <CameraOff className="h-12 w-12 text-rose-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">Camera Access Blocked</h3>
                <p className="text-xs text-zinc-400 mt-1 mb-4">
                  Camera permission was denied. Please allow camera access in your browser settings.
                </p>
                <Button
                  variant="outline"
                  onClick={() => startCamera(selectedDeviceIndex)}
                  className="text-xs text-white border-zinc-700"
                >
                  Retry Permission
                </Button>
              </div>
            )}
          </div>

          {/* Camera Controls Bar */}
          <div className="p-4 border-t border-slate-100 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-zinc-400">Device:</span>
              <select
                disabled={videoDevices.length <= 1}
                value={selectedDeviceIndex}
                onChange={(e) => {
                  const idx = parseInt(e.target.value, 10);
                  setSelectedDeviceIndex(idx);
                  if (cameraState === "active") {
                    startCamera(idx);
                  }
                }}
                className="rounded-lg border px-2.5 py-1 text-xs bg-white dark:bg-[#131622] border-slate-200 dark:border-white/[0.1] text-slate-800 dark:text-zinc-200 focus:outline-none"
              >
                {videoDevices.length === 0 ? (
                  <option value={0}>Default System Camera</option>
                ) : (
                  videoDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={i}>
                      {d.label || `Camera ${i + 1}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {cameraState === "active" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={stopCamera}
                  className="text-xs gap-1.5 border-slate-200 dark:border-white/[0.08]"
                >
                  <CameraOff className="h-3.5 w-3.5 text-rose-500" />
                  <span>Stop Camera</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => startCamera(selectedDeviceIndex)}
                  className="text-xs gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>Start Camera</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Physical Badge / Passcode Mode */}
      {activeTab === "passcode" && (
        <div className="p-6 sm:p-8 rounded-2xl border bg-white border-slate-200 shadow-sm dark:bg-[#131622] dark:border-white/[0.08] dark:shadow-card-dark max-w-xl mx-auto">
          <div className="text-center mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300 mx-auto mb-3">
              <CreditCard className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Physical Badge & RFID Scan
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
              Scan RFID tag with USB reader or type the 16-character member pass code.
            </p>
          </div>

          <form onSubmit={handleBadgeSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                autoFocus
                value={manualBadgeCode}
                onChange={(e) => setManualBadgeCode(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="w-full text-center text-lg sm:text-xl font-mono tracking-widest uppercase p-3 rounded-xl border transition-all focus:outline-none
                  bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20
                  dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-white dark:placeholder-zinc-600 dark:focus:border-violet-500 dark:focus:ring-violet-500/30"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !manualBadgeCode.trim()}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold shadow-glow shadow-violet-500/25 py-2.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>Validating Badge...</span>
                </>
              ) : (
                <span>Submit Badge Check-In</span>
              )}
            </Button>
          </form>
        </div>
      )}

      {/* Manual Modal */}
      <ManualCheckInModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        branch={selectedBranch}
        onSuccess={(res) => {
          setScanResult(res);
          setIsManualModalOpen(false);
        }}
      />
    </div>
  );
}
