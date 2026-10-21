"use client";

import React, { useState } from "react";
import Image from "next/image";
import { AccessScanResponse } from "@/lib/access/access-client";
import { VectorInspectorModal } from "@/components/ai/vector-inspector-modal";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Shield,
  User,
  Clock,
  Cpu,
  Camera,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Users,
  Sparkles,
  Lock,
  LockOpen,
} from "lucide-react";

interface AccessResultCardProps {
  result: AccessScanResponse | null;
  isLoading: boolean;
  capturedImageUrl?: string | null;
}

export function AccessResultCard({ result, isLoading, capturedImageUrl }: AccessResultCardProps) {
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="w-full bg-card/90 backdrop-blur-md border border-border/80 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col items-center justify-center min-h-[380px] animate-pulse">
        <div className="w-16 h-16 rounded-full bg-muted mb-4" />
        <div className="h-5 w-44 bg-muted rounded mb-2" />
        <div className="h-3.5 w-60 bg-muted/60 rounded" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="w-full bg-card/85 backdrop-blur-md border border-border/80 rounded-2xl p-6 sm:p-8 flex flex-col justify-between min-h-[380px] gap-6 select-none shadow-sm">
        {/* Terminal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono font-semibold text-foreground tracking-wider uppercase">
              Terminal Gate #1
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 border border-border/70 text-[11px] font-mono text-muted-foreground">
            <Lock className="w-3 h-3 text-muted-foreground" />
            <span>Relay: SECURED</span>
          </div>
        </div>

        {/* Center Holographic Standby Graphic */}
        <div className="flex flex-col items-center justify-center text-center py-2 space-y-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-20 h-20 rounded-full bg-primary/10 animate-ping opacity-40 pointer-events-none" />
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-muted/60 border border-primary/25 flex items-center justify-center text-primary shadow-sm">
              <Shield className="w-8 h-8" />
            </div>
          </div>
          <div className="space-y-1">
            <h4 className="text-sm sm:text-base font-bold text-foreground tracking-tight">
              Awaiting Biometric Verification
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed mx-auto">
              Activate the camera feed and click <strong className="text-foreground">&quot;Scan Face&quot;</strong> or enable <strong className="text-foreground">&quot;Live Auto&quot;</strong> to evaluate facial credentials.
            </p>
          </div>
        </div>

        {/* 3 Step Interactive Quick Guide */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-border/60 text-left">
          <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold font-mono flex items-center justify-center shrink-0">1</span>
            <span className="text-[11px] text-muted-foreground leading-tight">Turn on camera feed</span>
          </div>
          <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold font-mono flex items-center justify-center shrink-0">2</span>
            <span className="text-[11px] text-muted-foreground leading-tight">Align face in oval reticle</span>
          </div>
          <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold font-mono flex items-center justify-center shrink-0">3</span>
            <span className="text-[11px] text-muted-foreground leading-tight">Instant gate unlock (60s)</span>
          </div>
        </div>
      </div>
    );
  }

  const isError =
    result.success === false ||
    result.status === "recognition_error" ||
    result.reason === "system_error" ||
    result.match_status === "rejected";
  const isGranted = !isError && result.access_status === "granted";
  const isAmbiguous = !isError && (result.match_status === "ambiguous" || result.status === "ambiguous_match");
  const isUnknown = !isError && (result.match_status === "unknown" || result.status === "unknown_individual");
  const isNoPerson = !isError && (result.status === "no_person" || result.reason === "no_person_detected");
  const isPersonNoFace = !isError && (result.status === "person_no_face" || result.reason === "no_face_detected");
  const isLowQuality = !isError && (result.status === "face_low_quality" || result.reason === "poor_quality_face");
  const isSuspended = !isError && Boolean(
    result.person?.status?.toLowerCase() === "suspended" ||
    (result.reason === "unauthorized" && result.message?.toLowerCase().includes("suspended"))
  );
  const isDeactivated = !isError && (
    result.reason === "unauthorized" ||
    Boolean(
      result.person &&
      result.person.status &&
      result.person.status.toLowerCase() !== "active"
    ) ||
    (result.message?.toLowerCase().includes("deactivated") ?? false)
  );

  const getBadgeStyle = () => {
    if (isNoPerson) {
      return {
        bg: "bg-slate-500/10 border-slate-500/30 text-slate-500 dark:text-slate-400",
        icon: <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />,
        label: "NO PERSON DETECTED",
      };
    }
    if (isPersonNoFace) {
      return {
        bg: "bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400",
        icon: <User className="w-4 h-4 text-cyan-500" />,
        label: "PERSON DETECTED — NO FACE",
      };
    }
    if (isLowQuality) {
      return {
        bg: "bg-amber-500/10 border-amber-500/30 text-amber-500",
        icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
        label: "FACE DETECTED — LOW QUALITY",
      };
    }
    if (isError) {
      return {
        bg: "bg-destructive/15 border-destructive/40 text-destructive",
        icon: <AlertCircle className="w-4 h-4 text-destructive" />,
        label: "RECOGNITION ERROR",
      };
    }
    if (isGranted) {
      return {
        bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
        label: "ACCESS GRANTED",
      };
    }
    if (isDeactivated) {
      return {
        bg: "bg-destructive/15 border-destructive/40 text-destructive",
        icon: <ShieldAlert className="w-4 h-4 text-destructive" />,
        label: isSuspended ? "USER SUSPENDED - ACCESS DENIED" : "USER DEACTIVATED - ACCESS DENIED",
      };
    }
    if (isAmbiguous) {
      return {
        bg: "bg-amber-500/10 border-amber-500/30 text-amber-500",
        icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
        label: "AMBIGUOUS MATCH",
      };
    }
    if (isUnknown) {
      return {
        bg: "bg-muted border-border text-muted-foreground",
        icon: <HelpCircle className="w-4 h-4 text-muted-foreground" />,
        label: "UNKNOWN INDIVIDUAL",
      };
    }
    return {
      bg: "bg-destructive/10 border-destructive/30 text-destructive",
      icon: <XCircle className="w-4 h-4 text-destructive" />,
      label: "ACCESS DENIED",
    };
  };

  const badge = getBadgeStyle();
  const rawSimilarity = result.face ? result.face.similarity : 0;
  const similarityPct = rawSimilarity < 0 ? "< 0%" : `${(rawSimilarity * 100).toFixed(1)}%`;
  const qualityPct = result.face?.quality_score != null ? (result.face.quality_score * 100).toFixed(1) : null;

  return (
    <div className="w-full bg-card/90 backdrop-blur-md text-card-foreground border border-border/80 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col justify-between transition-all">
      <div>
        {/* Top Header: Decision Badge & Hardware Action */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-4 border-b border-border/70 mb-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wide ${badge.bg}`}>
            {badge.icon}
            <span>{badge.label}</span>
          </div>

          <div className="flex items-center gap-2">
            {result.door_action && (
              <span
                className={`text-[10px] font-mono px-2.5 py-1 rounded-full font-semibold uppercase flex items-center gap-1.5 ${
                  result.door_action === "unlock"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : result.door_action === "no_action"
                    ? "bg-muted text-muted-foreground border border-border/70"
                    : "bg-destructive/15 text-destructive border border-destructive/30"
                }`}
              >
                {result.door_action === "unlock" ? (
                  <LockOpen className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Lock className="w-3 h-3" />
                )}
                <span>DOOR: {result.door_action.replace("_", " ")}</span>
              </span>
            )}

            <span className="text-[11px] font-mono text-muted-foreground uppercase font-semibold">
              {result.reason ? result.reason.replaceAll("_", " ") : isDeactivated ? "UNAUTHORIZED" : ""}
            </span>
          </div>
        </div>

        {/* Welcome Greeting Hero Banner (Active when Access is Granted) */}
        {isGranted && result.person && (
          <div className="mb-4 p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/30 shadow-sm flex items-center justify-between gap-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-mono uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                    Access Granted
                  </span>
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-mono text-muted-foreground">Door Unlocked (60s)</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground truncate">
                  Welcome, {result.person.first_name} {result.person.last_name}!
                </h3>
              </div>
            </div>
            <div className="hidden xs:flex flex-col items-end shrink-0 text-right">
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                MATCH {similarityPct}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono mt-0.5">{result.person.person_code}</span>
            </div>
          </div>
        )}

        {/* Side-by-Side Biometric Comparison: Live Capture vs. Database Reference */}
        <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-muted/20 border border-border/70 rounded-xl">
          {/* Left: Live Captured Frame */}
          <div className="flex flex-col items-center text-center">
            <span className="text-[10px] font-mono font-semibold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
              <Camera className="w-3 h-3 text-cyan-500" /> Live Capture
            </span>
            <div
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-black border overflow-hidden flex items-center justify-center shadow-inner transition-all ${
                isGranted
                  ? "border-emerald-500/60 ring-2 ring-emerald-500/20"
                  : isUnknown || isDeactivated
                  ? "border-destructive/60 ring-2 ring-destructive/20"
                  : "border-border/80"
              }`}
            >
              {capturedImageUrl ? (
                <Image
                  src={capturedImageUrl}
                  alt="Live Capture"
                  width={96}
                  height={96}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-8 h-8 text-muted-foreground/60" />
              )}
            </div>
          </div>

          {/* Right: Enrolled Database Reference */}
          <div className="flex flex-col items-center text-center">
            <span className="text-[10px] font-mono font-semibold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Registered Profile
            </span>
            <div
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-muted border overflow-hidden flex items-center justify-center shadow-inner transition-all ${
                result.person ? "border-emerald-500/50 ring-2 ring-emerald-500/15" : "border-border/80"
              }`}
            >
              {result.person?.face_image_url ? (
                <Image
                  src={result.person.face_image_url}
                  alt={`${result.person.first_name} ${result.person.last_name}`}
                  width={96}
                  height={96}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-8 h-8 text-muted-foreground/60" />
              )}
            </div>
          </div>
        </div>

        {/* Deactivated / Suspended Notice Banner */}
        {isDeactivated && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl mb-4 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-destructive font-bold text-xs uppercase tracking-wide">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{isSuspended ? "Account Suspended" : "Account Deactivated"}</span>
            </div>
            <p className="text-xs text-destructive/90 font-medium">
              {isSuspended
                ? "This user is suspended and not authorized to access the facility."
                : "This user is deactivated and not allowed to access the system."}
            </p>
          </div>
        )}

        {/* Person Metadata Badge (if matched) */}
        {result.person ? (
          <div className="mb-4 p-3 rounded-xl bg-muted/30 border border-border/70">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug truncate">
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
          <div className="p-3 bg-muted/40 rounded-xl border border-border/70 mb-4 text-center">
            <p className="text-xs text-muted-foreground font-medium">
              {isNoPerson
                ? "No person detected in camera frame. Door remains locked (no action)."
                : isPersonNoFace
                ? "Person detected, but face is not visible or obscured. Please face the camera directly."
                : isLowQuality
                ? "Face detected, but image quality or lighting is insufficient for biometric verification."
                : isError
                ? "Biometric recognition error encountered. Please check camera feed or try again."
                : isAmbiguous
                ? "Multiple candidates matched within ambiguity margin."
                : "Unregistered individual. Access denied by security policy."}
            </p>
          </div>
        )}

        {/* Vector Similarity Gauge */}
        {!isNoPerson && !isPersonNoFace && !isError ? (
          <div className="mb-4 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-primary" /> Cosine Similarity
              </span>
              <button
                type="button"
                onClick={() => setIsInspectorOpen(true)}
                className="font-mono font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1 cursor-pointer underline decoration-dotted"
                title="Click to inspect vector breakdown"
              >
                <span>{similarityPct}</span>
                <span className="text-[10px] text-primary">(Inspect)</span>
              </button>
            </div>
            <div className="relative w-full h-2.5 bg-muted rounded-full overflow-hidden flex">
              {/* 0.50 Threshold Marker */}
              <div
                className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-foreground/30 z-10 pointer-events-none"
                title="Decision Threshold: 0.50"
              />
              <div
                style={{ width: `${Math.max(0, Math.min(100, rawSimilarity * 100))}%` }}
                className={`h-full transition-all duration-500 ${
                  isGranted ? "bg-emerald-500" : isAmbiguous ? "bg-amber-500" : "bg-destructive"
                }`}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
              <span>0.00</span>
              <span className="text-muted-foreground/80 font-medium">Threshold 0.50</span>
              <span>1.00</span>
            </div>
          </div>
        ) : (
          <div className="mb-4 p-3 bg-muted/20 border border-border/60 rounded-xl flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 opacity-40" /> Biometric Vector Evaluation
            </span>
            <span className="font-mono text-[11px] font-medium uppercase text-muted-foreground">
              {isNoPerson
                ? "Frame Empty — Skipped"
                : isPersonNoFace
                ? "No Face Visible — Skipped"
                : isError
                ? "System Error — Skipped"
                : "Skipped"}
            </span>
          </div>
        )}

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
      </div>

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

      {/* Vector Similarity Inspector Modal */}
      <VectorInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        result={result}
        capturedImageUrl={capturedImageUrl}
      />
    </div>
  );
}
