"use client";

import { useAuth, useRequestPasswordReset } from "@better-auth-ui/react";
import { type SyntheticEvent, useState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { Label } from "../ui/label";

export type ForgotPasswordProps = {
  className?: string;
};

export function ForgotPassword({ className }: ForgotPasswordProps) {
  const { basePaths, localization, viewPaths, Link } = useAuth();
  const [resendCountdown, setResendCountdown] = useState(0);

  const { mutate: requestPasswordReset, isPending } = useRequestPasswordReset({
    onError: (error) => toast.error(error.message || error.statusText),
    onSuccess: () => {
      toast.success(localization.auth.passwordResetEmailSent);
      setResendCountdown(60);
    },
  });

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    requestPasswordReset({
      email: formData.get("email") as string,
      redirectTo: "/auth/reset-password",
    });
  }

  const [fieldErrors, setFieldErrors] = useState<{ email?: string }>({});

  return (
    <Card className={cn("w-full max-w-sm", className)}>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">
          {localization.auth.forgotPassword}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={!!fieldErrors.email}>
              <Label htmlFor="email">{localization.auth.email}</Label>

              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder={localization.auth.emailPlaceholder}
                required
                disabled={isPending || resendCountdown > 0}
                onChange={() =>
                  setFieldErrors((prev) => ({ ...prev, email: undefined }))
                }
                onInvalid={(e) => {
                  e.preventDefault();
                  setFieldErrors((prev) => ({
                    ...prev,
                    email: (e.target as HTMLInputElement).validationMessage,
                  }));
                }}
                aria-invalid={!!fieldErrors.email}
              />

              <FieldError>{fieldErrors.email}</FieldError>
            </Field>

            <div className="flex flex-col gap-3">
              <Button type="submit" disabled={isPending || resendCountdown > 0}>
                {isPending && <Spinner />}
                {resendCountdown > 0
                  ? `Resend available in ${resendCountdown}s`
                  : localization.auth.sendResetLink}
              </Button>
            </div>
          </FieldGroup>
        </form>

        <div className="flex flex-col gap-3 items-center w-full mt-4">
          <FieldDescription className="text-center">
            {localization.auth.rememberYourPassword}{" "}
            <Link
              href={`${basePaths.auth}/${viewPaths.auth.signIn}`}
              className="underline underline-offset-4"
            >
              {localization.auth.signIn}
            </Link>
          </FieldDescription>
        </div>
      </CardContent>
    </Card>
  );
}
