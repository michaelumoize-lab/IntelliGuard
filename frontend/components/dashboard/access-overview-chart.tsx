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
    <div className="bg-card text-card-foreground border border-border rounded-xl p-4 sm:p-6 shadow-sm flex flex-col justify-between space-y-4 sm:space-y-5 h-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
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
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Granted ({grantedPct.toFixed(1)}%)
          </span>
          <span className="flex items-center gap-1.5 text-destructive">
            <XCircle className="w-3.5 h-3.5 shrink-0" /> Denied ({deniedPct.toFixed(1)}%)
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
      <div className="grid grid-cols-2 gap-2 sm:gap-4 pt-1">
        <div className="p-3 bg-muted/40 rounded-lg border border-border">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Today Granted</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{todayGranted}</span>
            <span className="text-xs text-muted-foreground font-mono">/ {todayTotal} total</span>
          </div>
        </div>

        <div className="p-3 bg-muted/40 rounded-lg border border-border">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Today Denied</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg sm:text-xl font-bold font-mono text-destructive">{todayDenied}</span>
            <span className="text-xs text-muted-foreground font-mono">/ {todayTotal} total</span>
          </div>
        </div>
      </div>

      {/* All-Time Historical Breakdown */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-2 border-t border-border/80">
        <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg text-xs">
          <span className="text-muted-foreground text-[10px] sm:text-xs">All Time</span>
          <span className="font-mono font-bold text-foreground text-[11px] sm:text-xs">{total}</span>
        </div>

        <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg text-xs">
          <span className="text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-xs font-semibold">Granted</span>
          <span className="font-mono font-bold text-foreground text-[11px] sm:text-xs">{granted}</span>
        </div>

        <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg text-xs">
          <span className="text-destructive text-[10px] sm:text-xs font-semibold">Denied</span>
          <span className="font-mono font-bold text-foreground text-[11px] sm:text-xs">{denied}</span>
        </div>
      </div>
    </div>
  );
}
