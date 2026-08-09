import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "@/lib/get-session";

import { getQueryClient } from "@/lib/query-client"

export default async function Dashboard() {
  const queryClient = getQueryClient()

  const session = await getServerSession();

  if (!session) {
    redirect("/auth/sign-in?redirectTo=/dashboard")
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col items-center my-auto">
        <h1 className="text-2xl">Hello, {session.user.email}</h1>

        <Link href="/auth/sign-out">Sign Out</Link>
      </div>
    </HydrationBoundary>
  )
}