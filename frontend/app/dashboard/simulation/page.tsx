"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  LiveCameraPreview,
  LiveCameraPreviewRef,
  CameraOverlayResult,
  DetectedPersonOverlay,
  DetectedFaceOverlay,
} from "@/components/ai/live-camera-preview";
import { AccessResultCard } from "@/components/ai/access-result-card";
import { LiveScanControls } from "@/components/ai/live-scan-controls";
import { scanFace, AccessScanResponse } from "@/lib/access/access-client";
import { playBiometricSound } from "@/lib/audio";
import {
  Camera,
  History,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  ShieldAlert,
  User,
  Users,
} from "lucide-react";

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
  const [detectedPersons, setDetectedPersons] = useState<DetectedPersonOverlay[]>([]);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFaceOverlay[]>([]);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [scanCount, setScanCount] = useState<number>(0);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  // Guards against race conditions, overlapping requests, and stale responses
  const isMonitoringRef = useRef<boolean>(false);
  const isCameraOnRef = useRef<boolean>(false);
  const inFlightRef = useRef<boolean>(false);
  const requestSequenceRef = useRef<number>(0);
  const soundEnabledRef = useRef<boolean>(soundEnabled);
  const overlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoOffTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isMonitoringRef.current = isMonitoring;
  }, [isMonitoring]);

  useEffect(() => {
    isCameraOnRef.current = isCameraOn;
  }, [isCameraOn]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Turn Camera On / Off
  const handleToggleCamera = useCallback(() => {
    setIsCameraOn((prev) => {
      const next = !prev;
      if (!next) {
        setIsMonitoring(false);
        setIsCameraReady(false);
        setCameraOverlay(null);
        setDetectedPersons([]);
        setDetectedFaces([]);
        setImageDimensions(null);
        if (overlayTimerRef.current) {
          clearTimeout(overlayTimerRef.current);
          overlayTimerRef.current = null;
        }
        if (autoOffTimerRef.current) {
          clearTimeout(autoOffTimerRef.current);
          autoOffTimerRef.current = null;
        }
      }
      return next;
    });
  }, []);

  const handleCameraStatusChange = useCallback((ready: boolean) => {
    setIsCameraReady(ready);
    if (!ready) {
      setIsMonitoring(false);
    }
  }, []);

  const capturedImageUrlRef = useRef<string | null>(null);
  useEffect(() => {
    capturedImageUrlRef.current = capturedImageUrl;
  }, [capturedImageUrl]);

  // Cleanup blob URLs and timers on unmount
  useEffect(() => {
    return () => {
      if (capturedImageUrlRef.current && capturedImageUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(capturedImageUrlRef.current);
      }
      if (overlayTimerRef.current) {
        clearTimeout(overlayTimerRef.current);
      }
      if (autoOffTimerRef.current) {
        clearTimeout(autoOffTimerRef.current);
      }
    };
  }, []);

  // Execute a single face scan
  const executeScan = useCallback(async () => {
    if (!isCameraOnRef.current || !cameraRef.current || inFlightRef.current) return;

    const requestSeq = ++requestSequenceRef.current;
    inFlightRef.current = true;
    setIsScanning(true);

    // Show client-side in-flight processing state immediately on HUD
    setCameraOverlay({
      status: "processing",
      message: "Processing biometrics...",
    });

    try {
      const imageBlob = await cameraRef.current.captureFrame();
      if (!imageBlob || !isCameraOnRef.current || requestSeq !== requestSequenceRef.current) {
        inFlightRef.current = false;
        setIsScanning(false);
        return;
      }

      // Create snapshot URL for side-by-side comparison
      const previewUrl = URL.createObjectURL(imageBlob);
      setCapturedImageUrl((prev) => {
        if (prev && prev.startsWith("blob:")) {
          URL.revokeObjectURL(prev);
        }
        return previewUrl;
      });

      const response = await scanFace(imageBlob);

      // Stale Response Guard: if camera was stopped or a newer scan began in flight, discard result
      if (!isCameraOnRef.current || requestSeq !== requestSequenceRef.current) {
        return;
      }

      setLatestResult(response);
      const timeStr = new Date().toLocaleTimeString();
      setLastScanTime(timeStr);
      setScanCount((prev) => prev + 1);

      // Update AI Person & Face Detection Overlays (with smooth 150ms anti-flicker reset)
      if (response.persons && response.persons.length > 0) {
        setDetectedPersons(
          response.persons.map((p) => ({
            bbox: p.bbox,
            confidence: p.confidence,
            isPrimary: p.is_primary,
          }))
        );
      } else if (response.person_bbox) {
        setDetectedPersons([
          {
            bbox: response.person_bbox,
            confidence: 1.0,
            isPrimary: true,
          },
        ]);
      } else {
        setDetectedPersons([]);
      }

      if (response.faces && response.faces.length > 0) {
        setDetectedFaces(
          response.faces.map((f) => ({
            bbox: f.bbox,
            confidence: f.confidence,
            landmarks: f.landmarks,
          }))
        );
      } else if (response.face_bbox) {
        setDetectedFaces([
          {
            bbox: response.face_bbox,
            confidence: 1.0,
          },
        ]);
      } else {
        setDetectedFaces([]);
      }

      if (response.image_width && response.image_height) {
        setImageDimensions({
          width: response.image_width,
          height: response.image_height,
        });
      }

      const isDeactivated = Boolean(
        response.person &&
        (response.person.status || "active").toLowerCase() !== "active"
      );

      // Auditory Feedback Chime (reading stable ref so callback does not rebind)
      // Only chime for authenticated pass or evaluated unauthorized intruder - NEVER for empty or faceless frames
      if (soundEnabledRef.current) {
        if (response.access_status === "granted") {
          playBiometricSound("granted");
        } else if (
          response.status === "unknown_individual" ||
          response.match_status === "unknown" ||
          isDeactivated
        ) {
          playBiometricSound("denied");
        }
      }

      // Display HUD Banner Overlay for 3.5s
      const personName = response.person
        ? `${response.person.first_name} ${response.person.last_name}`
        : undefined;

      let overlayStatus: CameraOverlayResult["status"] = "denied";
      if (response.status === "no_person") {
        overlayStatus = "no_person";
      } else if (response.status === "person_no_face") {
        overlayStatus = "person_no_face";
      } else if (response.status === "face_low_quality") {
        overlayStatus = "face_low_quality";
      } else if (response.status === "recognition_error") {
        overlayStatus = "error";
      } else if (isDeactivated) {
        overlayStatus = "deactivated";
      } else if (response.access_status === "granted") {
        overlayStatus = "granted";
      } else if (response.match_status === "ambiguous") {
        overlayStatus = "ambiguous";
      } else if (response.match_status === "unknown" || response.status === "unknown_individual") {
        overlayStatus = "unknown";
      } else {
        overlayStatus = "denied";
      }

      setCameraOverlay({
        status: overlayStatus,
        name: isDeactivated ? `${personName || "User"} (Deactivated)` : personName,
        similarity: response.face?.similarity,
        message: response.message,
      });

      if (overlayTimerRef.current) {
        clearTimeout(overlayTimerRef.current);
      }

      // Display HUD banner for 8s on access granted, or 3.5s for ephemeral/denied states
      const overlayDisplayMs = response.access_status === "granted" ? 8000 : 3500;
      overlayTimerRef.current = setTimeout(() => {
        setCameraOverlay(null);
        overlayTimerRef.current = null;
      }, overlayDisplayMs);

      // If access is granted, stop continuous monitoring and auto-turn off the camera after 60 seconds
      if (response.access_status === "granted") {
        setIsMonitoring(false);
        if (autoOffTimerRef.current) {
          clearTimeout(autoOffTimerRef.current);
        }
        autoOffTimerRef.current = setTimeout(() => {
          setIsCameraOn(false);
          setIsCameraReady(false);
          setCameraOverlay(null);
          setDetectedPersons([]);
          setDetectedFaces([]);
          setImageDimensions(null);
          autoOffTimerRef.current = null;
        }, 60000);
      }

      // Map history entry using the 6-state taxonomy (never falsely reporting unknown individual)
      let historyName = "Unknown Individual";
      let historyMatchStatus: string = response.match_status || "denied";

      if (isDeactivated) {
        historyName = `${personName} (User is deactivated)`;
        historyMatchStatus = "deactivated";
      } else if (response.person) {
        historyName = `${response.person.first_name} ${response.person.last_name}`;
        historyMatchStatus = response.match_status || "matched";
      } else if (response.status === "no_person") {
        historyName = "No Person Detected";
        historyMatchStatus = "no_person";
      } else if (response.status === "person_no_face") {
        historyName = "Person Visible (No Face)";
        historyMatchStatus = "person_no_face";
      } else if (response.status === "face_low_quality") {
        historyName = "Low Quality Face";
        historyMatchStatus = "face_low_quality";
      } else if (response.status === "recognition_error") {
        historyName = "Recognition Error";
        historyMatchStatus = "error";
      } else if (response.match_status === "ambiguous") {
        historyName = "Ambiguous Match";
        historyMatchStatus = "ambiguous";
      } else if (response.status === "unknown_individual" || response.match_status === "unknown") {
        historyName = "Unknown Individual";
        historyMatchStatus = "unknown";
      }

      const historyEntry: ScanHistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        time: timeStr,
        name: historyName,
        code: response.person ? response.person.person_code : "N/A",
        status: response.access_status,
        matchStatus: historyMatchStatus,
        similarity: response.face ? response.face.similarity : 0,
      };

      setScanHistory((prev) => [historyEntry, ...prev].slice(0, 10));
    } catch (err) {
      console.error("Error executing webcam face scan:", err);
    } finally {
      inFlightRef.current = false;
      setIsScanning(false);
    }
  }, []);

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
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isCameraOn, isMonitoring, isCameraReady, executeScan]);

  const handleToggleMonitoring = () => {
    if (!isCameraOn || !isCameraReady) return;
    setIsMonitoring((prev) => !prev);
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-6 sm:space-y-8 bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="p-2 bg-primary/10 border border-primary/25 text-primary rounded-xl shrink-0 shadow-sm">
              <Camera className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Biometric Terminal Simulation</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Real-time human body & facial recognition access gateway with instant hardware decision mapping.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/70 text-xs font-mono text-muted-foreground shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-foreground">AI Pipeline:</span>
            <span>YOLOv8n + Buffalo_S</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Camera Feed & Decision Result Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live Camera Feed with Biometric HUD & Controls (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-4">
          <LiveCameraPreview
            ref={cameraRef}
            isCameraOn={isCameraOn}
            onToggleCamera={handleToggleCamera}
            onCameraStatusChange={handleCameraStatusChange}
            isScanning={isScanning}
            overlayResult={cameraOverlay}
            detectedPersons={detectedPersons}
            detectedFaces={detectedFaces}
            imageDimensions={imageDimensions}
            mirrored={true}
            showHud={true}
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

        {/* Right Column: Access Decision Result Card with Side-by-Side Verification (7 cols on lg) */}
        <div className="lg:col-span-7 h-full">
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
                      ) : item.matchStatus === "no_person" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-400 font-semibold text-[11px]">
                          <Users className="w-3.5 h-3.5" /> NO PERSON
                        </span>
                      ) : item.matchStatus === "person_no_face" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-semibold text-[11px]">
                          <User className="w-3.5 h-3.5" /> NO FACE
                        </span>
                      ) : item.matchStatus === "face_low_quality" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5" /> LOW QUALITY
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
                      {item.matchStatus === "no_person" || item.matchStatus === "person_no_face"
                        ? "—"
                        : item.similarity < 0
                        ? "< 0%"
                        : `${(item.similarity * 100).toFixed(1)}%`}
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
