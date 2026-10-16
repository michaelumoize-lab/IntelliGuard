import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DeviceStatusBadge } from "./device-status-badge";
import { Activity, ShieldAlert, Cpu, WifiOff, Wifi, CheckCircle2 } from "lucide-react";
import { isDeviceOnline } from "@/lib/devices/device-telemetry";

interface DeviceHealthCardProps {
  status: string;
  lastSeen?: string | Date | null;
}

export function DeviceHealthCard({ status, lastSeen }: DeviceHealthCardProps) {
  const isOnline = isDeviceOnline(lastSeen);

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
        {isOnline ? (
          <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
            <Activity className="h-4 w-4 text-emerald-500" />
            <AlertTitle className="text-xs font-semibold">
              Hardware Heartbeat Active
            </AlertTitle>
            <AlertDescription className="text-xs text-emerald-600/90 dark:text-emerald-400/90 mt-1">
              Active telemetry connection established. Device is sending periodic heartbeats and is ready for edge access decisions.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="bg-muted/40 border-muted-foreground/20">
            <WifiOff className="h-4 w-4 text-muted-foreground" />
            <AlertTitle className="text-xs font-semibold">
              Hardware Telemetry Unavailable
            </AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground mt-1">
              No recent heartbeat received from this terminal. Hardware telemetry and edge diagnostics will update once the device is connected.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-3 text-xs pt-1">
          <div className="rounded-lg border p-2.5 bg-muted/20">
            <p className="text-muted-foreground font-medium">Administrative Status</p>
            <p className="font-semibold capitalize text-foreground mt-0.5">{status}</p>
          </div>
          <div className="rounded-lg border p-2.5 bg-muted/20">
            <p className="text-muted-foreground font-medium">Hardware Connection</p>
            <p
              className={`font-semibold mt-0.5 ${
                isOnline ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
              }`}
            >
              {isOnline ? "Connected" : "Offline / Unverified"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
