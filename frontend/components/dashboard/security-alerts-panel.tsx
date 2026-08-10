"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ShieldAlert, ArrowRight, Loader2 } from "lucide-react";

export interface SecurityAlertItem {
  id: number;
  alertType: string;
  title: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  resolved: boolean;
  createdAt: string;
  person?: {
    id: number;
    personCode: string;
    firstName: string;
    lastName: string;
  } | null;
}

interface SecurityAlertsPanelProps {
  alerts: SecurityAlertItem[];
  countsBySeverity?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  onAlertResolved?: (id: number) => void;
}

export function SecurityAlertsPanel({ alerts, countsBySeverity, onAlertResolved }: SecurityAlertsPanelProps) {
  const router = useRouter();
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolvedIds, setResolvedIds] = useState<number[]>([]);

  const handleResolve = async (alert: SecurityAlertItem) => {
    if (resolvingId || alert.resolved || resolvedIds.includes(alert.id)) return;
    setResolvingId(alert.id);

    try {
      const res = await fetch(`/api/alerts/${alert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: true }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResolvedIds((prev) => [...prev, alert.id]);
        toast.success(`Security alert "${alert.title}" marked as resolved.`);
        router.refresh();
        if (onAlertResolved) {
          onAlertResolved(alert.id);
        }
      } else {
        toast.error(data.message || "Failed to resolve alert.");
      }
    } catch (err) {
      console.error("Failed to resolve alert:", err);
      toast.error("Failed to resolve security alert.");
    } finally {
      setResolvingId(null);
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "critical":
        return "bg-destructive/10 border-destructive/30 text-destructive font-bold";
      case "high":
        return "bg-orange-500/10 border-orange-500/30 text-orange-500 font-semibold";
      case "medium":
        return "bg-amber-500/10 border-amber-500/30 text-amber-500 font-semibold";
      default:
        return "bg-muted border-border text-muted-foreground";
    }
  };

  return (
    <div className="bg-card text-card-foreground border border-border rounded-xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm font-semibold text-foreground">Security Anomaly Alerts</h3>
        </div>
        <Link
          href="/dashboard/alerts"
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 transition-colors"
        >
          View All Alerts <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Severity Breakdown Summary */}
      {countsBySeverity && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground font-medium mr-1">Summary:</span>
          {countsBySeverity.critical > 0 && (
            <span className="px-2 py-0.5 rounded bg-destructive/10 text-destructive text-[11px] font-mono font-bold border border-destructive/20">
              🔴 {countsBySeverity.critical} Critical
            </span>
          )}
          {countsBySeverity.high > 0 && (
            <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-500 text-[11px] font-mono font-bold border border-orange-500/20">
              🟠 {countsBySeverity.high} High
            </span>
          )}
          {countsBySeverity.medium > 0 && (
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[11px] font-mono font-bold border border-amber-500/20">
              🟡 {countsBySeverity.medium} Medium
            </span>
          )}
          {countsBySeverity.low > 0 && (
            <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-[11px] font-mono font-medium border border-border">
              ⚪ {countsBySeverity.low} Low
            </span>
          )}
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          <p>Zero active security alerts. All systems nominal.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const isResolved = alert.resolved || resolvedIds.includes(alert.id);
            const isResolving = resolvingId === alert.id;

            return (
              <div
                key={alert.id}
                className="p-4 bg-muted/40 border border-border rounded-xl flex items-start justify-between gap-4 hover:border-muted-foreground/30 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${getSeverityBadge(
                        alert.severity
                      )}`}
                    >
                      {alert.severity}
                    </span>
                    <h4 className="text-xs font-semibold text-foreground">{alert.title}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{alert.message}</p>
                  <p className="text-[10px] font-mono text-muted-foreground/70 pt-1">
                    {new Date(alert.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="shrink-0">
                  {isResolved ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                    </span>
                  ) : (
                    <button
                      onClick={() => handleResolve(alert)}
                      disabled={isResolving}
                      className="px-3 py-1.5 min-w-[85px] bg-secondary hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 border border-border font-medium text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70"
                    >
                      {isResolving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                          <span>Resolving...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Resolve</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
