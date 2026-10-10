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
    <div className="w-full bg-card text-card-foreground border border-border rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
      {/* Control Buttons */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full xl:w-auto">
        {/* Camera Toggle Button */}
        <button
          onClick={onToggleCamera}
          className={`px-4 py-2.5 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 border cursor-pointer ${
            isCameraOn
              ? "bg-secondary hover:bg-muted border-border text-foreground"
              : "bg-primary hover:bg-primary/90 text-primary-foreground border-primary"
          }`}
        >
          {isCameraOn ? (
            <>
              <VideoOff className="w-4 h-4 text-destructive shrink-0" />
              <span>Turn Off Camera</span>
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
          className="px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 border border-primary/20 cursor-pointer disabled:cursor-not-allowed"
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
          className={`px-4 py-2.5 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 border cursor-pointer disabled:cursor-not-allowed ${
            isMonitoring
              ? "bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20"
              : "bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white"
          } disabled:bg-muted disabled:border-border disabled:text-muted-foreground`}
        >
          {isMonitoring ? (
            <>
              <Square className="w-4 h-4 fill-current shrink-0" />
              <span>Stop Monitoring</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current shrink-0" />
              <span>Start Monitoring</span>
            </>
          )}
        </button>

        {/* Audio Chime Feedback Toggle */}
        {onToggleSound && (
          <button
            type="button"
            onClick={onToggleSound}
            className={`px-3 py-2.5 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
              soundEnabled
                ? "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
                : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
            }`}
            title={soundEnabled ? "Audio Chime: Active" : "Audio Chime: Muted"}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <VolumeX className="w-4 h-4 shrink-0" />
            )}
            <span className="hidden sm:inline">{soundEnabled ? "Audio On" : "Muted"}</span>
          </button>
        )}
      </div>

      {/* Telemetry Stats Bar */}
      <div className="flex flex-wrap items-center justify-between xl:justify-end gap-3 sm:gap-6 w-full xl:w-auto text-xs text-muted-foreground pt-3 xl:pt-0 border-t xl:border-t-0 border-border">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground shrink-0" />
          <span>Scans Executed:</span>
          <span className="font-mono font-bold text-foreground">{scanCount}</span>
        </div>

        {lastScanTime && (
          <div className="flex items-center gap-2">
            <span>Last Scan:</span>
            <span className="font-mono text-foreground font-medium">{lastScanTime}</span>
          </div>
        )}
      </div>
    </div>
  );
}
