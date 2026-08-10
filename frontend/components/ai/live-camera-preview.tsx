"use client";

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { RefreshCw, AlertCircle, VideoOff, CameraOff, Video } from "lucide-react";

export interface LiveCameraPreviewRef {
  captureFrame: () => Promise<Blob | null>;
}

interface LiveCameraPreviewProps {
  isCameraOn: boolean;
  onToggleCamera: () => void;
  onCameraStatusChange?: (ready: boolean) => void;
}

export const LiveCameraPreview = forwardRef<LiveCameraPreviewRef, LiveCameraPreviewProps>(
  ({ isCameraOn, onToggleCamera, onCameraStatusChange }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);

    const currentRunIdRef = React.useRef<number>(0);

    // Stop active camera stream tracks safely
    const stopStreamTracks = () => {
      currentRunIdRef.current++;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    // Initialize camera stream on demand
    const startCamera = async (deviceId?: string) => {
      const runId = ++currentRunIdRef.current;
      setIsLoading(true);
      setError(null);
      setIsPermissionDenied(false);
      stopStreamTracks();

      try {
        const constraints: MediaStreamConstraints = {
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
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
          await videoRef.current.play();
        }

        if (runId !== currentRunIdRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        setIsLoading(false);
        setTimeout(() => {
          if (onCameraStatusChange) onCameraStatusChange(true);
        }, 0);

        // Fetch available video input devices
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter((d) => d.kind === "videoinput");
        setDevices(videoDevices);

        const activeTrack = stream.getVideoTracks()[0];
        const activeDeviceId = activeTrack?.getSettings()?.deviceId;
        if (activeDeviceId && (!selectedDeviceId || !deviceId)) {
          setSelectedDeviceId(activeDeviceId);
        }
      } catch (err: any) {
        console.error("Camera access error:", err);
        setIsLoading(false);
        setTimeout(() => {
          if (onCameraStatusChange) onCameraStatusChange(false);
        }, 0);

        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setIsPermissionDenied(true);
          setError("Camera permission denied. Please allow camera access in your browser settings.");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setError("No camera device found on your system.");
        } else {
          setError(err.message || "Failed to initialize camera preview.");
        }
      }
    };

    // Lifecycle effect: only start camera when isCameraOn is true
    useEffect(() => {
      if (isCameraOn) {
        startCamera(selectedDeviceId);
      } else {
        stopStreamTracks();
        setIsLoading(false);
        setError(null);
        setTimeout(() => {
          if (onCameraStatusChange) onCameraStatusChange(false);
        }, 0);
      }

      return () => {
        stopStreamTracks();
      };
    }, [isCameraOn, selectedDeviceId]);

    // Expose captureFrame method to parent via ref
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
      <div className="relative w-full aspect-video bg-card rounded-xl overflow-hidden border border-border shadow-sm flex flex-col items-center justify-center">
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

        {/* OFF State Container */}
        {!isCameraOn && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/40 p-6 text-center gap-3">
            <div className="p-4 bg-muted rounded-full text-muted-foreground border border-border">
              <CameraOff className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Webcam Feed Powered Off</h4>
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
              onClick={() => startCamera(selectedDeviceId)}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
          </div>
        )}

        {/* Camera Selector Badge */}
        {isCameraOn && devices.length > 1 && !error && !isLoading && (
          <div className="absolute top-4 right-4 z-10">
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="bg-background/80 backdrop-blur-md border border-input text-foreground text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {devices.map((device, idx) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Live Indicator */}
        {isCameraOn && !isLoading && !error && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1 bg-background/80 backdrop-blur-md border border-border rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">LIVE FEED</span>
          </div>
        )}
      </div>
    );
  }
);

LiveCameraPreview.displayName = "LiveCameraPreview";
