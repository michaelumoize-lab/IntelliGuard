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
    <div className="w-full bg-card/80 backdrop-blur-sm text-card-foreground border border-border/80 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 transition-all">
      {/* Control Buttons Group */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        {/* Camera Toggle Button */}
        <button
          onClick={onToggleCamera}
          className={`px-3.5 py-2.5 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 border cursor-pointer select-none active:scale-[0.98] ${
            isCameraOn
              ? "bg-muted/70 hover:bg-muted border-border text-foreground hover:text-destructive"
              : "bg-primary hover:bg-primary/90 text-primary-foreground border-primary shadow-primary/20"
          }`}
        >
          {isCameraOn ? (
            <>
              <VideoOff className="w-4 h-4 text-destructive/80 shrink-0" />
              <span>Turn Off</span>
            </>
          ) : (
            <>
              <Video className="w-4 h-4 shrink-0" />
              <span>Turn On Camera</span>
            </>
          )}
        </button>

        {/* Manual Scan Button */}
        <button
          onClick={onScan}
          disabled={!isCameraOn || !isCameraReady || isScanning || isMonitoring}
          className="px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-muted/60 disabled:text-muted-foreground text-primary-foreground font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 border border-primary/30 cursor-pointer disabled:cursor-not-allowed select-none active:scale-[0.98]"
        >
          {isScanning && !isMonitoring ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary-foreground shrink-0" />
          ) : (
            <Camera className="w-4 h-4 shrink-0" />
          )}
          <span>Scan Face</span>
        </button>

        {/* Continuous Monitoring Toggle */}
        <button
          onClick={onToggleMonitoring}
          disabled={!isCameraOn || !isCameraReady}
          className={`px-3.5 py-2.5 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 border cursor-pointer disabled:cursor-not-allowed select-none active:scale-[0.98] ${
            isMonitoring
              ? "bg-destructive/15 border-destructive/40 text-destructive hover:bg-destructive/25 ring-2 ring-destructive/20 animate-pulse"
              : "bg-emerald-600/90 hover:bg-emerald-600 border-emerald-500 text-white"
          } disabled:bg-muted/60 disabled:border-border disabled:text-muted-foreground`}
        >
          {isMonitoring ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current shrink-0" />
              <span>Stop Auto</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current shrink-0" />
              <span>Live Auto</span>
            </>
          )}
        </button>

        {/* Audio Chime Feedback Toggle */}
        {onToggleSound && (
          <button
            type="button"
            onClick={onToggleSound}
            className={`p-2.5 sm:px-3 sm:py-2.5 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 border cursor-pointer select-none active:scale-[0.98] ${
              soundEnabled
                ? "bg-primary/10 border-primary/25 text-primary hover:bg-primary/20"
                : "bg-muted/60 border-border text-muted-foreground hover:bg-muted"
            }`}
            title={soundEnabled ? "Audio Chime: Active" : "Audio Chime: Muted"}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <VolumeX className="w-4 h-4 text-muted-foreground/70 shrink-0" />
            )}
            <span className="hidden sm:inline text-[11px]">{soundEnabled ? "Audio" : "Mute"}</span>
          </button>
        )}
      </div>

      {/* Telemetry Stats Pills */}
      <div className="flex items-center justify-between md:justify-end gap-2 text-xs text-muted-foreground pt-2.5 md:pt-0 border-t md:border-t-0 border-border/60">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/40 border border-border/60 text-[11px]">
          <Activity className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
          <span>Scans:</span>
          <span className="font-mono font-bold text-foreground">{scanCount}</span>
        </div>

        {lastScanTime && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/40 border border-border/60 text-[11px]">
            <span>Last:</span>
            <span className="font-mono text-foreground font-medium">{lastScanTime}</span>
          </div>
        )}
      </div>
    </div>
  );
}
