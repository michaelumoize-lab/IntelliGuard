"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  User,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Layers,
  ArrowRight,
} from "lucide-react";
import { AccessScanResponse } from "@/lib/access/access-client";

interface VectorInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: AccessScanResponse | null;
  capturedImageUrl?: string | null;
}

export function VectorInspectorModal({
  isOpen,
  onClose,
  result,
  capturedImageUrl,
}: VectorInspectorModalProps) {
  if (!result) return null;

  const similarity = result.face?.similarity ?? 0;
  const distance = result.face?.distance ?? (1 - similarity);
  const threshold = 0.5;
  const confidenceMargin = (similarity - threshold);
  const isMatch = similarity >= threshold;
  const quality = result.face?.quality_score ?? 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-card border-border p-6 shadow-xl space-y-4">
        <DialogHeader className="pb-3 border-b border-border/70">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Biometric Vector Similarity Breakdown
            </DialogTitle>
            <Badge
              variant={isMatch ? "default" : "destructive"}
              className="text-xs uppercase font-mono px-2.5 py-0.5"
            >
              {isMatch ? "Confidence: High" : "Confidence: Sub-threshold"}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Exact cosine similarity calculation between the live optical capture and enrolled database vector.
          </DialogDescription>
        </DialogHeader>

        {/* Visual Comparison: Live Capture vs Enrolled Face */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-border/80 bg-muted/20">
          <div className="flex flex-col items-center text-center space-y-2">
            <span className="text-[10px] font-mono font-semibold uppercase text-muted-foreground">
              Live Probe Frame
            </span>
            <div className="w-24 h-24 rounded-xl bg-black border border-border overflow-hidden flex items-center justify-center shadow-inner">
              {capturedImageUrl ? (
                <Image
                  src={capturedImageUrl}
                  alt="Live Probe"
                  width={96}
                  height={96}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">
              Face Quality: {(quality * 100).toFixed(0)}%
            </span>
          </div>

          <div className="flex flex-col items-center text-center space-y-2">
            <span className="text-[10px] font-mono font-semibold uppercase text-muted-foreground">
              Enrolled Template
            </span>
            <div className="w-24 h-24 rounded-xl bg-muted border border-border overflow-hidden flex items-center justify-center shadow-inner">
              {result.person?.face_image_url ? (
                <Image
                  src={result.person.face_image_url}
                  alt={result.person.first_name || "Template"}
                  width={96}
                  height={96}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">
              {result.person ? `${result.person.first_name} ${result.person.last_name}` : "No Profile"}
            </span>
          </div>
        </div>

        {/* Vector Metric Gauge */}
        <div className="p-4 rounded-xl border border-border/80 bg-card space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" /> Cosine Similarity Score
            </span>
            <span className="font-mono font-bold text-sm text-foreground">
              {(similarity * 100).toFixed(2)}%
            </span>
          </div>

          {/* Visual Progress Bar with Threshold Marker */}
          <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden border border-border/60">
            <div
              className={`h-full transition-all duration-500 ${
                isMatch ? "bg-emerald-500" : "bg-rose-500"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, similarity * 100))}%` }}
            />
            {/* 50% Threshold Tick */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-foreground/80 z-10"
              style={{ left: "50%" }}
            />
          </div>

          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>0.00 (Orthogonal)</span>
            <span className="text-foreground font-semibold">Decision Threshold: 0.50</span>
            <span>1.00 (Identical)</span>
          </div>
        </div>

        {/* Detailed Metrics Table */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
          <div className="p-2.5 rounded-lg border border-border bg-muted/30">
            <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Cosine Distance</span>
            <span className="font-bold text-foreground">{distance.toFixed(4)}</span>
          </div>
          <div className="p-2.5 rounded-lg border border-border bg-muted/30">
            <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Confidence Margin</span>
            <span className={`font-bold ${confidenceMargin >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {confidenceMargin >= 0 ? `+${(confidenceMargin * 100).toFixed(1)}%` : `${(confidenceMargin * 100).toFixed(1)}%`}
            </span>
          </div>
          <div className="p-2.5 rounded-lg border border-border bg-muted/30">
            <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Vector Dimension</span>
            <span className="font-bold text-foreground">512 Floats</span>
          </div>
          <div className="p-2.5 rounded-lg border border-border bg-muted/30">
            <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Neural Model</span>
            <span className="font-bold text-foreground truncate block">{result.face?.model || "Buffalo_S"}</span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button size="sm" variant="outline" onClick={onClose}>
            Close Inspector
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
