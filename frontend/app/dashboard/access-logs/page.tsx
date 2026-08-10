import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DataTableSearch } from "@/components/dashboard/data-table-search";
import { DataTablePagination } from "@/components/dashboard/data-table-pagination";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { History, CheckCircle2, XCircle, User } from "lucide-react";

export const dynamic = "force-dynamic";

interface AccessLogsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    matchStatus?: string;
  }>;
}

export default async function AccessLogsPage({ searchParams }: AccessLogsPageProps) {
  const params = await searchParams;
  const rawPage = parseInt(params.page || "1", 10);
  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
  const limit = 20;
  const search = (params.search || "").trim();
  const statusFilter = (params.status || "").trim().toLowerCase();
  const matchFilter = (params.matchStatus || "").trim().toLowerCase();

  const where: any = {};

  if (statusFilter && ["granted", "denied"].includes(statusFilter)) {
    where.accessStatus = statusFilter;
  }

  if (matchFilter && ["matched", "unknown", "ambiguous", "rejected"].includes(matchFilter)) {
    where.matchStatus = matchFilter;
  }

  if (search) {
    const terms = search.split(/\s+/).filter(Boolean);
    if (terms.length > 0) {
      where.AND = terms.map((term) => ({
        OR: [
          { person: { firstName: { contains: term, mode: "insensitive" } } },
          { person: { lastName: { contains: term, mode: "insensitive" } } },
          { person: { personCode: { contains: term, mode: "insensitive" } } },
        ],
      }));
    }
  }

  const total = await prisma.accessLog.count({ where });
  const totalPages = Math.ceil(total / limit) || 1;
  const skip = (page - 1) * limit;

  const logs = await prisma.accessLog.findMany({
    where,
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      person: {
        select: {
          id: true,
          personCode: true,
          firstName: true,
          lastName: true,
          category: true,
        },
      },
      device: {
        select: {
          id: true,
          deviceName: true,
          serialNumber: true,
        },
      },
    },
  });

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6 bg-background text-foreground">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-primary/10 border border-primary/20 text-primary rounded-lg">
              <History className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Access Control Event Logs</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Audit log history of all biometric recognition and access decision events.
          </p>
        </div>
      </div>

      {/* Standardized Search & Filter Header Bar */}
      <Card className="border border-border shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <DataTableSearch
            placeholder="Search logs by name or person code..."
            className="max-w-none flex-1"
          />

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Access Status Filter */}
            <Link
              href={`/dashboard/access-logs?page=1&search=${encodeURIComponent(search)}&status=&matchStatus=${matchFilter}`}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                !statusFilter ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:text-foreground"
              }`}
            >
              All Decisions
            </Link>
            <Link
              href={`/dashboard/access-logs?page=1&search=${encodeURIComponent(search)}&status=granted&matchStatus=${matchFilter}`}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                statusFilter === "granted" ? "bg-emerald-600 text-white border-emerald-600" : "bg-background border-input text-muted-foreground hover:text-foreground"
              }`}
            >
              Granted
            </Link>
            <Link
              href={`/dashboard/access-logs?page=1&search=${encodeURIComponent(search)}&status=denied&matchStatus=${matchFilter}`}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                statusFilter === "denied" ? "bg-destructive text-destructive-foreground border-destructive" : "bg-background border-input text-muted-foreground hover:text-foreground"
              }`}
            >
              Denied
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Standardized Logs Table */}
      <Card className="border border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 border-b border-border">
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Log ID</TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Time</TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Individual</TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Match</TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Access</TableHead>
                <TableHead className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Reason</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Similarity</TableHead>
                <TableHead className="text-right font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Latency</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-border/40">
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center text-xs text-muted-foreground">
                    No access logs found matching your filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const isGranted = log.accessStatus === "granted";
                  let similarityDisplay = "N/A";
                  if (log.confidenceScore !== null && log.confidenceScore !== undefined) {
                    if (log.confidenceScore < 0) {
                      similarityDisplay = "< 0%";
                    } else {
                      similarityDisplay = `${(log.confidenceScore * 100).toFixed(1)}%`;
                    }
                  } else if (log.matchStatus === "unknown") {
                    similarityDisplay = "No Match";
                  }

                  return (
                    <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="py-3.5 font-mono text-muted-foreground">#{log.id}</TableCell>
                      <TableCell className="py-3.5 font-mono text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="py-3.5">
                        {log.person ? (
                          <Link
                            href={`/dashboard/persons/${log.person.id}`}
                            className="font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{log.person.firstName} {log.person.lastName}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">({log.person.personCode})</span>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground italic">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <span className="font-mono text-xs uppercase font-semibold text-foreground">
                          {log.matchStatus}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5">
                        {isGranted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> GRANTED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-destructive/10 border border-destructive/20 text-destructive font-semibold text-[11px]">
                            <XCircle className="w-3.5 h-3.5" /> DENIED
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-3.5 font-mono text-muted-foreground uppercase text-[11px]">
                        {log.reason.replaceAll("_", " ")}
                      </TableCell>
                      <TableCell className="py-3.5 font-mono text-right font-semibold text-foreground">
                        {similarityDisplay}
                      </TableCell>
                      <TableCell className="py-3.5 font-mono text-right text-muted-foreground">
                        {log.processingTimeMs ? `${(log.processingTimeMs / 1000).toFixed(2)}s` : "N/A"}
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
            page={page}
            limit={limit}
            totalPages={totalPages}
            itemLabel="access log records"
          />
        </CardContent>
      </Card>
    </div>
  );
}
