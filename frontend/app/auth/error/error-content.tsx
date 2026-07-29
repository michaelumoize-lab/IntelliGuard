"use client";

import { useSearchParams } from "next/navigation";
import { AlertCircle, ShieldBan, Home, RefreshCw, Mail } from "lucide-react";
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

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@yourapp.com";

export default function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const email = searchParams.get("email"); // Get email from URL params

  // Banned user error
  if (error === "banned") {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-background to-muted/20">
        <Card className="w-full max-w-md border-destructive/20 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 rounded-full bg-destructive/10 p-3 w-fit">
              <ShieldBan className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold">Account Banned</CardTitle>
            <CardDescription className="text-base">
              {errorDescription ||
                "Your account has been banned from this application."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>What happened?</AlertTitle>
              <AlertDescription>
                Your account was banned due to violation of our terms of
                service. If you believe this is a mistake, please contact our
                support team.
              </AlertDescription>
            </Alert>
            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              <p className="font-medium mb-2">Need help?</p>
              <p>
                Contact our support team at <strong>{SUPPORT_EMAIL}</strong> for
                assistance.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              onClick={() => (window.location.href = "/auth/sign-in")}
              className="w-full"
            >
              Return to Sign In
            </Button>
            <Button
              variant="ghost"
              onClick={() => (window.location.href = "/")}
              className="w-full"
            >
              <Home className="mr-2 h-4 w-4" />
              Go to Homepage
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // OAuth state mismatch error
  if (error === "state_mismatch" || error === "please_restart_the_process") {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 rounded-full bg-amber-500/10 p-3 w-fit">
              <RefreshCw className="h-8 w-8 text-amber-500" />
            </div>
            <CardTitle>Authentication Interrupted</CardTitle>
            <CardDescription>
              Something went wrong during the sign-in process.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Try again</AlertTitle>
              <AlertDescription>
                This usually happens when you click the back button or refresh
                the page. Please close this window and try signing in again.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              onClick={() => (window.location.href = "/auth/sign-in")}
              className="w-full"
            >
              Try Again
            </Button>
            <Button
              variant="ghost"
              onClick={() => (window.location.href = "/")}
              className="w-full"
            >
              Go to Homepage
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Email verification error - with public resend flow
  if (error === "email_not_verified") {
    // Build the resend URL with email context
    const resendUrl = email
      ? `/auth/email-verification?email=${encodeURIComponent(email)}`
      : "/auth/email-verification";

    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 rounded-full bg-blue-500/10 p-3 w-fit">
              <Mail className="h-8 w-8 text-blue-500" />
            </div>
            <CardTitle>Email Not Verified</CardTitle>
            <CardDescription>
              Please verify your email address before signing in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
              Check your inbox for a verification link. Didn&apos;t receive it?
              You can request a new verification email.
              {email && (
                <span className="block mt-2 text-xs text-muted-foreground">
                  We&apos;ll send it to <strong>{email}</strong>
                </span>
              )}
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              onClick={() => (window.location.href = resendUrl)}
              className="w-full"
            >
              Resend Verification Email
            </Button>
            <Button
              variant="ghost"
              onClick={() => (window.location.href = "/auth/sign-in")}
              className="w-full"
            >
              Back to Sign In
            </Button>
            <Button
              variant="ghost"
              onClick={() => (window.location.href = "/")}
              className="w-full"
            >
              Go to Homepage
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Generic error fallback
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 rounded-full bg-destructive/10 p-3 w-fit">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle>Something Went Wrong</CardTitle>
          <CardDescription>
            {errorDescription ||
              "An unexpected error occurred during authentication."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted/50 p-3 text-xs font-mono text-muted-foreground break-all">
            Error code: {error || "unknown"}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            onClick={() => (window.location.href = "/auth/sign-in")}
            className="w-full"
          >
            Try Again
          </Button>
          <Button
            variant="ghost"
            onClick={() => (window.location.href = "/")}
            className="w-full"
          >
            Go to Homepage
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}