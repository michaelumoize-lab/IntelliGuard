"use client";

import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from "react";
import {
  RefreshCw,
  AlertCircle,
  VideoOff,
  CameraOff,
  Video,
  Clock,
  Power,
} from "lucide-react";
import { useWebcam } from "@/hooks/use-webcam";
import { cn } from "@/lib/utils";

export interface LiveCameraPreviewRef {
  captureFrame: (options?: { mirror?: boolean; aspectRatio?: number }) => Promise<Blob | null>;
  getVideoElement: () => HTMLVideoElement | null;
}

export interface CameraOverlayResult {
  status:
    | "granted"
    | "denied"
    | "ambiguous"
    | "unknown"
    | "deactivated"
    | "no_person"
    | "person_no_face"
    | "face_low_quality"
    | "processing"
    | "error"
    | "spoof_detected"
    | "liveness_inconclusive";
  name?: string;
  similarity?: number;
  message?: string;
}

export interface DetectedPersonOverlay {
  bbox: number[]; // [x1, y1, x2, y2]
  confidence: number;
  isPrimary?: boolean;
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
  detectedPersons?: DetectedPersonOverlay[];
  detectedFaces?: DetectedFaceOverlay[];
  imageDimensions?: { width: number; height: number } | null;
  showHud?: boolean;
  className?: string;
  isPausedDueToInactivity?: boolean;
  onResumeCamera?: () => void;
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
      detectedPersons = [],
      detectedFaces = [],
      imageDimensions = null,
      showHud = true,
      className,
      isPausedDueToInactivity = false,
      onResumeCamera,
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

    // Reticle corner highlight classes based on scanning state
    const getCornerBorderClass = () => {
      if (isScanning || overlayResult?.status === "processing") {
        return "border-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]";
      }
      return "border-white/60";
    };

    const cornerBorder = getCornerBorderClass();

    return (
      <div
        className={cn(
          "relative w-full aspect-[3/4] max-h-[62dvh] sm:max-h-[70dvh] lg:max-h-[74dvh] bg-black/95 rounded-2xl overflow-hidden border border-border shadow-md flex flex-col items-center justify-center transition-all duration-300 select-none",
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

        {/* AI Person Bounding Boxes (YOLO Layer) */}
        {isCameraOn && isCameraReady && detectedPersons.length > 0 && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-150">
            {detectedPersons.map((person, index) => {
              if (!person.bbox || person.bbox.length < 4) return null;
              const [x1, y1, x2, y2] = person.bbox;
              const video = videoRef.current;
              const vidW = imageDimensions?.width || video?.videoWidth || 720;
              const vidH = imageDimensions?.height || video?.videoHeight || 960;

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

              const finalLeftPct = leftPct;

              return (
                <div
                  key={`person-box-${index}`}
                  style={{
                    left: `${finalLeftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                  }}
                  className={`absolute border-2 rounded-xl transition-all duration-150 ${
                    person.isPrimary
                      ? "border-cyan-400/80 shadow-[0_0_12px_rgba(34,211,238,0.4)]"
                      : "border-cyan-500/40 shadow-[0_0_6px_rgba(34,211,238,0.2)]"
                  }`}
                >
                  <div className="absolute -top-5 left-0 bg-cyan-600 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1">
                    <span>PERSON {(person.confidence * 100).toFixed(0)}%</span>
                    {person.isPrimary && <span className="opacity-75 text-[8px]">• PRIMARY</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* AI Face Bounding Boxes & Facial Landmarks Overlay (InsightFace Layer) */}
        {isCameraOn && isCameraReady && detectedFaces.length > 0 && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-150">
            {detectedFaces.map((face, index) => {
              if (!face.bbox || face.bbox.length < 4) return null;
              const [x1, y1, x2, y2] = face.bbox;
              const video = videoRef.current;
              const vidW = imageDimensions?.width || video?.videoWidth || 720;
              const vidH = imageDimensions?.height || video?.videoHeight || 960;

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

              const finalLeftPct = leftPct;

              const faceBoxColor =
                overlayResult?.status === "granted"
                  ? "border-emerald-400/90 shadow-[0_0_12px_rgba(16,185,129,0.5)] bg-emerald-500/5"
                  : overlayResult?.status === "unknown"
                  ? "border-rose-500/90 shadow-[0_0_12px_rgba(244,63,94,0.5)] bg-rose-500/5"
                  : overlayResult?.status === "ambiguous" || overlayResult?.status === "face_low_quality"
                  ? "border-amber-400/90 shadow-[0_0_12px_rgba(245,158,11,0.5)] bg-amber-500/5"
                  : "border-emerald-400/90 shadow-[0_0_12px_rgba(16,185,129,0.5)]";

              const badgeColor =
                overlayResult?.status === "unknown"
                  ? "bg-rose-600 text-white"
                  : overlayResult?.status === "ambiguous" || overlayResult?.status === "face_low_quality"
                  ? "bg-amber-600 text-white"
                  : "bg-emerald-500 text-black";

              return (
                <div
                  key={`face-box-${index}`}
                  style={{
                    left: `${finalLeftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                  }}
                  className={`absolute border-2 rounded-lg transition-all duration-150 ${faceBoxColor}`}
                >
                  <div className={`absolute -top-5 left-0 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow ${badgeColor}`}>
                    FACE {(face.confidence * 100).toFixed(0)}%
                  </div>

                  {/* 5 Facial Landmarks (Eyes, Nose, horizontal alignment) */}
                  {face.landmarks &&
                    face.landmarks.map((pt, pIdx) => {
                      if (!pt || pt.length < 2) return null;
                      const rawPtX = ((pt[0] - x1) / (x2 - x1)) * 100;
                      const ptX = rawPtX;
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
            {/* Top HUD Bar: Live Camera / Scanning Status */}
            <div className="flex items-center justify-between w-full z-10 gap-2">
              {isScanning || overlayResult?.status === "processing" ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/80 backdrop-blur-md border border-cyan-500/40 text-cyan-200 text-[10px] font-mono shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping motion-reduce:animate-none" />
                  <span>AI SCANNING ACTIVE</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white/80 text-[10px] font-mono shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse motion-reduce:animate-none" />
                  <span>FEED ACTIVE</span>
                </div>
              )}
            </div>

            {/* Center Biometric Face Reticle */}
            <div className="flex-1 flex items-center justify-center relative py-2">
              <div
                className={`relative ${
                  circleOnly
                    ? "w-[68%] h-[82%] max-w-[240px] max-h-[300px]"
                    : "w-48 sm:w-60 md:w-68 h-60 sm:h-72 md:h-80 max-w-[85vw] max-h-[56vh]"
                } flex flex-col items-center justify-between transition-all duration-300`}
              >
                {!circleOnly && (
                  <>
                    {/* Top-Left Corner */}
                    <div className={`absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 rounded-tl transition-all duration-300 ${cornerBorder}`} />
                    {/* Top-Right Corner */}
                    <div className={`absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 rounded-tr transition-all duration-300 ${cornerBorder}`} />
                    {/* Bottom-Left Corner */}
                    <div className={`absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 rounded-bl transition-all duration-300 ${cornerBorder}`} />
                    {/* Bottom-Right Corner */}
                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 rounded-br transition-all duration-300 ${cornerBorder}`} />
                  </>
                )}

                {/* Minimalist Biometric Face Oval Guideline */}
                <div
                  className={`w-full h-full rounded-[48%_48%_44%_44%/52%_52%_44%_44%] border transition-all duration-300 flex flex-col items-center justify-between py-4 relative overflow-hidden ${
                    isScanning || overlayResult?.status === "processing"
                      ? "border-cyan-400 bg-cyan-500/5 shadow-[0_0_20px_rgba(34,211,238,0.25)] scale-[1.01]"
                      : "border-white/20 hover:border-white/30"
                  }`}
                >
                  {/* Subtle Horizon Alignment Ticks */}
                  <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex items-center justify-between pointer-events-none opacity-40">
                    <span className="h-0.5 w-3 bg-white rounded-full" />
                    <span className="h-0.5 w-3 bg-white rounded-full" />
                  </div>

                  {/* Top Minimal Alignment Indicator */}
                  <div className="w-1.5 h-1.5 rounded-full bg-white/40" />

                  {/* Bottom Action Status Pill */}
                  <div className="px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-[10px] font-mono tracking-wider uppercase text-white/90 flex items-center gap-1.5 shadow-md">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isScanning || overlayResult?.status === "processing"
                          ? "bg-cyan-400 animate-ping motion-reduce:animate-none"
                          : "bg-white/60"
                      }`}
                    />
                    <span>
                      {isScanning || overlayResult?.status === "processing"
                        ? "SCANNING BIOMETRICS..."
                        : "POSITION FACE IN OVAL"}
                    </span>
                  </div>

                  {/* Animated Laser Scanning Beam */}
                  {(isScanning || overlayResult?.status === "processing") && (
                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_16px_#22d3ee] animate-pulse motion-reduce:animate-none top-1/2 -translate-y-1/2" />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inactivity Pause Overlay (30s Timeout Shutdown) */}
        {!isCameraOn && isPausedDueToInactivity && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-card/95 via-card/85 to-background/95 p-6 text-center gap-4 select-none backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
              <Clock className="w-8 h-8 opacity-90 animate-pulse" />
            </div>
            <div className="space-y-1.5 max-w-xs">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-[10px] font-mono uppercase tracking-wider text-amber-500 border border-amber-500/20 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                <span>ENERGY SAVER ACTIVE</span>
              </div>
              <h4 className="text-sm font-semibold text-foreground tracking-tight">Camera Paused (30s Inactivity)</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Camera paused due to 30s inactivity. Click to resume.
              </p>
            </div>
            <button
              type="button"
              onClick={onResumeCamera ?? onToggleCamera}
              className="mt-1 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer hover:shadow-primary/20 active:scale-[0.98]"
            >
              <Power className="w-4 h-4" />
              <span>Wake / Resume Camera</span>
            </button>
          </div>
        )}

        {/* OFF State Container (Modern Terminal Standby) */}
        {!isCameraOn && !isPausedDueToInactivity && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-card/90 via-card/60 to-background/95 p-6 text-center gap-4 select-none">
            <div className="w-16 h-16 rounded-2xl bg-muted/60 border border-border/80 flex items-center justify-center text-muted-foreground shadow-inner">
              <CameraOff className="w-8 h-8 opacity-75" />
            </div>
            <div className="space-y-1 max-w-xs">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted/80 text-[10px] font-mono uppercase tracking-wider text-muted-foreground border border-border/60 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                <span>TERMINAL STANDBY</span>
              </div>
              <h4 className="text-sm font-semibold text-foreground tracking-tight">Camera Feed Disconnected</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Activate the webcam to start real-time human detection and facial verification.
              </p>
            </div>
            <button
              onClick={onToggleCamera}
              className="mt-1 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer hover:shadow-primary/20 active:scale-[0.98]"
            >
              <Video className="w-4 h-4" />
              <span>Turn On Camera</span>
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
