"use client";

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from "react";
import { RefreshCw, AlertCircle, VideoOff, CameraOff, Video, ShieldCheck, ShieldAlert, Sparkles } from "lucide-react";

export interface LiveCameraPreviewRef {
  captureFrame: () => Promise<Blob | null>;
}

export interface CameraOverlayResult {
  status: "granted" | "denied" | "ambiguous" | "unknown";
  name?: string;
  similarity?: number;
}

interface LiveCameraPreviewProps {
  isCameraOn: boolean;
  onToggleCamera: () => void;
  onCameraStatusChange?: (ready: boolean) => void;
  isScanning?: boolean;
  overlayResult?: CameraOverlayResult | null;
}

export const LiveCameraPreview = forwardRef<LiveCameraPreviewRef, LiveCameraPreviewProps>(
  ({ isCameraOn, onToggleCamera, onCameraStatusChange, isScanning = false, overlayResult = null }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);

    const currentRunIdRef = useRef<number>(0);

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

          const constraints: MediaStreamConstraints = {
            video: deviceId
              ? { deviceId: { ideal: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
              : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          };

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
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

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
      <div className="relative w-full aspect-video bg-black/90 rounded-2xl overflow-hidden border border-border shadow-md flex flex-col items-center justify-center">
        {/* Hidden Canvas for Frame Extraction */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Video Element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            !isCameraOn || isLoading || error ? "opacity-0" : "opacity-100"
          }`}
        />

        {/* Active Biometric Reticle & HUD Overlays */}
        {isCameraOn && !isLoading && !error && (
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-5 select-none">
            {/* Top Bar Overlay */}
            <div className="flex items-center justify-between w-full z-10">
              <div className="flex items-center gap-2 px-3 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-white text-[10px] sm:text-xs font-mono font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>TERMINAL ACTIVE</span>
                <span className="text-white/40">•</span>
                <span className="text-white/70">720P 30FPS</span>
              </div>

              {/* Status pill if overlayResult */}
              {overlayResult && (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide backdrop-blur-md shadow-lg transition-all animate-in fade-in zoom-in-95 duration-200 border ${
                    overlayResult.status === "granted"
                      ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                      : overlayResult.status === "ambiguous"
                      ? "bg-amber-500/20 border-amber-400 text-amber-300"
                      : "bg-destructive/20 border-destructive text-destructive-foreground"
                  }`}
                >
                  {overlayResult.status === "granted" ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {overlayResult.status === "granted"
                      ? `MATCH: ${overlayResult.name || "VERIFIED"} (${((overlayResult.similarity || 0) * 100).toFixed(0)}%)`
                      : overlayResult.status === "ambiguous"
                      ? "AMBIGUOUS MATCH"
                      : "ACCESS DENIED"}
                  </span>
                </div>
              )}
            </div>

            {/* Center Biometric Face Target Oval & Crosshairs */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Four Corner Brackets */}
              <div className="relative w-52 sm:w-64 h-64 sm:h-80 max-w-[80vw] max-h-[70vh] flex items-center justify-center">
                {/* Top-Left Corner */}
                <div
                  className={`absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 transition-colors duration-300 ${
                    overlayResult?.status === "granted"
                      ? "border-emerald-400 shadow-[0_0_8px_#10b981]"
                      : overlayResult?.status === "denied"
                      ? "border-destructive shadow-[0_0_8px_#ef4444]"
                      : "border-primary/80"
                  }`}
                />
                {/* Top-Right Corner */}
                <div
                  className={`absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 transition-colors duration-300 ${
                    overlayResult?.status === "granted"
                      ? "border-emerald-400 shadow-[0_0_8px_#10b981]"
                      : overlayResult?.status === "denied"
                      ? "border-destructive shadow-[0_0_8px_#ef4444]"
                      : "border-primary/80"
                  }`}
                />
                {/* Bottom-Left Corner */}
                <div
                  className={`absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 transition-colors duration-300 ${
                    overlayResult?.status === "granted"
                      ? "border-emerald-400 shadow-[0_0_8px_#10b981]"
                      : overlayResult?.status === "denied"
                      ? "border-destructive shadow-[0_0_8px_#ef4444]"
                      : "border-primary/80"
                  }`}
                />
                {/* Bottom-Right Corner */}
                <div
                  className={`absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 transition-colors duration-300 ${
                    overlayResult?.status === "granted"
                      ? "border-emerald-400 shadow-[0_0_8px_#10b981]"
                      : overlayResult?.status === "denied"
                      ? "border-destructive shadow-[0_0_8px_#ef4444]"
                      : "border-primary/80"
                  }`}
                />

                {/* Subtle Biometric Oval Guideline */}
                <div
                  className={`w-full h-full rounded-[45%] border border-dashed transition-all duration-300 flex flex-col items-center justify-end pb-3 ${
                    isScanning
                      ? "border-primary animate-pulse scale-[1.02]"
                      : overlayResult?.status === "granted"
                      ? "border-emerald-400/80 bg-emerald-500/5"
                      : overlayResult?.status === "denied"
                      ? "border-destructive/80 bg-destructive/5"
                      : "border-white/30"
                  }`}
                >
                  <span className="text-[10px] font-mono tracking-widest uppercase bg-black/60 px-2 py-0.5 rounded text-white/80">
                    {isScanning ? "PROCESSING AI INFERENCE..." : "ALIGN FACE"}
                  </span>
                </div>

                {/* Animated Laser Scanning Line */}
                {isScanning && (
                  <div className="absolute inset-x-2 top-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-pulse" />
                )}
              </div>
            </div>

            {/* Bottom HUD Bar */}
            <div className="flex items-center justify-between w-full text-white/70 text-[10px] font-mono z-10">
              <span className="bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm">
                ALGORITHM: InsightFace ArcFace
              </span>
              <span className="bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" /> PGVECTOR 512D
              </span>
            </div>
          </div>
        )}

        {/* OFF State Container */}
        {!isCameraOn && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/40 p-6 text-center gap-3">
            <div className="p-4 bg-muted rounded-full text-muted-foreground border border-border">
              <CameraOff className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Webcam Simulation Powered Off</h4>
              <p className="text-xs text-muted-foreground max-w-sm">
                Click &quot;Turn On Camera&quot; to initialize video feed and test real-time face recognition.
              </p>
            </div>
            <button
              onClick={onToggleCamera}
              className="mt-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2"
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
          <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center bg-background/90 backdrop-blur-md gap-4">
            <div className="p-3 bg-destructive/10 rounded-full border border-destructive/20 text-destructive">
              {isPermissionDenied ? <VideoOff className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
            </div>
            <div className="max-w-md">
              <h4 className="text-base font-semibold text-foreground mb-1">
                {isPermissionDenied ? "Camera Access Blocked" : "Camera Error"}
              </h4>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <button
              onClick={() => startCamera(selectedDeviceId || undefined)}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
          </div>
        )}

        {/* Camera Selector Dropdown */}
        {isCameraOn && devices.length > 1 && !error && !isLoading && (
          <div className="absolute top-2.5 sm:top-4 right-2.5 sm:right-4 z-20 max-w-[150px] sm:max-w-xs pointer-events-auto">
            <select
              value={selectedDeviceId}
              onChange={(e) => handleDeviceSelect(e.target.value)}
              className="w-full bg-black/70 backdrop-blur-md border border-white/20 text-white text-[11px] sm:text-xs rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 focus:outline-none focus:ring-2 focus:ring-primary truncate cursor-pointer"
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
