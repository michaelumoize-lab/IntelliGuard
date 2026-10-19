"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadIcon, InfoIcon, Loader2, UserPlus, ArrowLeft, CheckCircle2, Camera, Sparkles, ShieldAlert, AlertTriangle, Scan, Check } from "lucide-react";
import Link from "next/link";
import { WebcamCaptureModal } from "@/components/ai/webcam-capture-modal";

// Zod Schema Validation
const registerPersonSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters."),
  lastName: z.string().min(2, "Last name must be at least 2 characters."),
  category: z.enum(["employee", "student", "visitor", "contractor"]),
  department: z.string().optional(),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

type RegisterPersonFormValues = z.infer<typeof registerPersonSchema>;

interface PrecheckMatchingPerson {
  personCode: string;
  firstName: string;
  lastName: string;
  status: string;
  similarity: number;
}

interface PrecheckData {
  faceCount: number;
  confidence: number;
  message: string;
  executionTimeMs: number;
  hasLandmarks: boolean;
  matchingPerson?: PrecheckMatchingPerson;
}

const DUPLICATE_REGISTRATION_MESSAGE =
  "This face has already been registered. Please check the existing person records before proceeding.";

export function RegisterPersonForm() {
  const router = useRouter();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isWebcamOpen, setIsWebcamOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [precheckStatus, setPrecheckStatus] = useState<
    "idle" | "checking" | "optimal" | "acceptable" | "warning" | "duplicate" | "error"
  >("idle");
  const [precheckData, setPrecheckData] = useState<PrecheckData | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterPersonFormValues>({
    resolver: zodResolver(registerPersonSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      category: "employee",
      department: "",
      email: "",
      phone: "",
      notes: "",
    },
  });

  React.useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const precheckRequestIdRef = React.useRef(0);

  const runQualityPrecheck = async (file: File) => {
    const currentRequestId = ++precheckRequestIdRef.current;
    setPrecheckStatus("checking");
    setPrecheckData(null);
    setPhotoError(null);
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
        setPrecheckData({
          faceCount: typeof data.faceCount === "number" ? data.faceCount : 1,
          confidence: typeof data.confidence === "number" ? data.confidence : 0,
          message: dupMsg,
          executionTimeMs: data.executionTimeMs || 0,
          hasLandmarks: Boolean(data.hasLandmarks),
          matchingPerson: data.matchingPerson,
        });
        toast.error(dupMsg);
      } else if (res.ok && data.success && data.canProceed !== false) {
        setPrecheckStatus(data.qualityStatus || "optimal");
        setPrecheckData({
          faceCount: data.faceCount,
          confidence: data.confidence,
          message: data.message,
          executionTimeMs: data.executionTimeMs,
          hasLandmarks: data.hasLandmarks,
        });
      } else {
        const errMsg =
          data.message ||
          "Unable to complete biometric duplicate verification. Registration cannot proceed right now.";
        setPrecheckStatus("error");
        setPrecheckData({
          faceCount: typeof data.faceCount === "number" ? data.faceCount : 0,
          confidence: typeof data.confidence === "number" ? data.confidence : 0,
          message: errMsg,
          executionTimeMs: data.executionTimeMs || 0,
          hasLandmarks: Boolean(data.hasLandmarks),
        });
        toast.error(errMsg);
      }
    } catch (err: unknown) {
      if (precheckRequestIdRef.current !== currentRequestId) return;
      console.error("Precheck verification failed:", err);
      const fallbackMsg =
        "Unable to complete biometric duplicate verification. Registration cannot proceed right now.";
      setPrecheckStatus("error");
      setPrecheckData({
        faceCount: 0,
        confidence: 0,
        message: fallbackMsg,
        executionTimeMs: 0,
        hasLandmarks: false,
      });
      toast.error(fallbackMsg);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size exceeds 10MB limit.");
        setPhotoError("File size exceeds 10MB limit.");
        return;
      }
      setPhotoError(null);
      setImageFile(file);
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(URL.createObjectURL(file));
      runQualityPrecheck(file);
    }
  };

  const handleWebcamCapture = (file: File) => {
    setPhotoError(null);
    setImageFile(file);
    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(URL.createObjectURL(file));
    toast.success("Photo captured from webcam!");
    runQualityPrecheck(file);
  };

  const onSubmit = async (values: RegisterPersonFormValues) => {
    if (!imageFile) {
      setPhotoError("A valid face photo is required for AI biometric registration.");
      toast.error("A valid face photo is required.");
      return;
    }

    if (precheckStatus === "checking") {
      toast.error("Please wait for the biometric duplicate and quality check to complete.");
      return;
    }

    if (precheckStatus === "duplicate") {
      const dupMsg = precheckData?.message || DUPLICATE_REGISTRATION_MESSAGE;
      setPhotoError(dupMsg);
      toast.error(dupMsg);
      return;
    }

    if (precheckStatus === "error") {
      const errMsg =
        precheckData?.message ||
        "Biometric precheck failed. Please provide a valid single-face photo before registering.";
      setPhotoError(errMsg);
      toast.error(errMsg);
      return;
    }

    setIsLoading(true);
    setPhotoError(null);

    try {
      const formData = new FormData();
      formData.append("firstName", values.firstName.trim());
      formData.append("lastName", values.lastName.trim());
      formData.append("category", values.category);
      if (values.department) formData.append("department", values.department.trim());
      if (values.email) formData.append("email", values.email.trim());
      if (values.phone) formData.append("phone", values.phone.trim());
      if (values.notes) formData.append("notes", values.notes.trim());
      formData.append("image", imageFile);

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
          setPrecheckData((prev) => ({
            faceCount: prev?.faceCount ?? 1,
            confidence: prev?.confidence ?? 0,
            message: dupMsg,
            executionTimeMs: prev?.executionTimeMs ?? 0,
            hasLandmarks: prev?.hasLandmarks ?? true,
            matchingPerson: data.matchingPerson,
          }));
          setPhotoError(dupMsg);
          toast.error(dupMsg);
          return;
        }
        throw new Error(data.message || "Failed to register person.");
      }

      toast.success(`Registered ${data.person.firstName} ${data.person.lastName}! Code: ${data.person.personCode}`);
      router.push(`/dashboard/persons/${data.person.id}`);
      router.refresh();
    } catch (err: unknown) {
      console.error("Registration error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to register person.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card className="border border-border shadow-sm max-w-3xl mx-auto">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 border border-primary/20 text-primary rounded-xl shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Biometric Identity Enrollment</CardTitle>
                <CardDescription className="text-xs">
                  Register an individual and enroll biometric facial identity for instant recognition.
                </CardDescription>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1.5 w-full sm:w-auto shrink-0">
              <Link href="/dashboard/persons">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Directory
              </Link>
            </Button>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6 pt-6">
            {/* AI Face Requirement Alert */}
            <Alert className="border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300">
              <InfoIcon className="h-4 w-4 text-blue-500 shrink-0" />
              <AlertTitle className="text-xs font-semibold">Face Photo Quality Guidelines</AlertTitle>
              <AlertDescription className="text-xs opacity-90">
                Ensure exactly <strong>one front-facing face</strong> is clearly visible and well-lit. The biometric system automatically detects, aligns, and verifies the identity.
              </AlertDescription>
            </Alert>

            {/* Photo Upload & Webcam Section */}
            <div className="space-y-2">
              <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2">
                <Label className="text-xs font-semibold text-foreground">
                  Face Photo Registration <span className="text-destructive">*</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsWebcamOpen(true)}
                  className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 transition-colors w-full xs:w-auto"
                >
                  <Camera className="w-3.5 h-3.5" /> Snap with Webcam
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border border-dashed border-border rounded-xl bg-muted/20">
                {imagePreview ? (
                  <div className="relative h-28 w-28 rounded-xl overflow-hidden border border-border shrink-0 bg-muted">
                    <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                    <div className="absolute bottom-1 right-1 bg-emerald-500 text-white rounded-full p-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ) : (
                  <div className="h-28 w-28 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground bg-muted/40 shrink-0">
                    <UploadIcon className="h-6 w-6 mb-1 opacity-60" />
                    <span className="text-[10px] font-medium">Select Photo</span>
                  </div>
                )}

                <div className="flex-1 w-full space-y-2 text-center sm:text-left">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="cursor-pointer text-xs bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Upload a clear portrait JPG, PNG, or WEBP image, or click <strong>Snap with Webcam</strong> to take a live photo.
                  </p>
                  {photoError && (
                    <p className="text-xs font-medium text-destructive">{photoError}</p>
                  )}
                </div>
              </div>

              {/* Biometric Face Quality Pre-Check Telemetry */}
              {precheckStatus === "checking" && (
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-primary/20 bg-primary/5 animate-pulse text-xs text-primary font-medium">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold">AI Biometric & Duplicate Pre-Check Running...</p>
                    <p className="text-[11px] text-muted-foreground">
                      Validating facial quality, landmarks, and checking existing registrations for duplicates.
                    </p>
                  </div>
                </div>
              )}

              {precheckStatus !== "idle" && precheckStatus !== "checking" && precheckData && (
                <div
                  className={`p-3.5 rounded-xl border transition-all text-xs space-y-2.5 ${
                    precheckStatus === "optimal"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                      : precheckStatus === "acceptable"
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-950 dark:text-blue-100"
                      : precheckStatus === "duplicate" || precheckStatus === "error"
                      ? "border-destructive/40 bg-destructive/10 text-destructive dark:text-destructive"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {precheckStatus === "optimal" || precheckStatus === "acceptable" ? (
                        <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                      ) : precheckStatus === "duplicate" || precheckStatus === "error" ? (
                        <div className="p-1 rounded-md bg-destructive/20 text-destructive">
                          <ShieldAlert className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="p-1 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <span className="font-semibold text-xs">
                        {precheckStatus === "optimal"
                          ? "Biometric Quality: Optimal"
                          : precheckStatus === "acceptable"
                          ? "Biometric Quality: Acceptable"
                          : precheckStatus === "duplicate"
                          ? "Duplicate Face Detected — Registration Blocked"
                          : precheckStatus === "error"
                          ? "Biometric Pre-Check Failed"
                          : "Biometric Quality Advisory"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                      <Scan className="w-3 h-3" />
                      <span>{precheckData.executionTimeMs}ms</span>
                    </div>
                  </div>

                  <p className="text-[11px] font-medium opacity-95 leading-relaxed">{precheckData.message}</p>

                  {precheckStatus === "duplicate" && precheckData.matchingPerson && (
                    <div className="p-2.5 rounded-lg bg-background/80 border border-destructive/30 text-[11px] text-foreground flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-muted-foreground">Matched Existing Record: </span>
                        <span className="font-semibold">
                          {precheckData.matchingPerson.firstName} {precheckData.matchingPerson.lastName}
                        </span>{" "}
                        <span className="font-mono text-muted-foreground">
                          ({precheckData.matchingPerson.personCode})
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-muted border border-border">
                        Status: {precheckData.matchingPerson.status}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/40 text-[11px]">
                    <div className="bg-background/60 p-2 rounded-lg border border-border/30">
                      <span className="text-[10px] text-muted-foreground block">Faces Found</span>
                      <span className="font-bold flex items-center gap-1 mt-0.5">
                        {precheckData.faceCount === 1 ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                        )}
                        {precheckData.faceCount} face{precheckData.faceCount !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="bg-background/60 p-2 rounded-lg border border-border/30">
                      <span className="text-[10px] text-muted-foreground block">Confidence</span>
                      <span className="font-bold font-mono mt-0.5 block">
                        {precheckData.confidence}%
                      </span>
                    </div>

                    <div className="bg-background/60 p-2 rounded-lg border border-border/30">
                      <span className="text-[10px] text-muted-foreground block">5-Pt Landmarks</span>
                      <span className="font-bold flex items-center gap-1 mt-0.5">
                        {precheckData.hasLandmarks ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>Aligned</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>


          {/* Name Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName" className="text-xs font-medium">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                placeholder="e.g. Michael"
                {...register("firstName", { required: true })}
                className="text-xs"
              />
              {errors.firstName && (
                <p className="text-[11px] text-destructive">{errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lastName" className="text-xs font-medium">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                placeholder="e.g. Umoize"
                {...register("lastName", { required: true })}
                className="text-xs"
              />
              {errors.lastName && (
                <p className="text-[11px] text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          {/* Category & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="category" className="text-xs font-medium">
                Access Category <span className="text-destructive">*</span>
              </Label>
              <select
                id="category"
                {...register("category")}
                className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="employee">Employee</option>
                <option value="student">Student</option>
                <option value="visitor">Visitor</option>
                <option value="contractor">Contractor</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="department" className="text-xs font-medium">
                Department / Team
              </Label>
              <Input
                id="department"
                placeholder="e.g. Engineering & IT"
                {...register("department")}
                className="text-xs"
              />
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="michael@example.com"
                {...register("email")}
                className="text-xs"
              />
              {errors.email && (
                <p className="text-[11px] text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-medium">
                Phone Number
              </Label>
              <Input
                id="phone"
                placeholder="+1 (555) 234-5678"
                {...register("phone")}
                className="text-xs"
              />
            </div>
          </div>

          {/* Security Notes */}
          <div className="space-y-1.5 mb-6">
            <Label htmlFor="notes" className="text-xs font-medium">
              Administrative & Access Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Enter optional security notes, badge numbers, or access privileges..."
              rows={3}
              {...register("notes")}
              className="text-xs"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border pt-4 bg-muted/20">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/persons")}
            disabled={isLoading}
            className="h-9 text-xs w-full sm:w-auto"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={
              isLoading ||
              precheckStatus === "checking" ||
              precheckStatus === "duplicate" ||
              precheckStatus === "error"
            }
            className="h-9 text-xs font-semibold gap-1.5 w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader className="w-3.5 h-3.5 animate-spin" />
                <span>Processing Biometrics...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span>Enroll Person</span>
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>

    <WebcamCaptureModal
      isOpen={isWebcamOpen}
      onClose={() => setIsWebcamOpen(false)}
      onCapture={handleWebcamCapture}
    />
    </>
  );
}

function Loader({ className }: { className?: string }) {
  return <Loader2 className={className} />;
}
