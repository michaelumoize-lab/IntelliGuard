"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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

  useEffect(() => {
    if (isOpen) {
      setIsCameraOn(true);
      setCapturedBlob(null);
      setCapturedPreview(null);
      setIsCameraReady(false);
    } else {
      setIsCameraOn(false);
      if (capturedPreview) {
        URL.revokeObjectURL(capturedPreview);
        setCapturedPreview(null);
      }
    }
  }, [isOpen]);

  const handleCapture = async () => {
    if (!cameraRef.current || !isCameraReady) {
      toast.error("Camera feed is not ready yet. Please wait a moment.");
      return;
    }

    setIsCapturing(true);
    try {
      const blob = await cameraRef.current.captureFrame();
      if (!blob) {
        toast.error("Failed to capture frame from webcam.");
        return;
      }

      setCapturedBlob(blob);
      const objectUrl = URL.createObjectURL(blob);
      setCapturedPreview(objectUrl);
      setIsCameraOn(false); // Stop live feed while user evaluates the captured frame
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto border border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Camera className="w-5 h-5 text-primary" />
            Capture Face Photo with Webcam
          </DialogTitle>
          <DialogDescription className="text-xs">
            Look directly into the camera under clear lighting, then click <strong>Capture Photo</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {capturedPreview ? (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border shadow-sm bg-black">
              <img src={capturedPreview} alt="Captured face" className="w-full h-full object-cover" />
              <div className="absolute top-3 left-3 bg-emerald-500/90 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-md">
                <Check className="w-3.5 h-3.5" /> Photo Captured
              </div>
            </div>
          ) : (
            <LiveCameraPreview
              ref={cameraRef}
              isCameraOn={isCameraOn}
              onToggleCamera={() => setIsCameraOn((prev) => !prev)}
              onCameraStatusChange={(ready) => setIsCameraReady(ready)}
            />
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-border pt-4">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
