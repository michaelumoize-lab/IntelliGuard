"use client";

import React from "react";
import { AccessScanResponse } from "@/lib/access/access-client";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Shield,
  User,
  Clock,
  Cpu,
  Camera,
  ShieldCheck,
  ShieldAlert,
  Zap,
} from "lucide-react";

interface AccessResultCardProps {
  result: AccessScanResponse | null;
  isLoading: boolean;
  capturedImageUrl?: string | null;
}

export function AccessResultCard({ result, isLoading, capturedImageUrl }: AccessResultCardProps) {
  if (isLoading) {
    return (
      <div className="w-full bg-card/60 border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center min-h-[360px] animate-pulse">
        <div className="w-14 h-14 rounded-full bg-muted mb-4" />
        <div className="h-4 w-36 bg-muted rounded mb-2" />
        <div className="h-3 w-52 bg-muted/60 rounded" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="w-full bg-card/40 border border-dashed border-border rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[360px]">
        <div className="p-4 bg-muted/50 rounded-full text-muted-foreground mb-3">
          <Shield className="w-8 h-8" />
        </div>
        <h4 className="text-sm font-semibold text-foreground mb-1">Awaiting Biometric Scan</h4>
        <p className="text-xs text-muted-foreground max-w-xs">
          Click &quot;Scan Face&quot; or enable continuous live monitoring to test face recognition.
        </p>
      </div>
    );
  }

  const isGranted = result.access_status === "granted";
  const isAmbiguous = result.match_status === "ambiguous";
  const isUnknown = result.match_status === "unknown";
  const isDeactivated = Boolean(
    result.person &&
    result.person.status &&
    result.person.status.toLowerCase() !== "active"
  ) || (result.message?.toLowerCase().includes("deactivated") ?? false);

  const getBadgeStyle = () => {
    if (isGranted) {
      return {
        bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
        label: "ACCESS GRANTED",
      };
    }
    if (isDeactivated) {
      return {
        bg: "bg-destructive/15 border-destructive/40 text-destructive",
        icon: <ShieldAlert className="w-5 h-5 text-destructive" />,
        label: "USER DEACTIVATED - ACCESS DENIED",
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
    <div className="w-full bg-card text-card-foreground border border-border rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col justify-between">
      {/* Top Header: Decision Badge */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-4 border-b border-border mb-4">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wide ${badge.bg}`}>
          {badge.icon}
          <span>{badge.label}</span>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground uppercase font-semibold">
          {isDeactivated ? "USER IS DEACTIVATED" : result.reason?.replaceAll("_", " ")}
        </span>
      </div>

      {/* Side-by-Side Biometric Comparison: Live Capture vs. Database Reference */}
      <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-muted/20 border border-border/70 rounded-xl">
        {/* Left: Live Captured Frame */}
        <div className="flex flex-col items-center text-center">
          <span className="text-[10px] font-mono font-semibold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
            <Camera className="w-3 h-3 text-cyan-500" /> Live Capture
          </span>
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-black border border-border/80 overflow-hidden flex items-center justify-center shadow-inner">
            {capturedImageUrl ? (
              <img src={capturedImageUrl} alt="Live Capture" className="w-full h-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-muted-foreground/60" />
            )}
          </div>
        </div>

        {/* Right: Enrolled Database Reference */}
        <div className="flex flex-col items-center text-center">
          <span className="text-[10px] font-mono font-semibold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" /> Registered Profile
          </span>
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-muted border border-border/80 overflow-hidden flex items-center justify-center shadow-inner">
            {result.person?.face_image_url ? (
              <img
                src={result.person.face_image_url}
                alt={`${result.person.first_name} ${result.person.last_name}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-8 h-8 text-muted-foreground/60" />
            )}
          </div>
        </div>
      </div>

      {/* Deactivated Notice Banner */}
      {isDeactivated && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl mb-4 text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-destructive font-bold text-xs uppercase tracking-wide">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Account Deactivated</span>
          </div>
          <p className="text-xs text-destructive/90 font-medium">
            This user is deactivated and not allowed to access the system.
          </p>
        </div>
      )}

      {/* Person Details Header (if matched) */}
      {result.person ? (
        <div className="mb-4 p-3 rounded-xl bg-muted/30 border border-border/70">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground leading-snug truncate">
              {result.person.first_name} {result.person.last_name}
            </h3>
            <div className="flex items-center gap-1.5">
              {isDeactivated && (
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/30">
                  {result.person.status?.toUpperCase() || "DEACTIVATED"}
                </span>
              )}
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                {result.person.category}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-mono">
            <span>{result.person.person_code}</span>
            {result.person.department && (
              <>
                <span>•</span>
                <span>{result.person.department}</span>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="p-3 bg-muted/40 rounded-xl border border-border mb-4 text-center">
          <p className="text-xs text-muted-foreground font-medium">
            {isAmbiguous
              ? "Multiple candidates matched within ambiguity margin."
              : "Unregistered individual. Access denied by security policy."}
          </p>
        </div>
      )}

      {/* Vector Similarity Gauge */}
      <div className="mb-4 space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground font-medium flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-primary" /> Cosine Similarity
          </span>
          <span className="font-mono font-bold text-foreground">{similarityPct}</span>
        </div>
        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden flex">
          <div
            style={{ width: `${Math.max(0, Math.min(100, rawSimilarity * 100))}%` }}
            className={`h-full transition-all duration-500 ${
              isGranted ? "bg-emerald-500" : isAmbiguous ? "bg-amber-500" : "bg-destructive"
            }`}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
          <span>0.00</span>
          <span>Threshold: 0.50</span>
          <span>1.00</span>
        </div>
      </div>

      {/* Competing Candidates List (if Ambiguous) */}
      {isAmbiguous && result.candidates && result.candidates.length > 0 && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <p className="text-[11px] font-semibold text-amber-500 mb-2">Ambiguous Candidates:</p>
          <div className="space-y-1">
            {result.candidates.map((cand, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs text-foreground">
                <span className="truncate mr-2">{cand.firstName} {cand.lastName} ({cand.personCode})</span>
                <span className="font-mono text-amber-500 font-semibold shrink-0">{(cand.similarity * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Telemetry Metrics Grid */}
      <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-border">
        <div className="p-2.5 bg-muted/30 rounded-xl border border-border/70">
          <p className="text-[10px] text-muted-foreground font-medium uppercase mb-0.5">Latency</p>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
            <p className="text-sm font-bold font-mono text-foreground">{result.processing_time_ms} ms</p>
          </div>
        </div>

        <div className="p-2.5 bg-muted/30 rounded-xl border border-border/70">
          <p className="text-[10px] text-muted-foreground font-medium uppercase mb-0.5">Model</p>
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs font-semibold text-foreground truncate">{result.face?.model || "Buffalo_S"}</p>
          </div>
        </div>

        {qualityPct && (
          <div className="p-2.5 bg-muted/30 rounded-xl border border-border/70 col-span-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[10px] text-muted-foreground font-medium uppercase">Face Quality Score</span>
              <span className="font-mono font-semibold text-foreground text-xs">{qualityPct}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
