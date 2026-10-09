"use client";

import Link from "next/link";
import { ArrowRight, LayoutDashboard, LogIn } from "lucide-react";
import { UserButton } from "@/components/auth/user/user-button";
import { useSession } from "@/lib/auth-client";

export function LandingHeaderAuth() {
  const { data: session } = useSession();

  return (
    <div className="flex items-center gap-2.5">
      {session ? (
        <>
          <Link
            href="/dashboard"
            className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Command Center</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <UserButton size="icon" />
        </>
      ) : (
        <>
          <Link
            href="/auth/sign-in"
            className="px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted border border-border rounded-xl transition-colors flex items-center gap-1.5"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </Link>
          <UserButton size="icon" />
        </>
      )}
    </div>
  );
}
