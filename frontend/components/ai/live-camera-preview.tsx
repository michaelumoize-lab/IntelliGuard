"use client";

import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from "react";
import {
  RefreshCw,
  AlertCircle,
  VideoOff,
  CameraOff,
  Video,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  HelpCircle,
} from "lucide-react";
import { useWebcam } from "@/hooks/use-webcam";
import { cn } from "@/lib/utils";

export interface LiveCameraPreviewRef {
  captureFrame: (options?: { mirror?: boolean; aspectRatio?: number }) => Promise<Blob | null>;
  getVideoElement: () => HTMLVideoElement | null;
}

export interface CameraOverlayResult {
  status: "granted" | "denied" | "ambiguous" | "unknown" | "deactivated";
  name?: string;
  similarity?: number;
}

export interface DetectedFaceOverlay {
  bbox: number[]; // [x1, y1, x2, y2]
  confidence: number;
  landmarks?: number[][]; // [[x, y], ...]
}

export interface LiveCameraPreviewProps {
  isCameraOn: boolean;
  onToggleCamera: () => void;
  onCameraStatusChange?: (ready: boolean) => void;
  isScanning?: boolean;
  overlayResult?: CameraOverlayResult | null;
  circleOnly?: boolean;
  mirrored?: boolean;
  detectedFaces?: DetectedFaceOverlay[];
  showHud?: boolean;
  className?: string;
}

export const LiveCameraPreview = forwardRef<LiveCameraPreviewRef, LiveCameraPreviewProps>(
  (
    {
      isCameraOn,
      onToggleCamera,
      onCameraStatusChange,
      isScanning = false,
      overlayResult = null,
      circleOnly = false,
      mirrored = true,
      detectedFaces = [],
      showHud = true,
      className,
    },
    ref
  ) => {
    // Stable callback ref for camera status notification
    const onStatusChangeRef = useRef(onCameraStatusChange);
    useEffect(() => {
      onStatusChangeRef.current = onCameraStatusChange;
    }, [onCameraStatusChange]);

    const handleWebcamStatusChange = useCallback((ready: boolean) => {
      if (onStatusChangeRef.current) {
        onStatusChangeRef.current(ready);
      }
    }, []);

    const {
      videoRef,
      canvasRef,
      isCameraReady,
      isLoading,
      isError,
      errorMessage,
      isPermissionDenied,
      devices,
      selectedDeviceId,
      currentFacingMode,
      startCamera,
      stopCamera,
      selectDevice,
      captureFrame,
    } = useWebcam({
      mirrored,
      autoStart: isCameraOn,
      onStatusChange: handleWebcamStatusChange,
    });

    // Synchronize parent `isCameraOn` control with webcam hook
    const prevIsCameraOnRef = useRef<boolean>(isCameraOn);
    useEffect(() => {
      if (isCameraOn && !prevIsCameraOnRef.current) {
        startCamera(selectedDeviceId || undefined);
      } else if (!isCameraOn && prevIsCameraOnRef.current) {
        stopCamera();
      }
      prevIsCameraOnRef.current = isCameraOn;
    }, [isCameraOn, startCamera, stopCamera, selectedDeviceId]);

    // Determine if video should be horizontally mirrored (selfie mode)
    const shouldMirror = mirrored && currentFacingMode === "user";

    // Expose captureFrame and video element to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        captureFrame: (opts) =>
          captureFrame({
            mirror: opts?.mirror ?? shouldMirror,
            aspectRatio: opts?.aspectRatio ?? (3 / 4),
          }),
        getVideoElement: () => videoRef.current,
      }),
      [captureFrame, shouldMirror, videoRef]
    );

    // Reticle corner highlight classes based on access evaluation result
    const getCornerBorderClass = () => {
      if (overlayResult?.status === "granted") {
        return "border-emerald-400 shadow-[0_0_12px_#10b981]";
      }
      if (overlayResult?.status === "denied" || overlayResult?.status === "deactivated") {
        return "border-destructive shadow-[0_0_12px_#ef4444]";
      }
      if (overlayResult?.status === "ambiguous") {
        return "border-amber-400 shadow-[0_0_12px_#f59e0b]";
      }
      if (isScanning) {
        return "border-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]";
      }
      return "border-white/60";
    };

    const cornerBorder = getCornerBorderClass();

    return (
      <div
        className={cn(
          "relative w-full aspect-[3/4] max-h-[72vh] bg-black/95 rounded-2xl overflow-hidden border border-border shadow-md flex flex-col items-center justify-center transition-all duration-300 select-none",
          className
        )}
      >
        {/* Hidden Canvas for Frame Capture Extraction */}
        <canvas ref={canvasRef} className="hidden" />

        {/*
          Live Video Element
          Mirrored horizontally on user-facing selfie camera via inline transform ONLY.
        */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            transform: shouldMirror ? "scaleX(-1)" : "none",
          }}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            !isCameraOn || isLoading || isError ? "opacity-0" : "opacity-100"
          }`}
        />

        {/* AI Bounding Boxes & Facial Landmarks Overlay */}
        {isCameraOn && isCameraReady && detectedFaces.length > 0 && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {detectedFaces.map((face, index) => {
              if (!face.bbox || face.bbox.length < 4) return null;
              const [x1, y1, x2, y2] = face.bbox;
              const video = videoRef.current;
              const vidW = video?.videoWidth || 720;
              const vidH = video?.videoHeight || 960;

              // Compute object-cover visible bounds relative to 3:4 portrait container
              const containerAspect = 3 / 4;
              const videoAspect = vidW / vidH;

              let visibleW = vidW;
              let visibleH = vidH;
              let cropX = 0;
              let cropY = 0;

              if (videoAspect > containerAspect) {
                visibleW = vidH * containerAspect;
                cropX = (vidW - visibleW) / 2;
              } else {
                visibleH = vidW / containerAspect;
                cropY = (vidH - visibleH) / 2;
              }

              const leftPct = ((x1 - cropX) / visibleW) * 100;
              const topPct = ((y1 - cropY) / visibleH) * 100;
              const widthPct = ((x2 - x1) / visibleW) * 100;
              const heightPct = ((y2 - y1) / visibleH) * 100;

              const finalLeftPct = shouldMirror ? 100 - leftPct - widthPct : leftPct;

              return (
                <div
                  key={`face-box-${index}`}
                  style={{
                    left: `${finalLeftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                  }}
                  className="absolute border-2 border-emerald-400/90 rounded-lg shadow-[0_0_12px_rgba(16,185,129,0.5)] transition-all duration-150"
                >
                  <div className="absolute -top-5 left-0 bg-emerald-500 text-black text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow">
                    FACE {(face.confidence * 100).toFixed(0)}%
                  </div>

                  {/* 5 Facial Landmarks (Eyes, Nose, Mouth corners) */}
                  {face.landmarks &&
                    face.landmarks.map((pt, pIdx) => {
                      if (!pt || pt.length < 2) return null;
                      const rawPtX = ((pt[0] - x1) / (x2 - x1)) * 100;
                      const ptX = shouldMirror ? 100 - rawPtX : rawPtX;
                      const ptY = ((pt[1] - y1) / (y2 - y1)) * 100;
                      return (
                        <div
                          key={`lm-${pIdx}`}
                          style={{ left: `${ptX}%`, top: `${ptY}%` }}
                          className="absolute w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]"
                        />
                      );
                    })}
                </div>
              );
            })}
          </div>
        )}

        {/* Biometric Guide & Terminal Simulation HUD Reticle */}
        {isCameraOn && isCameraReady && !isLoading && !isError && showHud && (
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-5 select-none">
            {/* Top HUD Bar: Decision / Status Banner */}
            <div className="flex items-center justify-between w-full z-10">
              {overlayResult ? (
                <div
                  className={`px-3 py-1.5 rounded-full border backdrop-blur-md text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-all animate-in fade-in zoom-in-95 duration-200 ${
                    overlayResult.status === "granted"
                      ? "bg-emerald-500/25 border-emerald-400/60 text-emerald-200 shadow-emerald-500/20"
                      : overlayResult.status === "deactivated"
                      ? "bg-destructive/30 border-destructive/60 text-destructive-foreground shadow-destructive/20"
                      : overlayResult.status === "ambiguous"
                      ? "bg-amber-500/25 border-amber-400/60 text-amber-200 shadow-amber-500/20"
                      : overlayResult.status === "unknown"
                      ? "bg-neutral-800/80 border-neutral-600 text-neutral-200"
                      : "bg-destructive/25 border-destructive/60 text-destructive-foreground shadow-destructive/20"
                  }`}
                >
                  {overlayResult.status === "granted" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {overlayResult.status === "deactivated" && <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />}
                  {overlayResult.status === "ambiguous" && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                  {overlayResult.status === "unknown" && <HelpCircle className="w-4 h-4 text-neutral-300 shrink-0" />}
                  {overlayResult.status === "denied" && <XCircle className="w-4 h-4 text-destructive shrink-0" />}

                  <span className="font-medium tracking-wide">
                    {overlayResult.status === "granted"
                      ? `GRANTED: ${overlayResult.name || "Access Allowed"}`
                      : overlayResult.status === "deactivated"
                      ? overlayResult.name || "USER DEACTIVATED"
                      : overlayResult.status === "ambiguous"
                      ? "AMBIGUOUS MATCH"
                      : overlayResult.status === "unknown"
                      ? "UNKNOWN FACE"
                      : "ACCESS DENIED"}
                  </span>

                  {overlayResult.similarity !== undefined && (
                    <span className="ml-1 text-[10px] font-mono opacity-80 border-l border-white/20 pl-1.5">
                      {(overlayResult.similarity * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              ) : isScanning ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-950/80 backdrop-blur-md border border-cyan-500/40 text-cyan-200 text-[10px] font-mono">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>AI SCANNING ACTIVE</span>
                </div>
              ) : (
                <div />
              )}
            </div>

            {/* Center Biometric Face Reticle */}
            <div className="flex-1 flex items-center justify-center relative py-2">
              <div
                className={`relative ${
                  circleOnly
                    ? "w-[68%] h-[82%] max-w-[240px] max-h-[300px]"
                    : "w-52 sm:w-64 md:w-72 h-68 sm:h-80 md:h-88 max-w-[85vw] max-h-[60vh]"
                } flex flex-col items-center justify-between transition-all duration-300`}
              >
                {!circleOnly && (
                  <>
                    {/* Top-Left Corner */}
                    <div className={`absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 transition-colors duration-300 ${cornerBorder}`} />
                    {/* Top-Right Corner */}
                    <div className={`absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 transition-colors duration-300 ${cornerBorder}`} />
                    {/* Bottom-Left Corner */}
                    <div className={`absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 transition-colors duration-300 ${cornerBorder}`} />
                    {/* Bottom-Right Corner */}
                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 transition-colors duration-300 ${cornerBorder}`} />
                  </>
                )}

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
                  <span className="text-[9px] sm:text-[10px] font-mono tracking-widest uppercase bg-black/60 px-2.5 py-0.5 rounded text-white/80 border border-white/10">
                    FOREHEAD
                  </span>

                  {/* Eye Horizon Guideline */}
                  <div className="w-3/4 flex items-center justify-between opacity-60 my-auto">
                    <span className="h-0.5 w-3 bg-white/70 rounded-full" />
                    <span className="text-[8px] font-mono uppercase tracking-widest text-white/70">
                      EYE LINE
                    </span>
                    <span className="h-0.5 w-3 bg-white/70 rounded-full" />
                  </div>

                  {/* Bottom Action Status Pill */}
                  <span className="text-[10px] font-mono tracking-wider uppercase bg-black/75 px-3 py-0.5 rounded-full text-white/90 border border-white/10">
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
        {isCameraOn && isError && (
          <div className="absolute inset-0 p-4 sm:p-6 flex flex-col items-center justify-center text-center bg-background/90 backdrop-blur-md gap-4">
            <div className="p-3 bg-destructive/10 rounded-full border border-destructive/20 text-destructive">
              {isPermissionDenied ? <VideoOff className="w-7 h-7 sm:w-8 sm:h-8" /> : <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8" />}
            </div>
            <div className="max-w-md">
              <h4 className="text-sm sm:text-base font-semibold text-foreground mb-1">
                {isPermissionDenied ? "Camera Access Blocked" : "Camera Error"}
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground">{errorMessage}</p>
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
        {isCameraOn && devices.length > 1 && !isError && !isLoading && (
          <div className="absolute top-2.5 sm:top-4 right-2.5 sm:right-4 z-20 max-w-[130px] sm:max-w-xs pointer-events-auto">
            <select
              value={selectedDeviceId}
              onChange={(e) => selectDevice(e.target.value)}
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
