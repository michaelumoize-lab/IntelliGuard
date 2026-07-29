"use client";

import { useEffect } from "react";
import { useAuthenticate } from "@better-auth-ui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";

export default function Dashboard() {
  const { data: session, isPending } = useAuthenticate();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/auth/sign-in");
    }
  }, [isPending, session, router]);

  if (isPending) {
    return (
      <div className="flex justify-center my-auto">
        <Spinner color="current" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex flex-col items-center my-auto">
      <h1 className="text-2xl">Hello, {session.user.email}</h1>
      <Link href="/auth/sign-out">Sign Out</Link>
    </div>
  );
}
