"use client";

import React from "react";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

interface AccessOverviewChartProps {
  total: number;
  granted: number;
  denied: number;
  todayTotal: number;
  todayGranted: number;
  todayDenied: number;
}

export function AccessOverviewChart({
  total,
  granted,
  denied,
  todayTotal,
  todayGranted,
  todayDenied,
}: AccessOverviewChartProps) {
  const grantedPct = total > 0 ? (granted / total) * 100 : 0;
  const deniedPct = total > 0 ? (denied / total) * 100 : 0;

  return (
    <div className="bg-card text-card-foreground border border-border rounded-xl p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Access Decisions</h3>
        </div>
        <span className="text-xs font-mono text-muted-foreground">Today / All Time</span>
      </div>

      {/* Primary Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground font-medium">
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Granted ({grantedPct.toFixed(1)}%)
          </span>
          <span className="flex items-center gap-1.5 text-destructive">
            <XCircle className="w-3.5 h-3.5" /> Denied ({deniedPct.toFixed(1)}%)
          </span>
        </div>

        <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex">
          <div
            style={{ width: `${grantedPct}%` }}
            className="h-full bg-emerald-500 transition-all duration-500"
          />
          <div
            style={{ width: `${deniedPct}%` }}
            className="h-full bg-destructive transition-all duration-500"
          />
        </div>
      </div>

      {/* Grid Summary comparison */}
      <div className="grid grid-cols-2 gap-4 pt-2">
        <div className="p-3 bg-muted/40 rounded-lg border border-border">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Today Granted</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{todayGranted}</span>
            <span className="text-xs text-muted-foreground font-mono">/ {todayTotal} total</span>
          </div>
        </div>

        <div className="p-3 bg-muted/40 rounded-lg border border-border">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Today Denied</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold font-mono text-destructive">{todayDenied}</span>
            <span className="text-xs text-muted-foreground font-mono">/ {todayTotal} total</span>
          </div>
        </div>
      </div>
    </div>
  );
}
