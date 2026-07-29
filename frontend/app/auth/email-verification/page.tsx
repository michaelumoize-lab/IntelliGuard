"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@better-auth-ui/react";
import {
  Mail,
  Send,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, refetch, isPending: isSessionLoading } = useSession();

  // True when Better Auth redirects back here after server-side verification
  const justVerified = searchParams.get("verified") === "true";

  const [isVerifying, setIsVerifying] = useState(() => justVerified);
  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [sendStatus, setSendStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [redirectCountdown, setRedirectCountdown] = useState(5);
  const [email, setEmail] = useState("");

  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  const verificationError = searchParams.get("error");

  // 1. Handle redirect back from Better Auth's /api/auth/email-verification
  useEffect(() => {
    if (!justVerified) return;
    let isMounted = true;
    setIsVerifying(true);

    if (verificationError) {
      setVerificationStatus("error");
      setIsVerifying(false);
      toast.error("Verification failed. The link may have expired.");
      return;
    }

    refetchRef
      .current()
      .then((result) => {
        if (!isMounted) return;
        if (result?.data?.user?.emailVerified) {
          setVerificationStatus("success");
          toast.success("Email verified successfully!");
        } else {
          setVerificationStatus("error");
          toast.error("Verification failed. The link may have expired.");
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setVerificationStatus("error");
        toast.error("Something went wrong. Please try again.");
      })
      .finally(() => {
        if (isMounted) setIsVerifying(false);
      });

    return () => {
      isMounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Countdown + redirect after successful verification
  useEffect(() => {
    if (verificationStatus !== "success") return;
    if (redirectCountdown <= 0) {
      router.push("/dashboard");
      return;
    }
    const timer = setTimeout(() => setRedirectCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [verificationStatus, redirectCountdown, router]);

  // 3. Prefill email from session
  useEffect(() => {
    if (session?.user?.email) setEmail(session.user.email);
  }, [session]);

  // 4. Resend countdown
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // 5. Redirect unauthenticated users (skip if we're in a verify flow)
  useEffect(() => {
    if (
      !isSessionLoading &&
      !session &&
      !isVerifying &&
      !justVerified &&
      verificationStatus === "idle"
    ) {
      router.replace("/auth/sign-in");
    }
  }, [
    session,
    isSessionLoading,
    isVerifying,
    justVerified,
    verificationStatus,
    router,
  ]);

  // 6. Send verification email
  const handleSendVerification = async () => {
    if (resendCountdown > 0 || !email || sendStatus === "sending") return;
    setSendStatus("sending");
    try {
      const response = await authClient.sendVerificationEmail({
        email,
        // Include ?verified=true so the page knows it's a post-verification redirect
        callbackURL: `${window.location.origin}/auth/email-verification?verified=true`,
      });
      if (response.error) {
        setSendStatus("error");
        toast.error("Failed to send verification email. Please try again.");
      } else {
        setSendStatus("sent");
        setResendCountdown(60);
        toast.success("Verification email sent! Check your inbox.");
      }
    } catch (error) {
      console.error("Send verification email error:", error);
      setSendStatus("error");
      toast.error("Something went wrong. Please try again.");
    }
  };

  // --- Loading while verifying ---
  if (isVerifying) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-7 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto mt-2" />
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <Mail className="absolute inset-0 m-auto h-5 w-5 animate-pulse text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Verifying your email…
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Success with countdown ---
  if (verificationStatus === "success") {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 rounded-full bg-green-500/10 p-3 w-fit">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle>Email Verified!</CardTitle>
            <CardDescription>
              Your email has been successfully verified.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Redirecting to dashboard in{" "}
              <span className="font-semibold text-foreground">
                {redirectCountdown}s
              </span>
              …
            </p>
          </CardContent>
          <CardFooter>
            <Button
              onClick={() => router.push("/dashboard")}
              className="w-full"
            >
              Go to Dashboard now
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // --- Error ---
  if (verificationStatus === "error") {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 rounded-full bg-destructive/10 p-3 w-fit">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Verification Failed</CardTitle>
            <CardDescription>
              The verification link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3">
            <Button
              onClick={() => {
                setVerificationStatus("idle");
                router.replace("/auth/email-verification");
              }}              className="w-full"
            >
              Try Again
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard")}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // --- Loading session ---
  if (isSessionLoading && !justVerified) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-7 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto mt-2" />
          </CardHeader>
        </Card>
      </div>
    );
  }

  // --- Already verified ---
  if (session?.user?.emailVerified) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 rounded-full bg-primary/10 p-3 w-fit">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Already Verified</CardTitle>
            <CardDescription>
              Your email address has already been verified.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              onClick={() => router.push("/dashboard")}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // --- Main form ---
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Verify Your Email
          </CardTitle>
          <CardDescription>
            We&apos;ll send a verification link to your email address.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendVerification();
            }}
          >
            <FieldGroup>
              <Field>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={sendStatus === "sending" || resendCountdown > 0}
                />
                <FieldDescription>
                  We&apos;ll send a verification link to this email.
                </FieldDescription>
              </Field>

              {sendStatus === "sent" && (
                <Alert className="border-primary/50 bg-primary/10">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertTitle>Email Sent!</AlertTitle>
                  <AlertDescription>
                    Check your inbox (and spam folder) and click the
                    verification link.
                  </AlertDescription>
                </Alert>
              )}

              {sendStatus === "error" && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Failed to Send</AlertTitle>
                  <AlertDescription>
                    There was an error sending the email. Please try again.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-3">
                <Button
                  type="submit"
                  disabled={
                    sendStatus === "sending" || resendCountdown > 0 || !email
                  }
                  className="gap-2"
                >
                  {sendStatus === "sending" && <Spinner />}
                  {sendStatus !== "sending" && <Send className="h-4 w-4" />}
                  {resendCountdown > 0
                    ? `Resend available in ${resendCountdown}s`
                    : sendStatus === "sent"
                      ? "Resend Verification Email"
                      : "Send Verification Email"}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>

        <CardFooter>
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="w-full gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <Skeleton className="h-7 w-48 mx-auto" />
              <Skeleton className="h-4 w-64 mx-auto mt-2" />
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
