"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  UploadIcon,
  InfoIcon,
  Loader2Icon,
  ArrowRightIcon,
  Camera,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { WebcamCaptureModal } from "@/components/ai/webcam-capture-modal";

interface ReplaceFaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  person: {
    id: number;
    firstName: string;
    lastName: string;
    personCode: string;
    faceImageUrl?: string | null;
  };
}

const DUPLICATE_REGISTRATION_MESSAGE =
  "This face has already been registered. Please check the existing person records before proceeding.";

export function ReplaceFaceModal({ isOpen, onClose, onSuccess, person }: ReplaceFaceModalProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [precheckStatus, setPrecheckStatus] = useState<
    "idle" | "checking" | "optimal" | "acceptable" | "warning" | "duplicate" | "error"
  >("idle");
  const [precheckMessage, setPrecheckMessage] = useState<string | null>(null);
  const precheckRequestIdRef = useRef(0);

  const runQualityPrecheck = async (file: File) => {
    const currentRequestId = ++precheckRequestIdRef.current;
    setPrecheckStatus("checking");
    setPrecheckMessage(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("excludePersonId", String(person.id));
      const res = await fetch("/api/persons/precheck", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (precheckRequestIdRef.current !== currentRequestId) return;

      if (data.isDuplicate || data.qualityStatus === "duplicate" || res.status === 409) {
        const dupMsg = data.message || DUPLICATE_REGISTRATION_MESSAGE;
        setPrecheckStatus("duplicate");
        setPrecheckMessage(dupMsg);
        toast.error(dupMsg);
      } else if (res.ok && data.success && data.canProceed !== false) {
        setPrecheckStatus(data.qualityStatus || "optimal");
        setPrecheckMessage(data.message || "Verified unique biometric profile.");
      } else {
        const errMsg =
          data.message ||
          "Unable to complete biometric duplicate verification. Face replacement cannot proceed right now.";
        setPrecheckStatus("error");
        setPrecheckMessage(errMsg);
        toast.error(errMsg);
      }
    } catch {
      if (precheckRequestIdRef.current !== currentRequestId) return;
      const fallbackMsg =
        "Unable to complete biometric duplicate verification. Face replacement cannot proceed right now.";
      setPrecheckStatus("error");
      setPrecheckMessage(fallbackMsg);
      toast.error(fallbackMsg);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size exceeds 10MB limit.");
        return;
      }
      setImageFile(file);
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(URL.createObjectURL(file));
      runQualityPrecheck(file);
    }
  };

  const handleWebcamCapture = (file: File) => {
    setImageFile(file);
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(URL.createObjectURL(file));
    toast.success("Photo captured from webcam!");
    runQualityPrecheck(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageFile) {
      toast.error("Please select a new face photo.");
      return;
    }

    if (precheckStatus === "checking") {
      toast.error("Please wait for the biometric duplicate and quality check to complete.");
      return;
    }

    if (precheckStatus === "duplicate") {
      toast.error(precheckMessage || DUPLICATE_REGISTRATION_MESSAGE);
      return;
    }

    if (precheckStatus === "error") {
      toast.error(
        precheckMessage ||
          "Biometric precheck failed. Please provide a valid single-face photo before replacing."
      );
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);

      const res = await fetch(`/api/persons/${person.id}/face`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (
          res.status === 409 ||
          data.isDuplicate ||
          data.error === "DUPLICATE_FACE" ||
          data.error === "DUPLICATE_FACE_DEACTIVATED"
        ) {
          const dupMsg = data.message || DUPLICATE_REGISTRATION_MESSAGE;
          setPrecheckStatus("duplicate");
          setPrecheckMessage(dupMsg);
          toast.error(dupMsg);
          return;
        }
        throw new Error(data.message || "Failed to replace face photo.");
      }

      toast.success(`Face photo replaced for ${person.firstName} ${person.lastName}!`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error("Face replacement error:", err);
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Replace Face Photo</DialogTitle>
          <DialogDescription>
            Updating photo for <strong>{person.firstName} {person.lastName}</strong> ({person.personCode}). This will update the biometric face identity.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20">
            <InfoIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-900 dark:text-blue-300 font-semibold">Fallback Protection</AlertTitle>
            <AlertDescription className="text-blue-800 dark:text-blue-400 text-xs">
              If AI validation or duplicate checking fails, the existing active face embedding and photo remain completely safe.
            </AlertDescription>
          </Alert>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 py-2">
            {/* Old Image */}
            <div className="flex flex-col items-center">
              <Label className="text-xs mb-1 text-muted-foreground">Current Photo</Label>
              <div className="h-24 w-24 rounded-lg overflow-hidden border border-border bg-muted/20">
                {person.faceImageUrl ? (
                  <img src={person.faceImageUrl} alt="Current" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">None</div>
                )}
              </div>
            </div>

            <ArrowRightIcon className="h-5 w-5 text-muted-foreground mt-2 sm:mt-4 rotate-90 sm:rotate-0" />

            {/* New Image Preview */}
            <div className="flex flex-col items-center">
              <Label className="text-xs mb-1 text-muted-foreground">New Photo</Label>
              <div className="h-24 w-24 rounded-lg overflow-hidden border-2 border-dashed border-primary/50 bg-primary/5 flex items-center justify-center">
                {imagePreview ? (
                  <img src={imagePreview} alt="New Preview" className="h-full w-full object-cover" />
                ) : (
                  <UploadIcon className="h-6 w-6 text-muted-foreground opacity-50" />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="newFaceFile" className="text-xs font-semibold">Select New Image *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsWebcamOpen(true)}
                className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              >
                <Camera className="w-3.5 h-3.5" /> Snap with Webcam
              </Button>
            </div>
            <Input
              id="newFaceFile"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="cursor-pointer text-xs bg-background"
            />

            {precheckStatus === "checking" && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-primary/20 bg-primary/5 text-xs text-primary">
                <Loader2Icon className="h-4 w-4 animate-spin shrink-0" />
                <span>Running AI biometric quality and duplicate check...</span>
              </div>
            )}

            {precheckStatus !== "idle" && precheckStatus !== "checking" && precheckMessage && (
              <div
                className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${
                  precheckStatus === "duplicate" || precheckStatus === "error"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                }`}
              >
                {precheckStatus === "duplicate" || precheckStatus === "error" ? (
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <span className="font-medium">{precheckMessage}</span>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading ||
                !imageFile ||
                precheckStatus === "checking" ||
                precheckStatus === "duplicate" ||
                precheckStatus === "error"
              }
              className="w-full sm:w-auto"
            >
              {isLoading ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Generating New Embedding...
                </>
              ) : (
                "Replace & Update Profile"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <WebcamCaptureModal
        isOpen={isWebcamOpen}
        onClose={() => setIsWebcamOpen(false)}
        onCapture={handleWebcamCapture}
      />
    </Dialog>
  );
}
