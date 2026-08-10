import { redirect } from "next/navigation";

export default async function PersonAliasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  redirect(`/dashboard/persons/${resolvedParams.id}`);
}

