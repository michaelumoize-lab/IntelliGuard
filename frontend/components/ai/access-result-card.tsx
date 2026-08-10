"use client";

import React from "react";
import { AccessScanResponse } from "@/lib/access/access-client";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Shield, User, Clock, Cpu } from "lucide-react";

interface AccessResultCardProps {
  result: AccessScanResponse | null;
  isLoading: boolean;
}

export function AccessResultCard({ result, isLoading }: AccessResultCardProps) {
  if (isLoading) {
    return (
      <div className="w-full bg-card/60 border border-border rounded-xl p-6 shadow-sm flex flex-col items-center justify-center min-h-[320px] animate-pulse">
        <div className="w-12 h-12 rounded-full bg-muted mb-4" />
        <div className="h-4 w-32 bg-muted rounded mb-2" />
        <div className="h-3 w-48 bg-muted/60 rounded" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="w-full bg-card/40 border border-dashed border-border rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[320px]">
        <div className="p-4 bg-muted/50 rounded-full text-muted-foreground mb-3">
          <Shield className="w-8 h-8" />
        </div>
        <h4 className="text-sm font-semibold text-foreground mb-1">Awaiting Face Scan</h4>
        <p className="text-xs text-muted-foreground max-w-xs">
          Click &quot;Scan Face&quot; or start continuous monitoring to test real-time recognition.
        </p>
      </div>
    );
  }

  const isGranted = result.access_status === "granted";
  const isAmbiguous = result.match_status === "ambiguous";
  const isUnknown = result.match_status === "unknown";

  // Visual status pill configurations
  const getBadgeStyle = () => {
    if (isGranted) {
      return {
        bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
        label: "ACCESS GRANTED",
      };
    }
    if (isAmbiguous) {
      return {
        bg: "bg-amber-500/10 border-amber-500/30 text-amber-500",
        icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
        label: "AMBIGUOUS MATCH",
      };
    }
    if (isUnknown) {
      return {
        bg: "bg-muted border-border text-muted-foreground",
        icon: <HelpCircle className="w-5 h-5 text-muted-foreground" />,
        label: "UNKNOWN INDIVIDUAL",
      };
    }
    return {
      bg: "bg-destructive/10 border-destructive/30 text-destructive",
      icon: <XCircle className="w-5 h-5 text-destructive" />,
      label: "ACCESS DENIED",
    };
  };

  const badge = getBadgeStyle();
  const rawSimilarity = result.face ? result.face.similarity : 0;
  const similarityPct = rawSimilarity < 0 ? "< 0%" : `${(rawSimilarity * 100).toFixed(1)}%`;
  const qualityPct = result.face?.quality_score != null ? (result.face.quality_score * 100).toFixed(1) : null;

  return (
    <div className="w-full bg-card text-card-foreground border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between">
      {/* Top Header: Decision Badge */}
      <div className="flex items-center justify-between pb-5 border-b border-border mb-5">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wide ${badge.bg}`}>
          {badge.icon}
          <span>{badge.label}</span>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground uppercase">
          {result.reason?.replaceAll("_", " ")}
        </span>
      </div>

      {/* Person Profile Section */}
      {result.person ? (
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center text-muted-foreground flex-shrink-0">
            <User className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground leading-snug">
              {result.person.first_name} {result.person.last_name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono text-muted-foreground">{result.person.person_code}</span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                {result.person.category}
              </span>
            </div>
            {result.person.department && (
              <p className="text-xs text-muted-foreground mt-0.5">{result.person.department}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 bg-muted/40 rounded-xl border border-border mb-6 text-center">
          <p className="text-xs text-muted-foreground font-medium">
            {isAmbiguous
              ? "Multiple candidates matched within margin threshold."
              : "No registered individual matched this facial embedding."}
          </p>
        </div>
      )}

      {/* Competing Candidates List (if Ambiguous) */}
      {isAmbiguous && result.candidates && result.candidates.length > 0 && (
        <div className="mb-5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <p className="text-[11px] font-semibold text-amber-500 mb-2">Competing Candidates:</p>
          <div className="space-y-1.5">
            {result.candidates.map((cand, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs text-foreground">
                <span>{cand.firstName} {cand.lastName} ({cand.personCode})</span>
                <span className="font-mono text-amber-500">{(cand.similarity * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Breakdown Grid */}
      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
        <div className="p-3 bg-muted/40 rounded-xl border border-border">
          <p className="text-[10px] text-muted-foreground font-medium uppercase mb-1">Similarity Match</p>
          <p className="text-base font-bold font-mono text-foreground">{similarityPct}</p>
        </div>

        <div className="p-3 bg-muted/40 rounded-xl border border-border">
          <p className="text-[10px] text-muted-foreground font-medium uppercase mb-1">Processing Time</p>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <p className="text-base font-bold font-mono text-foreground">{result.processing_time_ms} ms</p>
          </div>
        </div>

        {qualityPct && (
          <div className="p-3 bg-muted/40 rounded-xl border border-border">
            <p className="text-[10px] text-muted-foreground font-medium uppercase mb-1">Face Quality</p>
            <p className="text-sm font-semibold font-mono text-muted-foreground">{qualityPct}%</p>
          </div>
        )}

        <div className="p-3 bg-muted/40 rounded-xl border border-border">
          <p className="text-[10px] text-muted-foreground font-medium uppercase mb-1">Vector Model</p>
          <div className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-medium text-foreground">{result.face?.model || "Buffalo_L"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
