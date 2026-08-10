import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  PersonsClientFilters,
  RegisterPersonButton,
  PersonRowActions,
} from "@/components/ai/persons-client-actions";
import { DataTablePagination } from "@/components/dashboard/data-table-pagination";
import { CheckCircle2Icon, AlertTriangleIcon, UserXIcon, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = ["employee", "student", "visitor", "contractor"];

export default async function PersonsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    category?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;

  const rawPage = parseInt(resolvedSearchParams.page || "1", 10);
  const requestedPage = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
  const limit = 20;
  const search = (resolvedSearchParams.search || "").trim();
  const status = (resolvedSearchParams.status || "").trim().toLowerCase();
  const category = (resolvedSearchParams.category || "").trim().toLowerCase();

  // Construct Prisma WHERE query for server-side filtering
  const where: any = {};

  if (search) {
    const terms = search.split(/\s+/).filter(Boolean);
    if (terms.length > 0) {
      where.AND = terms.map((term) => ({
        OR: [
          { personCode: { contains: term, mode: "insensitive" } },
          { firstName: { contains: term, mode: "insensitive" } },
          { lastName: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
          { phone: { contains: term, mode: "insensitive" } },
          { department: { contains: term, mode: "insensitive" } },
        ],
      }));
    }
  }

  if (status && ["active", "inactive", "suspended"].includes(status)) {
    where.status = status;
  }

  if (category && VALID_CATEGORIES.includes(category)) {
    where.category = category;
  }

  // Count total matching records directly on PostgreSQL via Prisma
  const total = await prisma.person.count({ where });
  const totalPages = Math.ceil(total / limit) || 1;
  const effectivePage = Math.min(requestedPage, totalPages);
  const skip = (effectivePage - 1) * limit;

  // Retrieve persons with active face embedding metadata directly from PostgreSQL
  const persons = await prisma.person.findMany({
    where,
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      personCode: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      category: true,
      department: true,
      status: true,
      faceImageUrl: true,
      createdAt: true,
      updatedAt: true,
      faceEmbeddings: {
        where: { isActive: true },
        take: 1,
        select: {
          id: true,
          embeddingModel: true,
          qualityScore: true,
          isActive: true,
          createdAt: true,
        },
      },
    },
  });

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-4 sm:space-y-6 bg-background text-foreground">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-primary/10 border border-primary/20 text-primary rounded-lg">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Persons Directory</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage registered individuals and their 512D facial recognition profiles.
          </p>
        </div>

        <RegisterPersonButton />
      </div>

      {/* URL-Driven Search & Filters Toolbar */}
      <PersonsClientFilters
        initialSearch={search}
        initialStatus={status || "all"}
        initialCategory={category || "all"}
      />

      {/* Server-Side Rendered Data Table */}
      <Card className="border border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 border-b border-border">
                <TableHead className="w-[70px] font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Face
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Code & Name
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Category
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Department
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Status
                </TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Embedding Status
                </TableHead>
                <TableHead className="text-right w-[80px] font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-border/40">
              {persons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <UserXIcon className="h-10 w-10 mb-2 opacity-40" />
                      <p className="font-semibold text-base">No registered persons found</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {search || status || category
                          ? "Try adjusting your search or filter parameters."
                          : "Register your first person to enable biometric face recognition."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                persons.map((person) => {
                  const activeEmbedding = person.faceEmbeddings[0] || null;
                  const embeddingStatus = activeEmbedding ? "active" : "none";

                  return (
                    <TableRow key={person.id} className="hover:bg-muted/30 transition-colors">
                      {/* Photo Thumbnail */}
                      <TableCell className="py-3">
                        <div className="h-9 w-9 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center">
                          {person.faceImageUrl ? (
                            <img
                              src={person.faceImageUrl}
                              alt={person.firstName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-semibold text-muted-foreground">
                              {person.firstName[0]}{person.lastName[0]}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Code & Name */}
                      <TableCell className="py-3">
                        <div>
                          <Link
                            href={`/dashboard/persons/${person.id}`}
                            className="font-semibold hover:underline text-foreground text-sm"
                          >
                            {person.firstName} {person.lastName}
                          </Link>
                          <p className="text-xs text-muted-foreground font-mono">{person.personCode}</p>
                        </div>
                      </TableCell>

                      {/* Category */}
                      <TableCell className="py-3">
                        <Badge variant="outline" className="capitalize text-xs font-normal">
                          {person.category}
                        </Badge>
                      </TableCell>

                      {/* Department */}
                      <TableCell className="py-3 text-xs text-muted-foreground">
                        {person.department || "—"}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-3">
                        {person.status === "active" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20 text-xs">
                            Active
                          </Badge>
                        ) : person.status === "suspended" ? (
                          <Badge variant="destructive" className="text-xs">
                            Suspended
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>

                      {/* Embedding Status */}
                      <TableCell className="py-3">
                        {embeddingStatus === "active" ? (
                          <div className="flex items-center text-xs text-emerald-600 dark:text-emerald-400 font-medium gap-1">
                            <CheckCircle2Icon className="h-3.5 w-3.5" />
                            <span>Active</span>
                            {activeEmbedding?.qualityScore && (
                              <span className="text-[10px] text-muted-foreground ml-1">
                                ({Math.round(activeEmbedding.qualityScore * 100)}% quality)
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center text-xs text-amber-600 dark:text-amber-400 font-medium gap-1">
                            <AlertTriangleIcon className="h-3.5 w-3.5" />
                            <span>No Embedding</span>
                          </div>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-3 text-right">
                        <PersonRowActions person={person} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Unified Pagination Component */}
          <DataTablePagination
            total={total}
            page={effectivePage}
            limit={limit}
            totalPages={totalPages}
            itemLabel="persons"
          />
        </CardContent>
      </Card>
    </div>
  );
}
