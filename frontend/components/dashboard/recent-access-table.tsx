"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  History,
  CheckCircle2,
  XCircle,
  ArrowRight,
  User,
  AlertCircle,
  Cpu,
  Clock,
  Sparkles,
} from "lucide-react";

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

type FilterType = "all" | "granted" | "denied";

export function RecentAccessTable({ events }: RecentAccessTableProps) {
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredEvents = useMemo(() => {
    if (filter === "granted") return events.filter((e) => e.accessStatus === "granted");
    if (filter === "denied") return events.filter((e) => e.accessStatus === "denied");
    return events;
  }, [events, filter]);

  const grantedCount = useMemo(() => events.filter((e) => e.accessStatus === "granted").length, [events]);
  const deniedCount = useMemo(() => events.filter((e) => e.accessStatus === "denied").length, [events]);

  const formatSimilarity = (score: number | null | undefined, matchStatus: string) => {
    if (score !== null && score !== undefined) {
      if (score < 0) return "< 0%";
      return `${(score * 100).toFixed(1)}%`;
    }
    if (matchStatus === "unknown") return "No Match";
    return "N/A";
  };

  const formatTime = (iso: string) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "UTC",
    }).format(new Date(iso));
  };

  return (
    <div className="bg-card text-card-foreground border border-border rounded-xl p-4 sm:p-6 shadow-sm space-y-4">
      {/* Header and Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Recent Access Events</h3>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          {/* Quick-filter Chips */}
          <div className="flex items-center bg-muted/40 p-0.5 rounded-lg border border-border text-xs">
            <button
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                filter === "all"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({events.length})
            </button>
            <button
              onClick={() => setFilter("granted")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1 ${
                filter === "granted"
                  ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Granted ({grantedCount})
            </button>
            <button
              onClick={() => setFilter("denied")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1 ${
                filter === "denied"
                  ? "bg-background text-destructive shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <XCircle className="w-3 h-3 text-destructive" />
              Denied ({deniedCount})
            </button>
          </div>

          <Link
            href="/dashboard/access-logs"
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 transition-colors shrink-0"
          >
            <span className="hidden xs:inline">View Logs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          {events.length === 0
            ? "No access events recorded yet."
            : `No ${filter} access events match the current filter.`}
        </div>
      ) : (
        <>
          {/* Mobile Card Transformation (< md screens) */}
          <div className="grid grid-cols-1 gap-2.5 md:hidden">
            {filteredEvents.map((evt) => {
              const isGranted = evt.accessStatus === "granted";
              const isDataInconsistency = isGranted && !evt.person;
              const similarityDisplay = formatSimilarity(evt.confidenceScore, evt.matchStatus);
              const timeDisplay = formatTime(evt.createdAt);

              return (
                <div
                  key={evt.id}
                  className={`p-3.5 rounded-xl border transition-colors ${
                    isGranted
                      ? "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10"
                      : "border-destructive/20 bg-destructive/5 hover:bg-destructive/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center shrink-0">
                        {evt.person?.faceImageUrl ? (
                          <img src={evt.person.faceImageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        {evt.person ? (
                          <Link
                            href={`/dashboard/persons/${evt.person.id}`}
                            className="font-semibold text-xs text-foreground hover:text-primary transition-colors block truncate"
                          >
                            {evt.person.firstName} {evt.person.lastName}
                          </Link>
                        ) : isDataInconsistency ? (
                          <span className="text-xs text-destructive font-medium flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Unknown (Inconsistent)
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Unknown Face</span>
                        )}
                        <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> {timeDisplay}
                        </span>
                      </div>
                    </div>

                    {isGranted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px] shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> GRANTED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 border border-destructive/20 text-destructive font-semibold text-[10px] shrink-0">
                        <XCircle className="w-3 h-3" /> DENIED
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-border/40 font-mono">
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-sans">Reason / Gate</span>
                      <span className="text-foreground capitalize truncate block">
                        {evt.reason.replaceAll("_", " ")}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground block font-sans">Similarity / Latency</span>
                      <span className="text-foreground font-semibold">
                        {similarityDisplay}{" "}
                        <span className="text-muted-foreground font-normal">
                          ({evt.processingTimeMs != null ? `${(evt.processingTimeMs / 1000).toFixed(2)}s` : "N/A"})
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (>= md screens) */}
          <div className="hidden md:block overflow-x-auto">
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
                {filteredEvents.map((evt) => {
                  const dateStr = formatTime(evt.createdAt);
                  const isGranted = evt.accessStatus === "granted";
                  const isDataInconsistency = isGranted && !evt.person;
                  const similarityDisplay = formatSimilarity(evt.confidenceScore, evt.matchStatus);

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
                            <span>
                              {evt.person.firstName} {evt.person.lastName}
                            </span>
                          </Link>
                        ) : isDataInconsistency ? (
                          <span
                            className="inline-flex items-center gap-1 text-destructive font-medium"
                            title="Access granted without matched person record"
                          >
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
        </>
      )}
    </div>
  );
}
