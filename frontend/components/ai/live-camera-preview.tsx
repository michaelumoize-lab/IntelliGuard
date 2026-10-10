"use client";

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from "react";
import {
  RefreshCw,
  AlertCircle,
  VideoOff,
  CameraOff,
  Video,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export interface LiveCameraPreviewRef {
  captureFrame: () => Promise<Blob | null>;
}

export interface CameraOverlayResult {
  status: "granted" | "denied" | "ambiguous" | "unknown" | "deactivated";
  name?: string;
  similarity?: number;
}

interface LiveCameraPreviewProps {
  isCameraOn: boolean;
  onToggleCamera: () => void;
  onCameraStatusChange?: (ready: boolean) => void;
  isScanning?: boolean;
  overlayResult?: CameraOverlayResult | null;
  circleOnly?: boolean;
}

export const LiveCameraPreview = forwardRef<LiveCameraPreviewRef, LiveCameraPreviewProps>(
  ({ isCameraOn, onToggleCamera, onCameraStatusChange, isScanning = false, overlayResult = null, circleOnly = false }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);

    // Zoom level state (0.5x to 2.0x). On mobile, default to 0.85x for a wider, uncropped natural view
    const [zoom, setZoom] = useState<number>(() => {
      if (typeof window !== "undefined" && window.innerWidth < 640) {
        return 0.85;
      }
      return 1.0;
    });

    const currentRunIdRef = useRef<number>(0);
    const touchStartDistanceRef = useRef<number | null>(null);
    const touchStartZoomRef = useRef<number>(1.0);

    // Stop active camera stream tracks without invalidating run counter
    const stopTracksOnly = useCallback(() => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }, []);

    // Stop active stream AND invalidate any in-flight startup calls
    const stopStreamTracks = useCallback(() => {
      currentRunIdRef.current++;
      stopTracksOnly();
    }, [stopTracksOnly]);

    // Handle zoom changes (updates CSS transform scale and native hardware track zoom where available)
    const handleZoomChange = (newZoom: number) => {
      const clamped = Math.min(2.0, Math.max(0.5, +newZoom.toFixed(2)));
      setZoom(clamped);

      // Attempt applying hardware track zoom if browser/device supports it
      if (streamRef.current) {
        const videoTrack = streamRef.current.getVideoTracks()[0];
        const caps = videoTrack?.getCapabilities?.() as any;
        if (caps?.zoom && typeof videoTrack?.applyConstraints === "function") {
          const min = caps.zoom.min || 1;
          const max = caps.zoom.max || 2;
          const clampedHw = Math.min(max, Math.max(min, clamped));
          videoTrack.applyConstraints({ advanced: [{ zoom: clampedHw } as any] } as any).catch(() => {});
        }
      }
    };

    // Touch pinch-to-zoom handlers for natural mobile gesture zooming
    const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartDistanceRef.current = dist;
        touchStartZoomRef.current = zoom;
      }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      if (e.touches.length === 2 && touchStartDistanceRef.current !== null) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scaleFactor = dist / touchStartDistanceRef.current;
        const newZoom = Math.min(2.0, Math.max(0.5, +(touchStartZoomRef.current * scaleFactor).toFixed(2)));
        handleZoomChange(newZoom);
      }
    };

    const handleTouchEnd = () => {
      touchStartDistanceRef.current = null;
    };

    // Helper to compute media stream constraints based on device and screen orientation
    const getCameraConstraints = (deviceId?: string): MediaStreamConstraints => {
      const isMobilePortrait =
        typeof window !== "undefined" &&
        (window.innerWidth < 640 || window.matchMedia("(orientation: portrait) and (max-width: 768px)").matches);

      if (isMobilePortrait) {
        // Native portrait mode constraints for mobile phones (3:4 ratio)
        return {
          video: deviceId
            ? {
                deviceId: { ideal: deviceId },
                aspectRatio: { ideal: 3 / 4 },
                width: { ideal: 720 },
                height: { ideal: 1280 },
              }
            : {
                facingMode: "user",
                aspectRatio: { ideal: 3 / 4 },
                width: { ideal: 720 },
                height: { ideal: 1280 },
              },
        };
      }

      // Native landscape mode constraints for larger screens / tablets / desktops (16:9 ratio)
      return {
        video: deviceId
          ? {
              deviceId: { ideal: deviceId },
              aspectRatio: { ideal: 16 / 9 },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : {
              facingMode: "user",
              aspectRatio: { ideal: 16 / 9 },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
      };
    };

    // Initialize camera stream on demand
    const startCamera = useCallback(
      async (deviceId?: string) => {
        stopTracksOnly();
        const runId = ++currentRunIdRef.current;

        setIsLoading(true);
        setError(null);
        setIsPermissionDenied(false);

        try {
          if (!navigator?.mediaDevices?.getUserMedia) {
            throw new Error("Webcam API is not available. Please ensure HTTPS or localhost is used.");
          }

          const constraints = getCameraConstraints(deviceId);
          const stream = await navigator.mediaDevices.getUserMedia(constraints);

          if (runId !== currentRunIdRef.current) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          streamRef.current = stream;

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            try {
              await videoRef.current.play();
            } catch (playErr) {
              console.warn("Video play exception (may require user gesture):", playErr);
            }
          }

          if (runId !== currentRunIdRef.current) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          setIsLoading(false);
          if (onCameraStatusChange) {
            onCameraStatusChange(true);
          }

          if (navigator.mediaDevices.enumerateDevices) {
            try {
              const allDevices = await navigator.mediaDevices.enumerateDevices();
              const videoDevices = allDevices.filter((d) => d.kind === "videoinput");
              setDevices(videoDevices);
            } catch (enumErr) {
              console.warn("Unable to enumerate devices:", enumErr);
            }
          }
        } catch (err: any) {
          if (runId === currentRunIdRef.current) {
            setIsLoading(false);
            if (onCameraStatusChange) {
              onCameraStatusChange(false);
            }

            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
              setIsPermissionDenied(true);
              setError("Camera permission denied. Please allow camera access in browser settings.");
            } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
              setError("No camera device found on your system.");
            } else {
              setError(err.message || "Failed to initialize camera preview.");
            }
          }
        }
      },
      [stopTracksOnly, onCameraStatusChange]
    );

    const handleDeviceSelect = (newDeviceId: string) => {
      setSelectedDeviceId(newDeviceId);
      if (isCameraOn) {
        startCamera(newDeviceId);
      }
    };

    useEffect(() => {
      if (isCameraOn) {
        startCamera(selectedDeviceId || undefined);
      } else {
        stopStreamTracks();
        setIsLoading(false);
        setError(null);
        if (onCameraStatusChange) {
          onCameraStatusChange(false);
        }
      }

      return () => {
        stopStreamTracks();
      };
    }, [isCameraOn, startCamera, stopStreamTracks, onCameraStatusChange, selectedDeviceId]);

    // Dynamically adjust track constraints when rotating mobile device or resizing screen
    useEffect(() => {
      if (!isCameraOn) return;

      const handleOrientationOrResize = () => {
        if (!streamRef.current) return;
        const videoTrack = streamRef.current.getVideoTracks()[0];
        if (!videoTrack || typeof videoTrack.applyConstraints !== "function") return;

        const isMobilePortrait =
          window.innerWidth < 640 || window.matchMedia("(orientation: portrait) and (max-width: 768px)").matches;

        videoTrack
          .applyConstraints(
            isMobilePortrait
              ? {
                  aspectRatio: { ideal: 3 / 4 },
                  width: { ideal: 720 },
                  height: { ideal: 1280 },
                }
              : {
                  aspectRatio: { ideal: 16 / 9 },
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                }
          )
          .catch((err) => {
            console.debug("Could not apply dynamic track orientation constraints:", err);
          });
      };

      const mql = window.matchMedia("(orientation: portrait)");
      mql.addEventListener("change", handleOrientationOrResize);
      window.addEventListener("resize", handleOrientationOrResize);

      return () => {
        mql.removeEventListener("change", handleOrientationOrResize);
        window.removeEventListener("resize", handleOrientationOrResize);
      };
    }, [isCameraOn]);

    useImperativeHandle(ref, () => ({
      captureFrame: () => {
        return new Promise<Blob | null>((resolve) => {
          if (!isCameraOn || !videoRef.current || !canvasRef.current || !streamRef.current) {
            resolve(null);
            return;
          }

          const video = videoRef.current;
          const canvas = canvasRef.current;
          const context = canvas.getContext("2d");

          if (!context || video.videoWidth === 0 || video.videoHeight === 0) {
            resolve(null);
            return;
          }

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          if (zoom > 1.05) {
            // When digitally zoomed in, crop inward from the center
            const cropW = video.videoWidth / zoom;
            const cropH = video.videoHeight / zoom;
            const cropX = (video.videoWidth - cropW) / 2;
            const cropY = (video.videoHeight - cropH) / 2;
            context.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
          } else {
            // When zoom <= 1.0 (standard/wide), draw the full uncropped camera sensor frame
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
          }

          canvas.toBlob(
            (blob) => {
              resolve(blob);
            },
            "image/jpeg",
            0.92
          );
        });
      },
    }));

    return (
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative w-full aspect-[3/4] sm:aspect-video landscape:aspect-video max-h-[70vh] sm:max-h-none bg-black/95 rounded-2xl overflow-hidden border border-border shadow-md flex flex-col items-center justify-center transition-all duration-300 select-none"
      >
        {/* Hidden Canvas for Frame Extraction */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Video Element with Transform Scale Zoom */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center center",
          }}
          className={`w-full h-full object-cover transition-transform duration-150 ease-out ${
            !isCameraOn || isLoading || error ? "opacity-0" : "opacity-100"
          }`}
        />

        {/* Active Biometric Reticle & HUD Overlays */}
        {isCameraOn && !isLoading && !error && (
          circleOnly ? (
            /* Biometric Portrait Face Oval Guide (Anatomical 3:4 egg/oval with Eye & Chin guidelines) */
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center select-none p-4">
              <div className="relative w-52 sm:w-64 md:w-72 h-72 sm:h-84 md:h-92 max-w-[85vw] max-h-[62vh] flex flex-col items-center justify-between">
                {/* Smooth Biometric Head & Face Oval */}
                <div className="w-full h-full rounded-[50%_50%_45%_45%/55%_55%_45%_45%] border-2 border-dashed border-white/80 shadow-[0_0_25px_rgba(255,255,255,0.2)] flex flex-col items-center justify-between py-4 sm:py-5 relative">
                  {/* Top Head Guideline */}
                  <span className="text-[9px] sm:text-[10px] font-mono tracking-wider uppercase bg-black/60 px-2.5 py-0.5 rounded-full text-white/80 border border-white/10">
                    TOP OF HEAD
                  </span>

                  {/* Faint Eye Horizon Level Marker */}
                  <div className="w-4/5 flex items-center justify-between opacity-60 my-auto">
                    <span className="h-0.5 w-3 sm:w-4 bg-white/70 rounded-full" />
                    <span className="text-[8px] sm:text-[9px] font-mono uppercase tracking-widest text-white/70">
                      EYE LEVEL
                    </span>
                    <span className="h-0.5 w-3 sm:w-4 bg-white/70 rounded-full" />
                  </div>

                  {/* Bottom Chin Guideline */}
                  <span className="text-[9px] sm:text-[10px] font-mono tracking-wider uppercase bg-black/60 px-2.5 py-0.5 rounded-full text-white/80 border border-white/10">
                    CHIN
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-5 select-none">
              {/* Top Bar Overlay */}
              <div className="flex items-center justify-between w-full z-10 gap-2">
                <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-white text-[10px] sm:text-xs font-mono font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>TERMINAL ACTIVE</span>
                  <span className="text-white/40 hidden sm:inline">•</span>
                  <span className="text-white/70 hidden sm:inline">30FPS</span>
                </div>

                {/* Status pill if overlayResult */}
                {overlayResult && (
                  <div
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold tracking-wide backdrop-blur-md shadow-lg transition-all animate-in fade-in zoom-in-95 duration-200 border ${
                      overlayResult.status === "granted"
                        ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                        : overlayResult.status === "ambiguous"
                        ? "bg-amber-500/20 border-amber-400 text-amber-300"
                        : overlayResult.status === "deactivated"
                        ? "bg-destructive/30 border-destructive text-destructive-foreground shadow-[0_0_12px_rgba(239,68,68,0.4)]"
                        : "bg-destructive/20 border-destructive text-destructive-foreground"
                    }`}
                  >
                    {overlayResult.status === "granted" ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate max-w-[140px] sm:max-w-none">
                      {overlayResult.status === "granted"
                        ? `MATCH: ${overlayResult.name || "VERIFIED"} (${((overlayResult.similarity || 0) * 100).toFixed(0)}%)`
                        : overlayResult.status === "deactivated"
                        ? `DEACTIVATED: ${overlayResult.name || "ACCESS RESTRICTED"}`
                        : overlayResult.status === "ambiguous"
                        ? "AMBIGUOUS MATCH"
                        : "ACCESS DENIED"}
                    </span>
                  </div>
                )}
              </div>

              {/* Center Biometric Face Target Oval & Crosshairs */}
              <div className="absolute inset-0 flex items-center justify-center">
                {/* Four Corner Brackets around generous biometric portrait oval */}
                <div className="relative w-52 sm:w-64 md:w-72 h-72 sm:h-84 md:h-92 max-w-[85vw] max-h-[62vh] flex items-center justify-center">
                  {/* Top-Left Corner */}
                  <div
                    className={`absolute -top-1 -left-1 w-5 sm:w-6 h-5 sm:h-6 border-t-2 border-l-2 transition-colors duration-300 ${
                      overlayResult?.status === "granted"
                        ? "border-emerald-400 shadow-[0_0_8px_#10b981]"
                        : overlayResult?.status === "denied" || overlayResult?.status === "deactivated"
                        ? "border-destructive shadow-[0_0_8px_#ef4444]"
                        : "border-primary/80"
                    }`}
                  />
                  {/* Top-Right Corner */}
                  <div
                    className={`absolute -top-1 -right-1 w-5 sm:w-6 h-5 sm:h-6 border-t-2 border-r-2 transition-colors duration-300 ${
                      overlayResult?.status === "granted"
                        ? "border-emerald-400 shadow-[0_0_8px_#10b981]"
                        : overlayResult?.status === "denied" || overlayResult?.status === "deactivated"
                        ? "border-destructive shadow-[0_0_8px_#ef4444]"
                        : "border-primary/80"
                    }`}
                  />
                  {/* Bottom-Left Corner */}
                  <div
                    className={`absolute -bottom-1 -left-1 w-5 sm:w-6 h-5 sm:h-6 border-b-2 border-l-2 transition-colors duration-300 ${
                      overlayResult?.status === "granted"
                        ? "border-emerald-400 shadow-[0_0_8px_#10b981]"
                        : overlayResult?.status === "denied" || overlayResult?.status === "deactivated"
                        ? "border-destructive shadow-[0_0_8px_#ef4444]"
                        : "border-primary/80"
                    }`}
                  />
                  {/* Bottom-Right Corner */}
                  <div
                    className={`absolute -bottom-1 -right-1 w-5 sm:w-6 h-5 sm:h-6 border-b-2 border-r-2 transition-colors duration-300 ${
                      overlayResult?.status === "granted"
                        ? "border-emerald-400 shadow-[0_0_8px_#10b981]"
                        : overlayResult?.status === "denied" || overlayResult?.status === "deactivated"
                        ? "border-destructive shadow-[0_0_8px_#ef4444]"
                        : "border-primary/80"
                    }`}
                  />

                  {/* Anatomical Biometric Face Oval Guideline */}
                  <div
                    className={`w-full h-full rounded-[50%_50%_45%_45%/55%_55%_45%_45%] border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-between py-4 ${
                      isScanning
                        ? "border-primary animate-pulse scale-[1.01]"
                        : overlayResult?.status === "granted"
                        ? "border-emerald-400/90 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                        : overlayResult?.status === "denied" || overlayResult?.status === "deactivated"
                        ? "border-destructive/90 bg-destructive/5 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                        : "border-white/40"
                    }`}
                  >
                    {/* Top Marker */}
                    <span className="text-[9px] sm:text-[10px] font-mono tracking-widest uppercase bg-black/60 px-2.5 py-0.5 rounded text-white/70">
                      FOREHEAD
                    </span>

                    {/* Eye Horizon Guideline */}
                    <div className="w-3/4 flex items-center justify-between opacity-50 my-auto">
                      <span className="h-0.5 w-3 bg-white/60 rounded-full" />
                      <span className="text-[8px] font-mono uppercase tracking-widest text-white/60">
                        EYE LINE
                      </span>
                      <span className="h-0.5 w-3 bg-white/60 rounded-full" />
                    </div>

                    {/* Bottom Action Status Pill */}
                    <span className="text-[10px] font-mono tracking-wider uppercase bg-black/70 px-2.5 py-0.5 rounded text-white/90">
                      {isScanning
                        ? "PROCESSING AI INFERENCE..."
                        : overlayResult?.status === "deactivated"
                        ? "USER DEACTIVATED"
                        : overlayResult?.status === "granted"
                        ? "FACE VERIFIED"
                        : overlayResult?.status === "denied"
                        ? "ACCESS DENIED"
                        : "ALIGN FACE"}
                    </span>
                  </div>

                  {/* Animated Laser Scanning Line */}
                  {isScanning && (
                    <div className="absolute inset-x-2 top-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-pulse" />
                  )}
                </div>
              </div>

              {/* Bottom HUD Bar */}
              <div className="flex items-center justify-between w-full text-white/70 text-[9px] sm:text-[10px] font-mono z-10">
                <span className="bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm">
                  InsightFace ArcFace
                </span>
                <span className="bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-cyan-400" /> PGVECTOR 512D
                </span>
              </div>
            </div>
          )
        )}

        {/* Interactive Zoom Control Widget */}
        {isCameraOn && !isLoading && !error && (
          <div className="absolute bottom-10 sm:bottom-12 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-black/75 backdrop-blur-md border border-white/20 rounded-full shadow-lg pointer-events-auto select-none">
            {/* Zoom Out Button */}
            <button
              type="button"
              onClick={() => handleZoomChange(+(zoom - 0.1).toFixed(2))}
              disabled={zoom <= 0.5}
              className="w-6 h-6 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 active:bg-white/20 rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Reduce zoom (Wide view)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1">
              {[
                { label: "0.7x", value: 0.7 },
                { label: "1.0x", value: 1.0 },
                { label: "1.4x", value: 1.4 },
              ].map((preset) => {
                const isActive = Math.abs(zoom - preset.value) < 0.06;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleZoomChange(preset.value)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-primary text-primary-foreground font-bold shadow-xs scale-105"
                        : "text-white/70 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Zoom In Button */}
            <button
              type="button"
              onClick={() => handleZoomChange(+(zoom + 0.1).toFixed(2))}
              disabled={zoom >= 2.0}
              className="w-6 h-6 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 active:bg-white/20 rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Increase zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            {/* Exact Zoom Readout if customized */}
            {![0.7, 1.0, 1.4].some((v) => Math.abs(zoom - v) < 0.06) && (
              <span className="text-[10px] font-mono text-cyan-400 font-semibold pl-1">
                {zoom.toFixed(1)}x
              </span>
            )}
          </div>
        )}

        {/* OFF State Container */}
        {!isCameraOn && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/40 p-4 sm:p-6 text-center gap-3">
            <div className="p-3.5 sm:p-4 bg-muted rounded-full text-muted-foreground border border-border">
              <CameraOff className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Webcam Simulation Powered Off</h4>
              <p className="text-xs text-muted-foreground max-w-xs sm:max-w-sm">
                Click &quot;Turn On Camera&quot; to initialize video feed and test real-time face recognition.
              </p>
            </div>
            <button
              onClick={onToggleCamera}
              className="mt-1 sm:mt-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Video className="w-4 h-4" /> Turn On Camera
            </button>
          </div>
        )}

        {/* Loading Overlay */}
        {isCameraOn && isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm text-muted-foreground gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Initializing camera feed...</p>
          </div>
        )}

        {/* Permission Denied / Error Banner */}
        {isCameraOn && error && (
          <div className="absolute inset-0 p-4 sm:p-6 flex flex-col items-center justify-center text-center bg-background/90 backdrop-blur-md gap-4">
            <div className="p-3 bg-destructive/10 rounded-full border border-destructive/20 text-destructive">
              {isPermissionDenied ? <VideoOff className="w-7 h-7 sm:w-8 sm:h-8" /> : <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8" />}
            </div>
            <div className="max-w-md">
              <h4 className="text-sm sm:text-base font-semibold text-foreground mb-1">
                {isPermissionDenied ? "Camera Access Blocked" : "Camera Error"}
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground">{error}</p>
            </div>
            <button
              onClick={() => startCamera(selectedDeviceId || undefined)}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
          </div>
        )}

        {/* Camera Selector Dropdown */}
        {isCameraOn && devices.length > 1 && !error && !isLoading && (
          <div className="absolute top-2.5 sm:top-4 right-2.5 sm:right-4 z-20 max-w-[130px] sm:max-w-xs pointer-events-auto">
            <select
              value={selectedDeviceId}
              onChange={(e) => handleDeviceSelect(e.target.value)}
              className="w-full bg-black/70 backdrop-blur-md border border-white/20 text-white text-[10px] sm:text-xs rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 focus:outline-none focus:ring-2 focus:ring-primary truncate cursor-pointer"
            >
              {devices.map((device, idx) => (
                <option key={device.deviceId} value={device.deviceId} className="bg-popover text-popover-foreground">
                  {device.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  }
);

LiveCameraPreview.displayName = "LiveCameraPreview";
