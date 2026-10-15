"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LiveCameraPreview, LiveCameraPreviewRef } from "@/components/ai/live-camera-preview";
import { Camera, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface WebcamCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function WebcamCaptureModal({ isOpen, onClose, onCapture }: WebcamCaptureModalProps) {
  const cameraRef = useRef<LiveCameraPreviewRef | null>(null);
  const [isCameraOn, setIsCameraOn] = useState<boolean>(true);
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Manage camera lifecycle strictly tied to modal open state
  useEffect(() => {
    if (isOpen) {
      setIsCameraOn(true);
      setCapturedBlob(null);
      setCapturedPreview(null);
      setIsCameraReady(false);
    } else {
      setIsCameraOn(false);
      setIsCameraReady(false);
      if (capturedPreview) {
        URL.revokeObjectURL(capturedPreview);
        setCapturedPreview(null);
      }
      setCapturedBlob(null);
    }

    return () => {
      setIsCameraOn(false);
    };
  }, [isOpen]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (capturedPreview && capturedPreview.startsWith("blob:")) {
        URL.revokeObjectURL(capturedPreview);
      }
    };
  }, [capturedPreview]);

  // Stable callback for status changes to prevent camera recreation cycles
  const handleCameraStatusChange = useCallback((ready: boolean) => {
    setIsCameraReady(ready);
  }, []);

  const handleCapture = async () => {
    if (!cameraRef.current || !isCameraReady) {
      toast.error("Camera feed is not ready yet. Please wait a moment.");
      return;
    }

    setIsCapturing(true);
    try {
      const blob = await cameraRef.current.captureFrame({ aspectRatio: 3 / 4 });
      if (!blob) {
        toast.error("Failed to capture frame from webcam. Please try again.");
        return;
      }

      setCapturedBlob(blob);
      const objectUrl = URL.createObjectURL(blob);
      setCapturedPreview(objectUrl);
      setIsCameraOn(false); // Suspend live stream while user reviews the snapshot
    } catch (err) {
      console.error("Frame capture error:", err);
      toast.error("An error occurred while capturing photo.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
      setCapturedPreview(null);
    }
    setCapturedBlob(null);
    setIsCameraReady(false);
    setIsCameraOn(true);
  };

  const handleConfirm = () => {
    if (!capturedBlob) return;
    const filename = `webcam_enrollment_${Date.now()}.jpg`;
    const file = new File([capturedBlob], filename, { type: "image/jpeg" });
    onCapture(file);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[540px] md:max-w-[580px] w-full p-0 overflow-hidden rounded-2xl border border-border max-h-[94vh] flex flex-col gap-0 bg-card shadow-2xl">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 pb-3 border-b border-border bg-card pr-12 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Camera className="w-5 h-5 text-primary" />
            Capture Face Photo
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Center your face inside the portrait guide, then click <strong>Capture Photo</strong>.
          </DialogDescription>
        </div>

        {/* Camera Viewport Body */}
        <div className="p-3 sm:p-4 flex-1 min-h-0 flex items-center justify-center bg-muted/20 overflow-hidden">
          {capturedPreview ? (
            <div className="relative h-full max-h-[58vh] aspect-[3/4] rounded-2xl overflow-hidden border border-border shadow-md bg-black">
              {/*
                Captured Snapshot Display
                Matches the mirrored portrait orientation of the live camera feed
              */}
              <img src={capturedPreview} alt="Captured face" className="w-full h-full object-cover" />
              <div className="absolute top-3 left-3 bg-emerald-500/90 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-md">
                <Check className="w-3.5 h-3.5" /> Photo Captured
              </div>
            </div>
          ) : (
            <div className="h-full max-h-[58vh] aspect-[3/4] flex items-center justify-center">
              <LiveCameraPreview
                ref={cameraRef}
                isCameraOn={isCameraOn}
                onToggleCamera={() => setIsCameraOn((prev) => !prev)}
                onCameraStatusChange={handleCameraStatusChange}
                circleOnly={false}
                mirrored={true}
                showHud={false}
                className="w-full h-full aspect-[3/4] max-h-[58vh]"
              />
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-3.5 sm:p-4 bg-card border-t border-border shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs w-full sm:w-auto">
            Cancel
          </Button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {capturedPreview ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={handleRetake} className="text-xs gap-1.5 w-full sm:w-auto">
                  <RefreshCw className="w-3.5 h-3.5" /> Retake Photo
                </Button>
                <Button type="button" size="sm" onClick={handleConfirm} className="text-xs gap-1.5 bg-primary text-primary-foreground w-full sm:w-auto">
                  <Check className="w-3.5 h-3.5" /> Use Photo
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleCapture}
                disabled={!isCameraOn || !isCameraReady || isCapturing}
                className="text-xs gap-1.5 bg-primary text-primary-foreground w-full sm:w-auto"
              >
                {isCapturing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Capturing...
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" /> Capture Photo
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
