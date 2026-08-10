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
import { UploadIcon, InfoIcon, Loader2, UserPlus, ArrowLeft, CheckCircle2, Camera } from "lucide-react";
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

export function RegisterPersonForm() {
  const router = useRouter();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isWebcamOpen, setIsWebcamOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

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
  };

  const onSubmit = async (values: RegisterPersonFormValues) => {
    if (!imageFile) {
      setPhotoError("A valid face photo is required for AI biometric registration.");
      toast.error("A valid face photo is required.");
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
        throw new Error(data.message || "Failed to register person.");
      }

      toast.success(`Registered ${data.person.firstName} ${data.person.lastName}! Code: ${data.person.personCode}`);
      router.push(`/dashboard/persons/${data.person.id}`);
      router.refresh();
    } catch (err: any) {
      console.error("Registration error:", err);
      toast.error(err.message || "Failed to register person.");
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
                  Register an individual and extract 512D ArcFace embeddings for instant face recognition.
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
                Ensure exactly <strong>one front-facing face</strong> is clearly visible and well-lit. The InsightFace AI engine automatically crops, aligns, and generates normalized 512D vector embeddings.
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

          <Button type="submit" disabled={isLoading} className="h-9 text-xs font-semibold gap-1.5 w-full sm:w-auto">
            {isLoading ? (
              <>
                <Loader className="w-3.5 h-3.5 animate-spin" />
                <span>Processing InsightFace AI...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span>Enroll Person & Extract Embedding</span>
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
