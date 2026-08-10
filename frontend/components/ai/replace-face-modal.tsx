"use client";

import { useState } from "react";
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
import { UploadIcon, InfoIcon, Loader2Icon, ArrowRightIcon, Camera } from "lucide-react";
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

export function ReplaceFaceModal({ isOpen, onClose, onSuccess, person }: ReplaceFaceModalProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size exceeds 10MB limit.");
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleWebcamCapture = (file: File) => {
    setImageFile(file);
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(URL.createObjectURL(file));
    toast.success("Photo captured from webcam!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageFile) {
      toast.error("Please select a new face photo.");
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
        throw new Error(data.message || "Failed to replace face photo.");
      }

      toast.success(`Face photo replaced for ${person.firstName} ${person.lastName}!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Face replacement error:", err);
      toast.error(err.message || "An unexpected error occurred.");
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
            Updating photo for <strong>{person.firstName} {person.lastName}</strong> ({person.personCode}). This will generate a new 512D ArcFace embedding.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20">
            <InfoIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-900 dark:text-blue-300 font-semibold">Fallback Protection</AlertTitle>
            <AlertDescription className="text-blue-800 dark:text-blue-400 text-xs">
              If AI validation fails, the existing active face embedding and photo remain completely safe.
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
          </div>

          <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !imageFile} className="w-full sm:w-auto">
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
