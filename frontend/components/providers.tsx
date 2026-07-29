"use client";

import { AuthProvider } from "@better-auth-ui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";

import { authClient } from "@/lib/auth-client";
import { Toaster } from "./ui/sonner";
import { SessionRefresher } from "./session-refresher";

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  return (
    <AuthProvider
      authClient={authClient}
      appearance={{ theme, setTheme }}
      deleteUser={{ enabled: true, sendDeleteAccountVerification: true }}
      // magicLink
      multiSession
      redirectTo="/dashboard"
      socialProviders={["google"]}
      navigate={({ to, replace }) =>
        replace ? router.replace(to) : router.push(to)
      }
      Link={Link}
    >
      {children}
      <SessionRefresher />
      <Toaster />
    </AuthProvider>
  );
}
