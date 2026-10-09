"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { LiveCameraPreview, LiveCameraPreviewRef, CameraOverlayResult } from "@/components/ai/live-camera-preview";
import { AccessResultCard } from "@/components/ai/access-result-card";
import { LiveScanControls } from "@/components/ai/live-scan-controls";
import { scanFace, AccessScanResponse } from "@/lib/access/access-client";
import { playBiometricSound } from "@/lib/audio";
import { Camera, History, CheckCircle2, XCircle, AlertTriangle, HelpCircle, ShieldCheck, ShieldAlert } from "lucide-react";

export interface ScanHistoryItem {
  id: string;
  time: string;
  name: string;
  code: string;
  status: "granted" | "denied";
  matchStatus: string;
  similarity: number;
}

export default function WebcamSimulationPage() {
  const cameraRef = useRef<LiveCameraPreviewRef | null>(null);

  const [isCameraOn, setIsCameraOn] = useState<boolean>(false);
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [latestResult, setLatestResult] = useState<AccessScanResponse | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [cameraOverlay, setCameraOverlay] = useState<CameraOverlayResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [scanCount, setScanCount] = useState<number>(0);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  // Refs for race-condition & stale response guards
  const isMonitoringRef = useRef<boolean>(false);
  const isCameraOnRef = useRef<boolean>(false);
  const inFlightRef = useRef<boolean>(false);
  const requestSequenceRef = useRef<number>(0);

  useEffect(() => {
    isMonitoringRef.current = isMonitoring;
  }, [isMonitoring]);

  useEffect(() => {
    isCameraOnRef.current = isCameraOn;
  }, [isCameraOn]);

  // Turn Camera On / Off
  const handleToggleCamera = useCallback(() => {
    setIsCameraOn((prev) => {
      const next = !prev;
      if (!next) {
        setIsMonitoring(false);
        setIsCameraReady(false);
        setCameraOverlay(null);
      }
      return next;
    });
  }, []);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (capturedImageUrl && capturedImageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(capturedImageUrl);
      }
    };
  }, [capturedImageUrl]);

  // Execute a single face scan
  const executeScan = useCallback(async () => {
    if (!isCameraOnRef.current || !cameraRef.current || inFlightRef.current) return;

    const requestSeq = ++requestSequenceRef.current;
    inFlightRef.current = true;
    setIsScanning(true);

    try {
      const imageBlob = await cameraRef.current.captureFrame();
      if (!imageBlob || !isCameraOnRef.current || requestSeq !== requestSequenceRef.current) {
        inFlightRef.current = false;
        setIsScanning(false);
        return;
      }

      // Create snapshot URL for side-by-side comparison
      const previewUrl = URL.createObjectURL(imageBlob);
      setCapturedImageUrl(previewUrl);

      const response = await scanFace(imageBlob);

      // Stale Response Guard: if camera was stopped or a newer scan began in flight, discard result
      if (!isCameraOnRef.current || requestSeq !== requestSequenceRef.current) {
        return;
      }

      setLatestResult(response);
      const timeStr = new Date().toLocaleTimeString();
      setLastScanTime(timeStr);
      setScanCount((prev) => prev + 1);

      // Auditory Feedback Chime
      if (soundEnabled) {
        playBiometricSound(response.access_status === "granted" ? "granted" : "denied");
      }

      // Display HUD Banner Overlay for 3.5s
      const personName = response.person
        ? `${response.person.first_name} ${response.person.last_name}`
        : undefined;

      const isDeactivated = Boolean(
        response.person &&
        (response.person.status || "active").toLowerCase() !== "active"
      );

      setCameraOverlay({
        status: isDeactivated ? "deactivated" : response.access_status,
        name: isDeactivated ? `${personName || "User"} (Deactivated)` : personName,
        similarity: response.face?.similarity,
      });

      setTimeout(() => {
        setCameraOverlay((current) => (current?.name === (isDeactivated ? `${personName || "User"} (Deactivated)` : personName) ? null : current));
      }, 3500);

      // Add to local scan history (limit to 10 entries)
      const historyEntry: ScanHistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        time: timeStr,
        name: isDeactivated
          ? `${personName} (User is deactivated)`
          : response.person
          ? `${response.person.first_name} ${response.person.last_name}`
          : response.match_status === "ambiguous"
          ? "Ambiguous Match"
          : "Unknown Face",
        code: response.person ? response.person.person_code : "N/A",
        status: response.access_status,
        matchStatus: isDeactivated ? "deactivated" : response.match_status,
        similarity: response.face ? response.face.similarity : 0,
      };

      setScanHistory((prev) => [historyEntry, ...prev].slice(0, 10));
    } catch (err) {
      console.error("Error executing webcam face scan:", err);
    } finally {
      inFlightRef.current = false;
      setIsScanning(false);
    }
  }, [soundEnabled]);

  // Continuous monitoring timer loop (2.5s interval)
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isCameraOn && isMonitoring && isCameraReady) {
      executeScan();

      intervalId = setInterval(() => {
        if (isMonitoringRef.current && isCameraOnRef.current && !inFlightRef.current) {
          executeScan();
        }
      }, 2500);
    } else {
      if (intervalId) clearInterval(intervalId);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isCameraOn, isMonitoring, isCameraReady, executeScan]);

  const handleToggleMonitoring = () => {
    if (!isCameraOn) return;
    setIsMonitoring((prev) => !prev);
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6 sm:space-y-8 bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-primary/10 border border-primary/20 text-primary rounded-xl shrink-0">
              <Camera className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Live Webcam Access Simulation</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Real-time biometric terminal testing with live HUD scanning, auditory feedback, and side-by-side profile verification.
          </p>
        </div>
      </div>

      {/* Main Grid: Camera Feed & Decision Result Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live Camera Feed with Biometric HUD & Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <LiveCameraPreview
            ref={cameraRef}
            isCameraOn={isCameraOn}
            onToggleCamera={handleToggleCamera}
            onCameraStatusChange={setIsCameraReady}
            isScanning={isScanning}
            overlayResult={cameraOverlay}
          />

          {/* Scan Control Panel directly under Camera Preview */}
          <LiveScanControls
            isCameraOn={isCameraOn}
            onToggleCamera={handleToggleCamera}
            onScan={executeScan}
            isMonitoring={isMonitoring}
            onToggleMonitoring={handleToggleMonitoring}
            isCameraReady={isCameraReady}
            isScanning={isScanning}
            scanCount={scanCount}
            lastScanTime={lastScanTime}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled((prev) => !prev)}
          />
        </div>

        {/* Right Column: Access Decision Result Card with Side-by-Side Verification (5 cols) */}
        <div className="lg:col-span-5 h-full">
          <AccessResultCard
            result={latestResult}
            isLoading={isScanning && !latestResult}
            capturedImageUrl={capturedImageUrl}
          />
        </div>
      </div>

      {/* Recent Scan History List */}
      <div className="bg-card text-card-foreground border border-border rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Recent Simulation Scan History</h3>
          </div>
          <span className="text-xs text-muted-foreground font-mono">Max 10 Scans</span>
        </div>

        {scanHistory.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No scans executed during this session yet. Turn on camera and click &quot;Scan Face&quot;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground font-mono uppercase text-[10px] tracking-wider">
                  <th className="pb-3 font-semibold font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Time</th>
                  <th className="pb-3 font-semibold font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Decision</th>
                  <th className="pb-3 font-semibold font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Individual</th>
                  <th className="pb-3 font-semibold font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Person Code</th>
                  <th className="pb-3 text-right font-semibold font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Similarity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {scanHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 font-mono text-muted-foreground">{item.time}</td>
                    <td className="py-3">
                      {item.status === "granted" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> GRANTED
                        </span>
                      ) : item.matchStatus === "deactivated" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-destructive/15 border border-destructive/30 text-destructive font-semibold text-[11px]">
                          <ShieldAlert className="w-3.5 h-3.5" /> USER DEACTIVATED
                        </span>
                      ) : item.matchStatus === "ambiguous" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 font-semibold text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5" /> AMBIGUOUS
                        </span>
                      ) : item.matchStatus === "unknown" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold text-[11px] border border-border">
                          <HelpCircle className="w-3.5 h-3.5" /> UNKNOWN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-destructive/10 border border-destructive/20 text-destructive font-semibold text-[11px]">
                          <XCircle className="w-3.5 h-3.5" /> DENIED
                        </span>
                      )}
                    </td>
                    <td className="py-3 font-medium text-foreground">{item.name}</td>
                    <td className="py-3 font-mono text-muted-foreground">{item.code}</td>
                    <td className="py-3 font-mono text-right font-semibold text-foreground">
                      {item.similarity < 0 ? "< 0%" : `${(item.similarity * 100).toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
