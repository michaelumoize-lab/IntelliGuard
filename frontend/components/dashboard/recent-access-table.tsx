"use client";

import React from "react";
import Link from "next/link";
import { History, CheckCircle2, XCircle, AlertTriangle, HelpCircle, ArrowRight, User, AlertCircle } from "lucide-react";

export interface AccessEventItem {
  id: number;
  matchStatus: string;
  accessStatus: string;
  reason: string;
  doorAction: string;
  confidenceScore: number | null;
  processingTimeMs: number | null;
  createdAt: string;
  person?: {
    id: number;
    personCode: string;
    firstName: string;
    lastName: string;
    category: string;
    faceImageUrl?: string | null;
  } | null;
  device?: {
    id: number;
    deviceName: string;
    serialNumber: string;
  } | null;
}

interface RecentAccessTableProps {
  events: AccessEventItem[];
}

export function RecentAccessTable({ events }: RecentAccessTableProps) {
  return (
    <div className="bg-card text-card-foreground border border-border rounded-xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Recent Access Events</h3>
        </div>
        <Link
          href="/dashboard/access-logs"
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 transition-colors"
        >
          View All Logs <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No access events recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground font-mono uppercase text-[10px]">
                <th className="pb-3">Time</th>
                <th className="pb-3">Individual</th>
                <th className="pb-3">Match</th>
                <th className="pb-3">Access</th>
                <th className="pb-3">Reason</th>
                <th className="pb-3 text-right">Similarity</th>
                <th className="pb-3 text-right">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {events.map((evt) => {
                const dateStr = new Intl.DateTimeFormat("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  timeZone: "UTC",
                }).format(new Date(evt.createdAt));
                const isGranted = evt.accessStatus === "granted";
                const isDataInconsistency = isGranted && !evt.person;

                // Format similarity gracefully without raw negative percentage exposure
                let similarityDisplay = "N/A";
                if (evt.confidenceScore !== null && evt.confidenceScore !== undefined) {
                  if (evt.confidenceScore < 0) {
                    similarityDisplay = "< 0%";
                  } else {
                    similarityDisplay = `${(evt.confidenceScore * 100).toFixed(1)}%`;
                  }
                } else if (evt.matchStatus === "unknown") {
                  similarityDisplay = "No Match";
                }

                return (
                  <tr key={evt.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3.5 font-mono text-muted-foreground whitespace-nowrap">{dateStr}</td>
                    <td className="py-3.5">
                      {evt.person ? (
                        <Link
                          href={`/dashboard/persons/${evt.person.id}`}
                          className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-2"
                        >
                          <div className="w-5 h-5 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center shrink-0">
                            {evt.person.faceImageUrl ? (
                              <img src={evt.person.faceImageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <span>{evt.person.firstName} {evt.person.lastName}</span>
                        </Link>
                      ) : isDataInconsistency ? (
                        <span className="inline-flex items-center gap-1 text-destructive font-medium" title="Access granted without matched person record">
                          <AlertCircle className="w-3.5 h-3.5" /> Unknown (Inconsistent)
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">Unknown</span>
                      )}
                    </td>
                    <td className="py-3.5">
                      <span className="font-mono text-[11px] font-semibold uppercase text-foreground">
                        {evt.matchStatus}
                      </span>
                    </td>
                    <td className="py-3.5">
                      {isGranted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3 h-3" /> GRANTED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-destructive/10 border border-destructive/20 text-destructive font-semibold text-[11px]">
                          <XCircle className="w-3 h-3" /> DENIED
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 font-mono text-muted-foreground uppercase text-[11px]">
                      {evt.reason.replaceAll("_", " ")}
                    </td>
                    <td className="py-3.5 font-mono text-right font-semibold text-foreground">
                      {similarityDisplay}
                    </td>
                    <td className="py-3.5 font-mono text-right text-muted-foreground">
                      {evt.processingTimeMs != null ? `${(evt.processingTimeMs / 1000).toFixed(2)}s` : "N/A"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
