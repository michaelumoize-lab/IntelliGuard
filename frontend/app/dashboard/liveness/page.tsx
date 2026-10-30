"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Upload,
  Camera,
  RefreshCw,
  Cpu,
  Clock,
  Sparkles,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Layers,
} from "lucide-react";

interface LivenessData {
  status: "live" | "spoof_detected" | "inconclusive" | "error";
  model: string;
  liveScore: number;
  threshold?: number | null;
  liveThreshold?: number | null;
  spoofThreshold?: number | null;
  individualScores: Record<string, number>;
  processingTimeMs: number;
  ensembleMethod?: string;
}

interface LivenessResponse {
  success: boolean;
  liveness: LivenessData;
  faceDetected: boolean;
  faceCount: number;
  primaryFaceBbox?: number[] | null;
  executionTimeMs: number;
}

export default function LivenessInspectorPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<LivenessResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeFileRef = useRef<File | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      activeFileRef.current = file;
      setSelectedFile(file);
      setPreviewUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return URL.createObjectURL(file);
      });
      setResult(null);
      setErrorMessage(null);
    }
  };

  const handleRunAnalysis = async (fileToAnalyze?: File) => {
    const file = fileToAnalyze || selectedFile;
    if (!file) {
      setErrorMessage("Please select or upload an image first.");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    activeFileRef.current = file;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file, file.name);

      const res = await fetch("/api/liveness", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.detail || "Anti-spoofing verification failed.");
      }

      if (activeFileRef.current === file) {
        setResult(data as LivenessResponse);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const msg = err instanceof Error ? err.message : "Failed to analyze liveness.";
      setErrorMessage(msg);
    } finally {
      if (activeFileRef.current === file) {
        setIsLoading(false);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "live":
        return {
          bg: "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
          label: "LIVE / BONA FIDE FACE",
          desc: "Sufficient evidence of a genuine human face. Eligible for biometric recognition.",
        };
      case "spoof_detected":
        return {
          bg: "bg-destructive/20 border-destructive text-destructive",
          icon: <ShieldAlert className="w-5 h-5 text-destructive" />,
          label: "PRESENTATION ATTACK DETECTED (SPOOF)",
          desc: "Strong evidence of a presentation attack (e.g. phone screen replay or printed photo). Access denied.",
        };
      case "inconclusive":
        return {
          bg: "bg-amber-500/15 border-amber-500/40 text-amber-500",
          icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
          label: "INCONCLUSIVE LIVENESS",
          desc: "Conflicting model outputs or marginal confidence. Re-capture required.",
        };
      default:
        return {
          bg: "bg-muted border-border text-muted-foreground",
          icon: <HelpCircle className="w-5 h-5 text-muted-foreground" />,
          label: "UNKNOWN STATUS",
          desc: "Unable to determine presentation authenticity.",
        };
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Anti-Spoofing & Liveness Inspector
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Evaluate facial presentation-attack detection (PAD) using the dual-model ensemble of MiniFASNetV2 & MiniFASNetV1SE.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Upload className="w-4 h-4" /> Choose Photo
          </button>
          <button
            type="button"
            disabled={!selectedFile || isLoading}
            onClick={() => handleRunAnalysis()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {isLoading ? "Analyzing..." : "Run Liveness Check"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive flex items-center gap-3">
          <XCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{errorMessage}</p>
        </div>
      )}

      {/* Main Grid: Upload & Preview on Left, Results on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Image Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" /> Test Subject Image
            </h3>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative w-full aspect-square rounded-xl bg-muted/40 border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center overflow-hidden cursor-pointer group"
            >
              {previewUrl ? (
                <>
                  <Image
                    src={previewUrl}
                    alt="Subject preview"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                    Click to choose different image
                  </div>
                </>
              ) : (
                <div className="text-center p-6 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">Click to upload photo</p>
                  <p className="text-[11px] text-muted-foreground">JPG, PNG, or WebP up to 10MB</p>
                </div>
              )}
            </div>

            {selectedFile && (
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground font-mono">
                <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
              </div>
            )}
          </div>

          {/* Model Specification Details */}
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Ensemble Architecture
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              IntelliGuard fuses two multi-scale presentation attack detection networks trained on OULU-NPU, CASIA-MFSD, and Idiap Replay-Attack benchmarks:
            </p>
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60">
                <div className="font-semibold text-foreground">MiniFASNetV2 (Scale 2.7)</div>
                <div className="text-[11px] text-muted-foreground">Focuses on close facial contours, skin texture reflection, and high-frequency specular highlights.</div>
              </div>
              <div className="p-2.5 rounded-xl bg-muted/30 border border-border/60">
                <div className="font-semibold text-foreground">MiniFASNetV1SE (Scale 4.0)</div>
                <div className="text-[11px] text-muted-foreground">Uses Squeeze-and-Excitation channel attention with wide contextual framing to capture phone bezels and moiré patterns.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Liveness Results & Diagnostics (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {result ? (
            <div className="space-y-4">
              {/* Verdict Card */}
              {(() => {
                const badge = getStatusBadge(result.liveness.status);
                return (
                  <div className={`p-6 rounded-2xl border ${badge.bg} space-y-3 shadow-sm`}>
                    <div className="flex items-center gap-2.5">
                      {badge.icon}
                      <span className="text-base font-extrabold tracking-wide uppercase">
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{badge.desc}</p>
                  </div>
                );
              })()}

              {/* Confidence Score Bar */}
              {(() => {
                const liveThresh = typeof result.liveness.liveThreshold === "number" ? result.liveness.liveThreshold : null;
                const spoofThresh = typeof result.liveness.spoofThreshold === "number" ? result.liveness.spoofThreshold : null;

                return (
                  <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Ensemble Bona Fide Confidence
                      </span>
                      <span className="text-lg font-mono font-extrabold text-foreground">
                        {(result.liveness.liveScore * 100).toFixed(2)}%
                      </span>
                    </div>

                    <div className="relative w-full h-3.5 bg-muted rounded-full overflow-hidden flex">
                      {/* Active threshold markers */}
                      {spoofThresh !== null && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-destructive z-10"
                          style={{ left: `${Math.max(0, Math.min(100, spoofThresh * 100))}%` }}
                          title={`Active Spoof Threshold: ${(spoofThresh * 100).toFixed(0)}%`}
                        />
                      )}
                      {liveThresh !== null && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-emerald-500 z-10"
                          style={{ left: `${Math.max(0, Math.min(100, liveThresh * 100))}%` }}
                          title={`Active Live Threshold: ${(liveThresh * 100).toFixed(0)}%`}
                        />
                      )}
                      <div
                        style={{ width: `${Math.max(0, Math.min(100, result.liveness.liveScore * 100))}%` }}
                        className={`h-full transition-all duration-700 ${
                          result.liveness.status === "live"
                            ? "bg-emerald-500"
                            : result.liveness.status === "spoof_detected"
                            ? "bg-destructive"
                            : "bg-amber-500"
                        }`}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                      {spoofThresh !== null ? (
                        <span className="text-destructive font-semibold">Spoof &lt; {(spoofThresh * 100).toFixed(0)}%</span>
                      ) : (
                        <span />
                      )}
                      <span className="text-amber-500 font-semibold">Inconclusive</span>
                      {liveThresh !== null ? (
                        <span className="text-emerald-500 font-semibold">Live &ge; {(liveThresh * 100).toFixed(0)}%</span>
                      ) : (
                        <span />
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Sub-Model Breakdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(result.liveness.individualScores || {}).map(([modelName, score]) => {
                  const scorePct = (score * 100).toFixed(1);
                  const liveThresh = typeof result.liveness.liveThreshold === "number" ? result.liveness.liveThreshold : null;
                  const spoofThresh = typeof result.liveness.spoofThreshold === "number" ? result.liveness.spoofThreshold : null;
                  const isModelLive = liveThresh !== null ? score >= liveThresh : null;
                  const isModelSpoof = spoofThresh !== null ? score < spoofThresh : null;
                  const tagLabel = isModelLive === true ? "Live" : isModelSpoof === true ? "Spoof" : isModelLive !== null && isModelSpoof !== null ? "Marginal" : null;

                  return (
                    <div key={modelName} className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground truncate">{modelName}</span>
                        {tagLabel && (
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                              isModelLive
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : isModelSpoof
                                ? "bg-destructive/15 text-destructive"
                                : "bg-amber-500/15 text-amber-500"
                            }`}
                          >
                            {tagLabel}
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-baseline font-mono">
                        <span className="text-[11px] text-muted-foreground">Crop Scale:</span>
                        <span className="text-xs text-foreground">
                          {modelName.includes("V2") ? "2.7x" : "4.0x"}
                        </span>
                      </div>

                      <div className="flex justify-between items-baseline font-mono">
                        <span className="text-[11px] text-muted-foreground">Liveness Score:</span>
                        <span className="text-sm font-bold text-foreground">{scorePct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Telemetry Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-card border border-border rounded-xl text-center">
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Latency</div>
                  <div className="text-sm font-mono font-bold text-foreground flex items-center justify-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    {result.liveness.processingTimeMs} ms
                  </div>
                </div>

                <div className="p-3 bg-card border border-border rounded-xl text-center">
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Ensemble</div>
                  <div className="text-xs font-mono font-bold text-foreground capitalize">
                    {result.liveness.ensembleMethod || "Mean Fusion"}
                  </div>
                </div>

                <div className="p-3 bg-card border border-border rounded-xl text-center">
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Face Count</div>
                  <div className="text-sm font-mono font-bold text-foreground">
                    {result.faceCount}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[360px] space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-foreground">Awaiting Image for Liveness Verification</h4>
              <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
                Upload a genuine photo, a phone screen photograph, or a printed photo to test Presentation Attack Detection against both MiniFASNet models.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
