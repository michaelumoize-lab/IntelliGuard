import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DeviceStatusBadge } from "./device-status-badge";
import { Activity, ShieldAlert, Cpu, WifiOff } from "lucide-react";

interface DeviceHealthCardProps {
  status: string;
  lastSeen?: string | Date | null;
}

export function DeviceHealthCard({ status, lastSeen }: DeviceHealthCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center space-x-2">
            <Activity className="h-4 w-4 text-primary" />
            <span>Device Health & Telemetry</span>
          </CardTitle>
          <DeviceStatusBadge status={status} />
        </div>
        <CardDescription className="text-xs">
          Administrative & hardware connectivity state
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Alert className="bg-muted/40 border-muted-foreground/20">
          <WifiOff className="h-4 w-4 text-muted-foreground" />
          <AlertTitle className="text-xs font-semibold">
            Hardware Telemetry Unavailable
          </AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground mt-1">
            Physical hardware integration (ESP32 telemetry, CPU, Wi-Fi RSSI, memory) will be connected in a future milestone. Current device status represents administrative configuration state.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-3 text-xs pt-1">
          <div className="rounded-lg border p-2.5 bg-muted/20">
            <p className="text-muted-foreground font-medium">Administrative Status</p>
            <p className="font-semibold capitalize text-foreground mt-0.5">{status}</p>
          </div>
          <div className="rounded-lg border p-2.5 bg-muted/20">
            <p className="text-muted-foreground font-medium">Hardware Connection</p>
            <p className="font-semibold text-muted-foreground mt-0.5">Not Verified</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
