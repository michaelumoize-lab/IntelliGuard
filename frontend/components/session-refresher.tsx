"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@better-auth-ui/react";

export function SessionRefresher() {
  const { data: session, refetch } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Refetch session when component mounts
    refetch();
  }, [refetch]);

  // This effect runs whenever session state changes
  useEffect(() => {
    router.refresh();
  }, [session, router]);

  return null;
}
