import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  PersonDetailsClientHeaderActions,
  PersonDetailsStatusToggle,
} from "@/components/ai/person-details-client-actions";
import {
  ArrowLeftIcon,
  AlertTriangleIcon,
  ClockIcon,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PersonDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const personId = parseInt(resolvedParams.id, 10);

  if (isNaN(personId)) {
    notFound();
  }

  // Directly query PostgreSQL via Prisma on the server
  const person = await prisma.person.findUnique({
    where: { id: personId },
    include: {
      faceEmbeddings: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          embeddingModel: true,
          imagePath: true,
          qualityScore: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!person) {
    notFound();
  }

  const activeEmbedding = person.faceEmbeddings.find((e) => e.isActive) || null;
  const embeddingStatus = activeEmbedding ? "active" : person.faceEmbeddings.length > 0 ? "inactive" : "none";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link href="/dashboard/persons">
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {person.firstName} {person.lastName}
              </h1>
              <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                {person.personCode}
              </span>
            </div>
            <p className="text-xs text-muted-foreground capitalize">
              {person.category} • {person.department || "No Department"}
            </p>
          </div>
        </div>

        <PersonDetailsClientHeaderActions person={person} />
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: ImageKit Face Photo & Biometric Metrics */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Face Recognition</span>
              {embeddingStatus === "active" ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs">
                  Active Profile
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">
                  No Active Embedding
                </Badge>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* ImageKit Preview */}
            <div className="relative aspect-square w-full rounded-xl overflow-hidden border border-border bg-muted/30">
              {person.faceImageUrl ? (
                <img
                  src={person.faceImageUrl}
                  alt={`${person.firstName} ${person.lastName}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
                  No Photo Uploaded
                </div>
              )}
            </div>

            {/* Embedding Metrics */}
            {activeEmbedding ? (
              <div className="space-y-2 text-xs bg-muted/40 p-3.5 rounded-lg border border-border">
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Embedding Model</span>
                  <span className="font-semibold text-foreground">{activeEmbedding.embeddingModel || "Buffalo_L"}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Vector Dimension</span>
                  <span className="font-semibold text-foreground">512D (ArcFace)</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Normalized</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Yes (L2 Norm = 1.0)</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Quality Score</span>
                  <span className="font-semibold text-foreground">
                    {activeEmbedding.qualityScore
                      ? `${(activeEmbedding.qualityScore * 100).toFixed(2)}%`
                      : "N/A"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Registered Date</span>
                  <span className="font-mono text-[11px]">
                    {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(activeEmbedding.createdAt))}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-900/50 flex items-center gap-2">
                <AlertTriangleIcon className="h-4 w-4 flex-shrink-0" />
                <span>This person has no active face embedding vector.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Identity Details & Historical Embeddings Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Identity Information */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Identity Details</CardTitle>
              <PersonDetailsStatusToggle person={person} />
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-0.5">First Name</span>
                  <span className="font-medium text-sm">{person.firstName}</span>
                </div>

                <div>
                  <span className="text-muted-foreground block mb-0.5">Last Name</span>
                  <span className="font-medium text-sm">{person.lastName}</span>
                </div>

                <div>
                  <span className="text-muted-foreground block mb-0.5">Person Code</span>
                  <span className="font-mono text-sm font-semibold">{person.personCode}</span>
                </div>

                <div>
                  <span className="text-muted-foreground block mb-0.5">Category</span>
                  <Badge variant="outline" className="capitalize text-xs font-normal">
                    {person.category}
                  </Badge>
                </div>

                <div>
                  <span className="text-muted-foreground block mb-0.5">Department</span>
                  <span className="font-medium">{person.department || "—"}</span>
                </div>

                <div>
                  <span className="text-muted-foreground block mb-0.5">Status</span>
                  <Badge
                    className={
                      person.status === "active"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {person.status}
                  </Badge>
                </div>

                <div>
                  <span className="text-muted-foreground block mb-0.5">Email</span>
                  <span className="font-medium">{person.email || "—"}</span>
                </div>

                <div>
                  <span className="text-muted-foreground block mb-0.5">Phone</span>
                  <span className="font-medium">{person.phone || "—"}</span>
                </div>

                <div>
                  <span className="text-muted-foreground block mb-0.5">Created At</span>
                  <span className="font-mono">{new Date(person.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {person.notes && (
                <div className="mt-4 pt-3 border-t border-border text-xs">
                  <span className="text-muted-foreground block mb-1 font-medium">Notes</span>
                  <p className="text-muted-foreground bg-muted/30 p-2.5 rounded border border-border">
                    {person.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historical Embeddings Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClockIcon className="h-4 w-4 text-muted-foreground" />
                <span>Facial Embedding History</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Audit trail of 512D ArcFace embeddings generated for this individual.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Embedding ID</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Quality Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Created Date</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {person.faceEmbeddings && person.faceEmbeddings.length > 0 ? (
                    person.faceEmbeddings.map((emb: any) => (
                      <TableRow key={emb.id} className="text-xs">
                        <TableCell className="font-mono">#{emb.id}</TableCell>
                        <TableCell className="font-medium">{emb.embeddingModel}</TableCell>
                        <TableCell>
                          {emb.qualityScore ? `${(emb.qualityScore * 100).toFixed(2)}%` : "N/A"}
                        </TableCell>
                        <TableCell>
                          {emb.isActive ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                              Active Recognition
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              Inactive / Deactivated
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(emb.createdAt))}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-xs text-muted-foreground">
                        No historical embedding records found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
