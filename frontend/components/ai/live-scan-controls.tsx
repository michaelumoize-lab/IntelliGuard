"use client";

import React from "react";
import { Camera, Play, Square, Loader2, Activity, Video, VideoOff, Volume2, VolumeX } from "lucide-react";

interface LiveScanControlsProps {
  isCameraOn: boolean;
  onToggleCamera: () => void;
  onScan: () => void;
  isMonitoring: boolean;
  onToggleMonitoring: () => void;
  isCameraReady: boolean;
  isScanning: boolean;
  scanCount: number;
  lastScanTime: string | null;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
}

export function LiveScanControls({
  isCameraOn,
  onToggleCamera,
  onScan,
  isMonitoring,
  onToggleMonitoring,
  isCameraReady,
  isScanning,
  scanCount,
  lastScanTime,
  soundEnabled = true,
  onToggleSound,
}: LiveScanControlsProps) {
  return (
    <div className="w-full bg-card/90 backdrop-blur-md text-card-foreground border border-border/80 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3 sm:space-y-3.5 transition-all">
      {/* Control Action Buttons: Mobile 2-column grid, Desktop flex row */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5">
        {/* 1. Camera Power Toggle */}
        <button
          type="button"
          onClick={onToggleCamera}
          className={`h-11 sm:h-10 px-3.5 sm:px-4 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 border cursor-pointer select-none active:scale-[0.98] ${
            isCameraOn
              ? "bg-muted/80 hover:bg-muted border-border text-foreground hover:text-destructive hover:border-destructive/30"
              : "bg-primary hover:bg-primary/90 text-primary-foreground border-primary shadow-primary/25"
          }`}
        >
          {isCameraOn ? (
            <>
              <VideoOff className="w-4 h-4 text-destructive shrink-0" />
              <span>Turn Off</span>
            </>
          ) : (
            <>
              <Video className="w-4 h-4 shrink-0" />
              <span>Turn On Camera</span>
            </>
          )}
        </button>

        {/* 2. Manual Scan Action Button */}
        <button
          type="button"
          onClick={onScan}
          disabled={!isCameraOn || !isCameraReady || isScanning || isMonitoring}
          className="h-11 sm:h-10 px-4 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 border border-primary/30 bg-primary hover:bg-primary/90 text-primary-foreground disabled:bg-muted/60 disabled:border-border/60 disabled:text-muted-foreground cursor-pointer disabled:cursor-not-allowed select-none active:scale-[0.98] relative overflow-hidden"
        >
          {isScanning && !isMonitoring ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-primary-foreground shrink-0" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4 shrink-0" />
              <span>Scan Face</span>
            </>
          )}
        </button>

        {/* 3. Continuous Monitoring Auto-Scan */}
        <button
          type="button"
          onClick={onToggleMonitoring}
          disabled={!isCameraOn || !isCameraReady}
          className={`h-11 sm:h-10 px-3.5 sm:px-4 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 border cursor-pointer disabled:cursor-not-allowed select-none active:scale-[0.98] ${
            isMonitoring
              ? "bg-destructive/15 border-destructive/40 text-destructive hover:bg-destructive/25 ring-2 ring-destructive/20 animate-pulse"
              : "bg-emerald-600 hover:bg-emerald-600/90 border-emerald-500/80 text-white shadow-emerald-600/20 shadow-sm"
          } disabled:bg-muted/60 disabled:border-border/60 disabled:text-muted-foreground`}
        >
          {isMonitoring ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current shrink-0" />
              <span>Stop Auto</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current shrink-0" />
              <span>Live Auto (2.5s)</span>
            </>
          )}
        </button>

        {/* 4. Audio Feedback Toggle */}
        {onToggleSound && (
          <button
            type="button"
            onClick={onToggleSound}
            className={`h-11 sm:h-10 px-3.5 sm:px-3 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 border cursor-pointer select-none active:scale-[0.98] ${
              soundEnabled
                ? "bg-primary/10 border-primary/25 text-primary hover:bg-primary/20"
                : "bg-muted/60 border-border/70 text-muted-foreground hover:bg-muted"
            }`}
            title={soundEnabled ? "Audio Chime: Active" : "Audio Chime: Muted"}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <VolumeX className="w-4 h-4 text-muted-foreground/70 shrink-0" />
            )}
            <span className="text-[11px]">{soundEnabled ? "Audio On" : "Muted"}</span>
          </button>
        )}
      </div>

      {/* Telemetry Status Bar: Scans Executed & Recent Time */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/60">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 border border-border/70 text-[11px]">
            <Activity className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Scans:</span>
            <span className="font-mono font-bold text-foreground">{scanCount}</span>
          </div>

          {lastScanTime && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 border border-border/70 text-[11px]">
              <span>Last:</span>
              <span className="font-mono text-foreground font-semibold">{lastScanTime}</span>
            </div>
          )}
        </div>

        {/* Continuous mode badge indicator */}
        {isMonitoring && (
          <div className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Continuous Polling</span>
          </div>
        )}
      </div>
    </div>
  );
}
