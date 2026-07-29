"use client";

import { useRouter } from "next/navigation";
import { ShieldOff, AlertCircle, Home, LogIn } from "lucide-react";
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

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-background to-muted/20">
      <Card className="w-full max-w-md border-destructive/20 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 rounded-full bg-destructive/10 p-3 w-fit">
            <ShieldOff className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">Access Denied</CardTitle>
          <CardDescription className="text-base">
            You don&apos;t have permission to access this page.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>What happened?</AlertTitle>
            <AlertDescription>
              You either don&apos;t have the required role (admin) or your
              session has expired. Please sign in with appropriate permissions.
            </AlertDescription>
          </Alert>

          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p className="font-medium mb-2">Need access?</p>
            <p>
              If you believe this is a mistake, please contact your
              administrator or try signing in again.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button
            onClick={() => router.push("/auth/sign-in")}
            className="w-full gap-2"
          >
            <LogIn className="h-4 w-4" />
            Sign In
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="w-full gap-2"
          >
            <Home className="h-4 w-4" />
            Go to Homepage
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
