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
import { Card, CardContent } from "@/components/ui/card";
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
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Submit scan payload to backend API
  const handleCheckInPayload = useCallback(
    async (payload: { token?: string; badgeCode?: string; method: AttendanceMethod }) => {
      if (!selectedBranch?.id) {
        setScanError({
          code: "BRANCH_REQUIRED",
          message: "Please select an active branch context before checking in.",
        });
        sound.playRejection();
        return;
      }

      try {
        setIsSubmitting(true);
        setScanResult(null);
        setScanError(null);

        const qrToken = payload.token || payload.badgeCode;
        const res = await apiClient<CheckInResponse>("/attendance/scan", {
          method: "POST",
          body: JSON.stringify({
            branchId: selectedBranch.id,
            qrToken,
            method: payload.method,
          }),
        });

        setScanResult(res);
        if (res.duesNotice?.hasDues) {
          sound.playWarning();
        } else {
          sound.playSuccess();
        }
        setResetCountdown(4);
      } catch (err: unknown) {
        sound.playRejection();
        if (err instanceof ApiClientError) {
          const code = (err.errorResponse?.error as string) || "CHECKIN_DENIED";
          setScanError({
            code,
            message: err.message,
          });
        } else {
          setScanError({
            code: "CHECKIN_FAILED",
            message: (err as Error).message || "Check-in failed",
          });
        }
        setResetCountdown(4);
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedBranch?.id]
  );

  // Frame processing loop for QR scanner
  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || isProcessingRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const video = videoRef.current;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (ctx) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data) {
          const rawPayload = code.data.trim();
          const now = Date.now();

          // Prevent scanning the exact same QR payload within 4 seconds
          if (
            lastScannedTokenRef.current === rawPayload &&
            now - lastScannedTimeRef.current < 4000
          ) {
            // Debounce / duplicate ignored
          } else {
            lastScannedTokenRef.current = rawPayload;
            lastScannedTimeRef.current = now;
            isProcessingRef.current = true;

            handleCheckInPayload({
              token: rawPayload,
              method: AttendanceMethod.QR_SCAN,
            }).finally(() => {
              isProcessingRef.current = false;
            });
          }
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  }, [handleCheckInPayload]);

  // Start Camera
  const startCamera = async (deviceIndex = 0) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState("unsupported");
      return;
    }

    try {
      setCameraState("requesting");
      stopCamera();

      // Enumerate camera devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setVideoDevices(videoInputs);

      // Constraints prefer rear/environment camera for mobile check-in
      const targetDeviceId = videoInputs[deviceIndex]?.deviceId;
      const constraints: MediaStreamConstraints = {
        video: targetDeviceId
          ? { deviceId: { exact: targetDeviceId } }
          : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        setCameraState("active");
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setCameraState("denied");
      } else {
        setCameraState("unavailable");
      }
    }
  };

  // Auto-reset countdown timer for visual feedback card
  useEffect(() => {
    if (!scanResult && !scanError) return;
    const timer = setInterval(() => {
      setResetCountdown((prev) => {
        if (prev <= 1) {
          setScanResult(null);
          setScanError(null);
          return 4;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [scanResult, scanError]);

  // Clean unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Handle Manual Badge Submission
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
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="rounded-xl border border-red-200 dark:border-red-800/80 bg-red-50/50 dark:bg-red-950/20 p-8 text-center max-w-md mx-auto my-12">
          <ShieldAlert className="h-12 w-12 text-red-600 dark:text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Permission Denied</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            You do not have permission to perform front-desk member check-in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <QrCode className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            Front-Desk Scanner Mode
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Active Branch: <strong className="text-zinc-800 dark:text-zinc-200">{selectedBranch?.name || "Please select branch"}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="text-xs gap-1.5"
            onClick={() => setIsManualModalOpen(true)}
          >
            <UserCheck className="h-4 w-4" /> Member Search Check-In
          </Button>
          <Link href="/dashboard/attendance">
            <Button variant="ghost" className="text-xs text-zinc-600 dark:text-zinc-400">
              Back to Floor
            </Button>
          </Link>
        </div>
      </div>

      <AttendanceNav />

      {/* Tabs: Camera Viewport vs Physical Badge Code */}
      <div className="flex gap-2 mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => {
            setActiveTab("camera");
          }}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            activeTab === "camera"
              ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            activeTab === "passcode"
              ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <CreditCard className="h-3.5 w-3.5" />
          <span>Physical Badge / Passcode</span>
        </button>
      </div>

      {/* Result Visual Card Overlay (Shared for Camera & Badge) */}
      {(scanResult || scanError) && (
        <div className="mb-6 animate-in fade-in-50 zoom-in-95">
          {scanResult && (
            <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-5 shadow-lg">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-lg">
                    {scanResult.member.firstName[0]}
                    {scanResult.member.lastName[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {scanResult.member.firstName} {scanResult.member.lastName}
                      </h2>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                        CHECKED IN
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      ID: <strong className="text-zinc-800 dark:text-zinc-200">{scanResult.member.memberNumber}</strong> • Plan:{" "}
                      <strong className="text-emerald-700 dark:text-emerald-300">{scanResult.membership?.planName || "General Admission"}</strong>
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    Auto-resets in {resetCountdown}s
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setScanResult(null);
                      setScanError(null);
                    }}
                    className="block text-xs h-6 px-2 text-zinc-500 hover:text-zinc-800"
                  >
                    Scan Next Now
                  </Button>
                </div>
              </div>

              {/* Dues Warning if within grace period */}
              {scanResult.duesNotice?.hasDues && (
                <div className="mt-3 rounded-lg bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 p-3 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
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
            <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-5 shadow-lg">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/60 flex items-center justify-center text-red-600 dark:text-red-400 font-bold">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-red-900 dark:text-red-200">
                        Check-In Denied
                      </h2>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200">
                        {scanError.code}
                      </span>
                    </div>
                    <p className="text-xs text-red-800 dark:text-red-300 mt-1 font-medium">
                      {scanError.message}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    Resets in {resetCountdown}s
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setScanResult(null);
                      setScanError(null);
                    }}
                    className="block text-xs h-6 px-2 text-zinc-500 hover:text-zinc-800"
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
        <Card className="border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <CardContent className="p-0">
            <div className="relative bg-zinc-950 flex flex-col items-center justify-center min-h-[380px] sm:min-h-[460px] overflow-hidden">
              {/* Video and Canvas Elements */}
              <video
                ref={videoRef}
                className={`w-full max-h-[500px] object-cover ${
                  cameraState === "active" ? "block" : "hidden"
                }`}
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Viewfinder Overlay with Animated Scan Beam */}
              {cameraState === "active" && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-64 h-64 sm:w-72 sm:h-72 border-2 border-emerald-500/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] overflow-hidden">
                    {/* Corner Accent Markers */}
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                    {/* Animated Scanning Line */}
                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981] animate-bounce" />
                  </div>
                </div>
              )}

              {/* Camera State Messages */}
              {cameraState === "idle" && (
                <div className="p-8 text-center text-zinc-300">
                  <Camera className="h-12 w-12 text-zinc-500 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-zinc-100">Front-Desk Scanner Ready</h3>
                  <p className="text-xs text-zinc-400 max-w-xs mx-auto mt-1 mb-4">
                    Position the browser camera facing the member&apos;s phone or printed gym pass.
                  </p>
                  <Button
                    onClick={() => startCamera(selectedDeviceIndex)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-2"
                  >
                    <Camera className="h-4 w-4" /> Enable Camera Scanner
                  </Button>
                </div>
              )}

              {cameraState === "requesting" && (
                <div className="p-8 text-center text-zinc-300">
                  <Loader2 className="h-10 w-10 text-emerald-500 animate-spin mx-auto mb-3" />
                  <p className="text-xs font-semibold text-zinc-200">
                    Requesting camera access permissions...
                  </p>
                </div>
              )}

              {cameraState === "denied" && (
                <div className="p-8 text-center text-zinc-300 max-w-sm">
                  <CameraOff className="h-10 w-10 text-red-500 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-zinc-100">Camera Permission Blocked</h3>
                  <p className="text-xs text-zinc-400 mt-1 mb-4">
                    Camera access was blocked by your browser settings. Please allow camera permissions in your browser URL bar or use Manual Check-In.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startCamera(selectedDeviceIndex)}
                    className="text-xs"
                  >
                    Retry Permission
                  </Button>
                </div>
              )}

              {cameraState === "unavailable" && (
                <div className="p-8 text-center text-zinc-300 max-w-sm">
                  <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-zinc-100">Camera Not Available</h3>
                  <p className="text-xs text-zinc-400 mt-1 mb-4">
                    No active camera device found, or another application is using it.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startCamera(selectedDeviceIndex)}
                    className="text-xs"
                  >
                    Retry Detection
                  </Button>
                </div>
              )}

              {cameraState === "unsupported" && (
                <div className="p-8 text-center text-zinc-300 max-w-sm">
                  <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-zinc-100">Unsupported Browser Environment</h3>
                  <p className="text-xs text-zinc-400 mt-1 mb-4">
                    Browser camera APIs require HTTPS or localhost. Please switch to a secure connection or use Manual Check-In.
                  </p>
                </div>
              )}

              {/* Submitting indicator */}
              {isSubmitting && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-10">
                  <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 flex items-center gap-3 text-white text-xs">
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                    <span>Verifying check-in credentials...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Camera Controls Bar */}
            <div className="p-3 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-600 dark:text-zinc-400">Camera:</span>
                {videoDevices.length > 1 ? (
                  <select
                    value={selectedDeviceIndex}
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      setSelectedDeviceIndex(idx);
                      startCamera(idx);
                    }}
                    className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
                  >
                    {videoDevices.map((device, idx) => (
                      <option key={device.deviceId || idx} value={idx}>
                        {device.label || `Camera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-zinc-500">
                    {cameraState === "active" ? "Default Camera (Active)" : "Offline"}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {cameraState === "active" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={stopCamera}
                    className="text-xs text-red-600 dark:text-red-400 h-7"
                  >
                    <CameraOff className="h-3.5 w-3.5 mr-1" /> Pause Camera
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startCamera(selectedDeviceIndex)}
                    className="text-xs h-7"
                  >
                    <Camera className="h-3.5 w-3.5 mr-1" /> Start Camera
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Physical Badge Passcode Mode */}
      {activeTab === "passcode" && (
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardContent className="p-6">
            <div className="max-w-md mx-auto text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                <CreditCard className="h-6 w-6" />
              </div>

              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Keypad / Barcode Passcode Check-In
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Enter the 16-character alphanumeric badge passcode printed on the member&apos;s physical pass or scanned via barcode wedge.
                </p>
              </div>

              <form onSubmit={handleBadgeSubmit} className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={manualBadgeCode}
                    onChange={(e) => setManualBadgeCode(e.target.value.toUpperCase())}
                    placeholder="e.g. A7K9-W3X2-M8P4-Q4V6"
                    maxLength={24}
                    className="w-full text-center font-mono tracking-widest text-base py-3 px-4 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  disabled={!manualBadgeCode.trim() || isSubmitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2.5"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-1.5 justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" /> Verifying Passcode...
                    </span>
                  ) : (
                    "Submit Badge Check-In"
                  )}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Search Modal Fallback */}
      <ManualCheckInModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        branch={selectedBranch}
        onSuccess={(res) => {
          setScanResult(res);
          setScanError(null);
          setResetCountdown(4);
        }}
      />
    </div>
  );
}
