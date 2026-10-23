"use client";

import React from "react";
import { AccessScanResponse } from "@/lib/access/access-client";
import { Radio, Volume2, ShieldCheck, ShieldAlert, Cpu } from "lucide-react";

interface HardwareTerminalHUDProps {
  result: AccessScanResponse | null;
  isScanning: boolean;
  isMonitoring: boolean;
  soundEnabled: boolean;
}

export function HardwareTerminalHUD({
  result,
  isScanning,
  isMonitoring,
  soundEnabled,
}: HardwareTerminalHUDProps) {
  // Determine simulated peripheral states based on access control decision
  let oledLine1 = "ESP32-S3 READY";
  let oledLine2 = isMonitoring ? "PIR: MONITORING" : "PIR: STANDBY";
  let oledLine3 = "HOLD POSITION";
  let ledColor = "bg-blue-500 shadow-[0_0_12px_#3b82f6]";
  let ledLabel = "IDLE (BLUE)";
  let buzzerState = "OFF";

  if (isScanning || result?.status === "face_detected_processing") {
    oledLine1 = "MOTION DETECTED";
    oledLine2 = "CAPTURING JPEG...";
    oledLine3 = "AI INFERENCE...";
    ledColor = "bg-cyan-400 shadow-[0_0_14px_#22d3ee] animate-pulse";
    ledLabel = "SCANNING (CYAN)";
    buzzerState = "PULSE";
  } else if (result) {
    if (result.access_status === "granted") {
      oledLine1 = "ACCESS GRANTED";
      oledLine2 = result.person ? `${result.person.first_name.toUpperCase()} ${result.person.last_name.toUpperCase()}` : "VERIFIED";
      oledLine3 = "DOOR: UNLOCKED";
      ledColor = "bg-emerald-500 shadow-[0_0_16px_#10b981]";
      ledLabel = "UNLOCKED (GREEN)";
      buzzerState = "CHIME (BEEP)";
    } else if (
      result.status === "spoof_detected" ||
      result.reason === "spoof_detected" ||
      result.liveness?.status === "spoof_detected"
    ) {
      oledLine1 = "SPOOF DETECTED";
      oledLine2 = "ATTACK BLOCKED";
      oledLine3 = "DOOR: LOCKED";
      ledColor = "bg-rose-600 shadow-[0_0_16px_#e11d48] animate-ping";
      ledLabel = "SPOOF ATTACK (RED)";
      buzzerState = "ALARM (PULSE)";
    } else if (
      result.status === "liveness_inconclusive" ||
      result.liveness?.status === "inconclusive"
    ) {
      oledLine1 = "LIVENESS UNCERTAIN";
      oledLine2 = "PLEASE RETRY";
      oledLine3 = "DOOR: LOCKED";
      ledColor = "bg-amber-400 shadow-[0_0_14px_#f59e0b]";
      ledLabel = "INCONCLUSIVE (AMBER)";
      buzzerState = "WARN BEEP";
    } else if (result.reason === "unauthorized") {
      oledLine1 = "ACCESS DENIED";
      oledLine2 = result.person ? `${result.person.first_name.toUpperCase()}` : "UNAUTHORIZED";
      oledLine3 = "ACCOUNT SUSPENDED";
      ledColor = "bg-rose-500 shadow-[0_0_16px_#f43f5e] animate-ping";
      ledLabel = "BLOCKED (RED)";
      buzzerState = "ALARM (FAST)";
    } else if (result.status === "no_person" || result.reason === "no_person_detected") {
      oledLine1 = "NO PERSON";
      oledLine2 = "FRAME EMPTY";
      oledLine3 = "DOOR: LOCKED";
      ledColor = "bg-slate-500 shadow-[0_0_10px_#64748b]";
      ledLabel = "IDLE (GRAY)";
      buzzerState = "OFF";
    } else if (result.status === "person_no_face" || result.reason === "no_face_detected") {
      oledLine1 = "PERSON DETECTED";
      oledLine2 = "NO FACE VISIBLE";
      oledLine3 = "DOOR: LOCKED";
      ledColor = "bg-cyan-500 shadow-[0_0_12px_#06b6d4]";
      ledLabel = "POSITION FACE (CYAN)";
      buzzerState = "OFF";
    } else if (result.status === "face_low_quality" || result.reason === "poor_quality_face") {
      oledLine1 = "LOW QUALITY FACE";
      oledLine2 = "LOOK AT CAMERA";
      oledLine3 = "DOOR: LOCKED";
      ledColor = "bg-amber-400 shadow-[0_0_14px_#f59e0b]";
      ledLabel = "LOW QUALITY (AMBER)";
      buzzerState = "WARN BEEP";
    } else if (result.match_status === "unknown" || result.status === "unknown_individual") {
      oledLine1 = "ACCESS DENIED";
      oledLine2 = "UNKNOWN PERSON";
      oledLine3 = "DOOR: LOCKED";
      ledColor = "bg-rose-500 shadow-[0_0_14px_#f43f5e]";
      ledLabel = "DENIED (RED)";
      buzzerState = "DOUBLE BEEP";
    } else if (result.match_status === "ambiguous") {
      oledLine1 = "ACCESS DENIED";
      oledLine2 = "AMBIGUOUS MATCH";
      oledLine3 = "DOOR: LOCKED";
      ledColor = "bg-amber-400 shadow-[0_0_14px_#f59e0b]";
      ledLabel = "AMBIGUOUS (AMBER)";
      buzzerState = "WARN BEEP";
    } else if (result.reason === "system_error") {
      oledLine1 = "SYSTEM ERROR";
      oledLine2 = "FAIL-SAFE LOCKED";
      oledLine3 = "DOOR: LOCKED";
      ledColor = "bg-rose-600 shadow-[0_0_16px_#e11d48]";
      ledLabel = "ERROR (RED)";
      buzzerState = "ERROR TONE";
    }
  }

  return (
    <div className="p-4 rounded-2xl border border-border/80 bg-black/90 text-white shadow-xl space-y-4 font-mono">
      {/* Hardware Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/10 text-xs">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-white tracking-wider text-[11px]">
            ESP32-S3 HARDWARE TERMINAL SIMULATOR
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-white/60">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>I2C BUS ONLINE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* 1. Simulated 0.96" SSD1306 OLED Display */}
        <div className="p-3 bg-blue-950/40 rounded-xl border-2 border-blue-500/40 shadow-inner flex flex-col justify-between min-h-[105px]">
          <div className="flex items-center justify-between text-[10px] text-cyan-400/80 pb-1 border-b border-blue-500/20">
            <span>SSD1306 OLED (128x64)</span>
            <span>0x3C</span>
          </div>
          <div className="space-y-0.5 py-1 text-center">
            <p className="text-xs font-bold text-cyan-300 tracking-wider truncate">{oledLine1}</p>
            <p className="text-[11px] font-semibold text-cyan-200 tracking-wide truncate">{oledLine2}</p>
            <p className="text-[10px] text-cyan-400/80 tracking-widest">{oledLine3}</p>
          </div>
          <div className="text-[9px] text-right text-cyan-500/60 pt-0.5">
            {isScanning ? "FRAME_TX_OK" : "STANDBY"}
          </div>
        </div>

        {/* 2. Simulated Actuators: RGB LED & Buzzer */}
        <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex flex-col justify-between min-h-[105px]">
          <div className="flex items-center justify-between text-[10px] text-white/60 pb-1 border-b border-white/10">
            <span>KY-016 RGB &bull; KY-012 BUZZER</span>
            <span>GPIO 4 / 5</span>
          </div>

          <div className="grid grid-cols-2 gap-2 py-1 items-center">
            {/* RGB LED */}
            <div className="flex flex-col items-center justify-center text-center space-y-1">
              <span className={`w-5 h-5 rounded-full ${ledColor} border border-white/30 transition-all`} />
              <span className="text-[9px] text-white/70 tracking-tight">{ledLabel}</span>
            </div>

            {/* Active Buzzer */}
            <div className="flex flex-col items-center justify-center text-center space-y-1">
              <div className="flex items-center gap-1 text-white/80">
                <Volume2 className={`w-4 h-4 ${buzzerState !== "OFF" ? "text-amber-400 animate-bounce" : "text-white/40"}`} />
              </div>
              <span className="text-[9px] text-white/70 tracking-tight">{buzzerState}</span>
            </div>
          </div>

          <div className="text-[9px] text-white/40 text-center pt-0.5">
            AUDIO CHIME: {soundEnabled ? "ENABLED" : "MUTED"}
          </div>
        </div>
      </div>
    </div>
  );
}
