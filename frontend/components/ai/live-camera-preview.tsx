"use client";

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from "react";
import {
  RefreshCw,
  AlertCircle,
  VideoOff,
  CameraOff,
  Video,
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
  mirrored?: boolean;
}

export const LiveCameraPreview = forwardRef<LiveCameraPreviewRef, LiveCameraPreviewProps>(
  ({ isCameraOn, onToggleCamera, onCameraStatusChange, mirrored = true }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);
    const [isBackCamera, setIsBackCamera] = useState<boolean>(false);

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
      setIsBackCamera(false);
    }, []);

    // Stop active stream AND invalidate any in-flight startup calls
    const stopStreamTracks = useCallback(() => {
      currentRunIdRef.current++;
      stopTracksOnly();
    }, [stopTracksOnly]);

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

          const track = stream.getVideoTracks()[0];
          const trackFacingMode = track?.getSettings?.()?.facingMode;
          setIsBackCamera(trackFacingMode === "environment");

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

    const activeMirrored = mirrored !== false;

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

          // Frame capture matching mirror configuration
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          context.save();
          if (activeMirrored) {
            context.translate(canvas.width, 0);
            context.scale(-1, 1);
          }
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          context.restore();

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
      <div className="relative w-full aspect-[3/4] sm:aspect-video landscape:aspect-video max-h-[70vh] sm:max-h-none bg-black/95 rounded-2xl overflow-hidden border border-border shadow-md flex flex-col items-center justify-center transition-all duration-300 select-none">
        {/* Hidden Canvas for Frame Extraction */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Standard Normal Zoom Video Element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            transform: activeMirrored ? "scaleX(-1)" : undefined,
            WebkitTransform: activeMirrored ? "scaleX(-1)" : undefined,
          }}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            activeMirrored ? "-scale-x-100" : ""
          } ${
            !isCameraOn || isLoading || error ? "opacity-0" : "opacity-100"
          }`}
        />



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
