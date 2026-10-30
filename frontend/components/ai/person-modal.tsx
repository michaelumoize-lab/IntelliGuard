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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadIcon, InfoIcon, Loader2Icon, Camera, ShieldAlert, Sparkles } from "lucide-react";
import { WebcamCaptureModal } from "@/components/ai/webcam-capture-modal";

export interface PersonModalInitialData {
  id?: number;
  firstName?: string;
  lastName?: string;
  category?: string;
  department?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  status?: string;
  faceImageUrl?: string | null;
}

interface PersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: PersonModalInitialData | null;
}

const DUPLICATE_REGISTRATION_MESSAGE =
  "This face has already been registered. Please check the existing person records before proceeding.";

export function PersonModal({ isOpen, onClose, onSuccess, initialData }: PersonModalProps) {
  const isEditing = Boolean(initialData);

  const [firstName, setFirstName] = useState(initialData?.firstName || "");
  const [lastName, setLastName] = useState(initialData?.lastName || "");
  const [category, setCategory] = useState(initialData?.category || "employee");
  const [status, setStatus] = useState(initialData?.status || "active");
  const [department, setDepartment] = useState(initialData?.department || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [notes, setNotes] = useState(initialData?.notes || "");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.faceImageUrl || null);
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
          "Unable to complete biometric duplicate verification. Registration cannot proceed right now.";
        setPrecheckStatus("error");
        setPrecheckMessage(errMsg);
        toast.error(errMsg);
      }
    } catch {
      if (precheckRequestIdRef.current !== currentRequestId) return;
      const fallbackMsg =
        "Unable to complete biometric duplicate verification. Registration cannot proceed right now.";
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
      if (!isEditing) {
        runQualityPrecheck(file);
      }
    }
  };

  const handleWebcamCapture = (file: File) => {
    setImageFile(file);
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(URL.createObjectURL(file));
    toast.success("Photo captured from webcam!");
    if (!isEditing) {
      runQualityPrecheck(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are required.");
      return;
    }

    if (!isEditing) {
      if (!imageFile) {
        toast.error("A valid face photo is required for registration.");
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
            "Biometric precheck failed. Please provide a valid single-face photo before registering."
        );
        return;
      }
    }

    setIsLoading(true);

    try {
      const trimmedDept = department.trim();
      const trimmedPhone = phone.trim();
      const trimmedEmail = email.trim();
      const trimmedNotes = notes.trim();

      if (isEditing) {
        if (!initialData?.id) {
          throw new Error("Unable to update: Person ID is missing.");
        }
        // Edit Person Metadata
        const res = await fetch(`/api/persons/${initialData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            category,
            status,
            department: trimmedDept || null,
            phone: trimmedPhone || null,
            email: trimmedEmail || null,
            notes: trimmedNotes || null,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || "Failed to update person.");
        }

        toast.success("Person metadata updated successfully!");
        onSuccess();
        onClose();
      } else {
        // Register New Person
        const formData = new FormData();
        formData.append("firstName", firstName.trim());
        formData.append("lastName", lastName.trim());
        formData.append("category", category);
        if (trimmedDept) formData.append("department", trimmedDept);
        if (trimmedPhone) formData.append("phone", trimmedPhone);
        if (trimmedEmail) formData.append("email", trimmedEmail);
        if (trimmedNotes) formData.append("notes", trimmedNotes);
        if (imageFile) {
          formData.append("image", imageFile);
        }

        const res = await fetch("/api/persons", {
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
          throw new Error(data.message || "Registration failed.");
        }

        toast.success(`Person registered successfully! Code: ${data.person.personCode}`);
        onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      console.error("Form error:", err);
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Person Details" : "Register New Person"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update administrative metadata and authorization status. Facial identity remains unchanged."
              : "Register an individual and generate their biometric facial recognition profile."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {!isEditing && (
            <Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20">
              <InfoIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertTitle className="text-blue-900 dark:text-blue-300 font-semibold text-xs">Face Requirements</AlertTitle>
              <AlertDescription className="text-blue-800 dark:text-blue-400 text-xs">
                Exactly <strong>one face</strong> must be clearly visible, front-facing, and well-lit.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. John"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Doe"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="category">Category *</Label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="employee">Employee</option>
                <option value="student">Student</option>
                <option value="visitor">Visitor</option>
                <option value="contractor">Contractor</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Engineering"
              />
            </div>
          </div>

          {isEditing && (
            <div className="space-y-1">
              <Label htmlFor="status">Authorization Status *</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="active">Active (Authorized)</option>
                <option value="inactive">Inactive (Deactivated)</option>
                <option value="suspended">Suspended (Access Revoked)</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john.doe@example.com"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0192"
              />
            </div>
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Face Photo *</Label>
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
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 p-3 border border-dashed border-border rounded-xl bg-muted/20">
                {imagePreview ? (
                  <div className="relative h-24 w-24 rounded-lg overflow-hidden border border-border shrink-0">
                    <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="h-24 w-24 rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 shrink-0">
                    <UploadIcon className="h-6 w-6 mb-1 opacity-60" />
                    <span className="text-[10px]">Upload Photo</span>
                  </div>
                )}

                <div className="flex-1 w-full space-y-1.5 text-center sm:text-left">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="cursor-pointer text-xs bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Upload file or click <strong>Snap with Webcam</strong> to take a live photo.
                  </p>
                </div>
              </div>

              {precheckStatus === "checking" && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-primary/20 bg-primary/5 text-xs text-primary">
                  <Loader2Icon className="h-4 w-4 animate-spin shrink-0" />
                  <span>Running AI biometric quality and duplicate registration check...</span>
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
          )}

          <div className="space-y-1 mb-4">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional security notes or access details..."
              rows={2}
            />
          </div>

          <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading ||
                (!isEditing &&
                  (precheckStatus === "checking" ||
                    precheckStatus === "duplicate" ||
                    precheckStatus === "error"))
              }
              className="w-full sm:w-auto"
            >
              {isLoading ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Updating..." : "Processing AI Embedding..."}
                </>
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Register Person"
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
