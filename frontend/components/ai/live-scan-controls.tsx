"use client";

import React from "react";
import { Camera, Play, Square, Loader2, Activity, Video, VideoOff } from "lucide-react";

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
}: LiveScanControlsProps) {
  return (
    <div className="w-full bg-card text-card-foreground border border-border rounded-xl p-5 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
      {/* Control Buttons */}
      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
        {/* Camera Toggle Button */}
        <button
          onClick={onToggleCamera}
          className={`flex-1 sm:flex-none px-4 py-2.5 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 border ${
            isCameraOn
              ? "bg-secondary hover:bg-muted border-border text-foreground"
              : "bg-primary hover:bg-primary/90 text-primary-foreground border-primary"
          }`}
        >
          {isCameraOn ? (
            <>
              <VideoOff className="w-4 h-4 text-destructive" />
              <span>Turn Off Camera</span>
            </>
          ) : (
            <>
              <Video className="w-4 h-4" />
              <span>Turn On Camera</span>
            </>
          )}
        </button>

        {/* Manual Scan Button */}
        <button
          onClick={onScan}
          disabled={!isCameraOn || !isCameraReady || isScanning || isMonitoring}
          className="flex-1 sm:flex-none px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 border border-primary/20"
        >
          {isScanning && !isMonitoring ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary-foreground" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
          <span>Scan Face</span>
        </button>

        {/* Continuous Monitoring Toggle */}
        <button
          onClick={onToggleMonitoring}
          disabled={!isCameraOn || !isCameraReady}
          className={`flex-1 sm:flex-none px-4 py-2.5 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 border ${
            isMonitoring
              ? "bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20"
              : "bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white"
          } disabled:bg-muted disabled:border-border disabled:text-muted-foreground`}
        >
          {isMonitoring ? (
            <>
              <Square className="w-4 h-4 fill-current" />
              <span>Stop Monitoring</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Start Monitoring</span>
            </>
          )}
        </button>
      </div>

      {/* Telemetry Stats Bar */}
      <div className="flex items-center justify-between lg:justify-end gap-6 w-full lg:w-auto text-xs text-muted-foreground pt-3 lg:pt-0 border-t lg:border-t-0 border-border">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span>Scans Executed:</span>
          <span className="font-mono font-bold text-foreground">{scanCount}</span>
        </div>

        {lastScanTime && (
          <div className="flex items-center gap-1.5 font-mono text-muted-foreground">
            <span className="text-[10px] uppercase text-muted-foreground/70">Last Scan:</span>
            <span>{lastScanTime}</span>
          </div>
        )}

        {isMonitoring && (
          <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>2.5s Auto Loop</span>
          </div>
        )}
      </div>
    </div>
  );
}
