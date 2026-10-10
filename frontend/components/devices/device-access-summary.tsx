import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Clock, ArrowRight, UserCheck } from "lucide-react";

export interface AccessSummaryLog {
  id: number;
  timestamp: string | Date;
  person?: {
    id: number;
    personCode: string;
    firstName: string;
    lastName: string;
    category?: string;
  } | null;
  matchStatus: string;
  accessStatus: string;
  reason: string;
  confidenceScore?: number | null;
  processingTimeMs?: number | null;
}

interface DeviceAccessSummaryProps {
  stats: {
    totalAccessAttempts: number;
    grantedAttempts: number;
    deniedAttempts: number;
    todayAttempts: number;
    todayGranted: number;
    todayDenied: number;
  };
  recentLogs: AccessSummaryLog[];
  deviceId: number;
}

export function DeviceAccessSummary({ stats, recentLogs, deviceId }: DeviceAccessSummaryProps) {
  return (
    <div className="space-y-4">
      {/* Access Event Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="rounded-lg border p-3 bg-muted/20">
          <p className="text-xs text-muted-foreground font-medium">Total Attempts</p>
          <p className="text-2xl font-bold mt-1">{stats.totalAccessAttempts}</p>
        </div>
        <div className="rounded-lg border p-3 bg-emerald-500/5 border-emerald-500/20">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Total Granted</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.grantedAttempts}</p>
        </div>
        <div className="rounded-lg border p-3 bg-rose-500/5 border-rose-500/20">
          <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">Total Denied</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{stats.deniedAttempts}</p>
        </div>
        <div className="rounded-lg border p-3 bg-muted/20">
          <p className="text-xs text-muted-foreground font-medium">Today Attempts</p>
          <p className="text-2xl font-bold mt-1">{stats.todayAttempts}</p>
        </div>
        <div className="rounded-lg border p-3 bg-emerald-500/5 border-emerald-500/20">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Today Granted</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.todayGranted}</p>
        </div>
        <div className="rounded-lg border p-3 bg-rose-500/5 border-rose-500/20">
          <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">Today Denied</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{stats.todayDenied}</p>
        </div>
      </div>

      {/* Recent Access Events */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle className="text-base font-semibold">Recent Access Events</CardTitle>
            <CardDescription className="text-xs">
              Latest facial recognition and access control evaluation logs for this device
            </CardDescription>
          </div>
          <Link
            href={`/dashboard/access-logs?search=${deviceId}`}
            className="text-xs font-medium text-primary hover:underline flex items-center"
          >
            View All Logs
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </CardHeader>

        <CardContent className="p-0">
          {recentLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No access events recorded for this device yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/60 text-muted-foreground font-mono uppercase text-[10px] tracking-wider hover:bg-transparent">
                  <TableHead className="py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Time</TableHead>
                  <TableHead className="py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Person</TableHead>
                  <TableHead className="py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Match Status</TableHead>
                  <TableHead className="py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Access Status</TableHead>
                  <TableHead className="py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Reason</TableHead>
                  <TableHead className="py-2.5 text-right font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/40">
                {recentLogs.map((log) => (
                  <TableRow key={log.id} className="text-xs hover:bg-muted/40 transition-colors">
                    <TableCell className="text-muted-foreground font-mono whitespace-nowrap py-3">
                      {new Date(log.timestamp).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="font-medium py-3">
                      {log.person ? (
                        <Link
                          href={`/dashboard/persons/${log.person.id}`}
                          className="hover:underline text-foreground"
                        >
                          {log.person.firstName} {log.person.lastName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground italic">Unrecognized</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="font-mono text-xs uppercase font-semibold text-foreground">
                        {log.matchStatus}
                      </span>
                    </TableCell>
                    <TableCell className="py-3">
                      {log.accessStatus === "granted" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                          GRANTED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-destructive/10 border border-destructive/20 text-destructive font-semibold text-[11px]">
                          DENIED
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[150px] truncate py-3 font-mono uppercase text-[11px]">
                      {log.reason}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold py-3">
                      {log.confidenceScore != null
                        ? `${(log.confidenceScore * 100).toFixed(1)}%`
                        : "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
