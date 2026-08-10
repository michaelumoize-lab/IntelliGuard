"use client";

import React from "react";
import { Cpu, CheckCircle, HelpCircle, AlertTriangle, Sparkles, Clock, Zap } from "lucide-react";

interface RecognitionBreakdownProps {
  matched: number;
  unknown: number;
  ambiguous: number;
  avgQuality?: number;
  avgSimilarity?: number;
  avgLatencySec?: number;
}

export function RecognitionBreakdown({
  matched,
  unknown,
  ambiguous,
  avgQuality = 0,
  avgSimilarity = 0,
  avgLatencySec = 0,
}: RecognitionBreakdownProps) {
  const total = matched + unknown + ambiguous;

  const matchedPct = total > 0 ? (matched / total) * 100 : 0;
  const unknownPct = total > 0 ? (unknown / total) * 100 : 0;
  const ambiguousPct = total > 0 ? (ambiguous / total) * 100 : 0;

  return (
    <div className="bg-card text-card-foreground border border-border rounded-xl p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Recognition Results</h3>
        </div>
        <span className="text-xs font-mono text-muted-foreground">{total} Recognition Attempts</span>
      </div>

      {/* Distribution Progress Bar */}
      <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex">
        <div style={{ width: `${matchedPct}%` }} className="h-full bg-emerald-500 transition-all duration-500" />
        <div style={{ width: `${unknownPct}%` }} className="h-full bg-muted-foreground/50 transition-all duration-500" />
        <div style={{ width: `${ambiguousPct}%` }} className="h-full bg-amber-500 transition-all duration-500" />
      </div>

      {/* Distribution Cards */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <div className="p-3 bg-muted/40 rounded-lg border border-border flex flex-col items-center text-center">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="w-3 h-3" /> Matched
          </span>
          <span className="text-lg font-bold font-mono text-foreground mt-1">{matched}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{matchedPct.toFixed(1)}%</span>
        </div>

        <div className="p-3 bg-muted/40 rounded-lg border border-border flex flex-col items-center text-center">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <HelpCircle className="w-3 h-3" /> Unknown
          </span>
          <span className="text-lg font-bold font-mono text-foreground mt-1">{unknown}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{unknownPct.toFixed(1)}%</span>
        </div>

        <div className="p-3 bg-muted/40 rounded-lg border border-border flex flex-col items-center text-center">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3 h-3" /> Ambiguous
          </span>
          <span className="text-lg font-bold font-mono text-foreground mt-1">{ambiguous}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{ambiguousPct.toFixed(1)}%</span>
        </div>
      </div>

      {/* Telemetry Averages */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/80">
        <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-primary" /> Avg Quality
          </span>
          <span className="font-mono font-bold text-foreground">{avgQuality.toFixed(1)}%</span>
        </div>

        <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-500" /> Avg Similarity
          </span>
          <span className="font-mono font-bold text-foreground">{avgSimilarity.toFixed(1)}%</span>
        </div>

        <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-500" /> Avg Latency
          </span>
          <span className="font-mono font-bold text-foreground">{avgLatencySec.toFixed(2)}s</span>
        </div>
      </div>
    </div>
  );
}
