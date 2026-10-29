import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DeviceStatusBadge } from "./device-status-badge";
import { DeviceTypeBadge } from "./device-type-badge";
import { Button } from "@/components/ui/button";
import { Edit, KeyRound, Calendar, HardDrive, MapPin, Network, Code2, Copy, Check, Hash } from "lucide-react";

interface DeviceDetailsCardProps {
  device: {
    id: number;
    deviceName: string;
    serialNumber: string;
    location: string;
    ipAddress?: string | null;
    firmwareVersion?: string | null;
    deviceType: string;
    status: string;
    lastSeen?: string | Date | null;
    createdAt: string | Date;
    updatedAt: string | Date;
  };
  onEdit?: () => void;
  onRegenerateKey?: () => void;
}

export function DeviceDetailsCard({ device, onEdit, onRegenerateKey }: DeviceDetailsCardProps) {
  const [copiedId, setCopiedId] = React.useState(false);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(String(device.id));
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err) {
      console.error("Failed to copy device ID:", err);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <CardTitle className="text-xl font-bold">{device.deviceName}</CardTitle>
            <DeviceStatusBadge status={device.status} />
          </div>
          <CardDescription className="mt-1 flex items-center space-x-2 text-xs">
            <button
              type="button"
              onClick={handleCopyId}
              className="inline-flex items-center gap-1 font-mono text-xs px-1.5 py-0.5 rounded bg-muted/60 hover:bg-muted font-semibold text-foreground transition-colors group cursor-pointer"
              title="Copy numeric Device ID for ESP32 config"
            >
              <span>ID: #{device.id}</span>
              {copiedId ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground group-hover:text-foreground opacity-60 group-hover:opacity-100" />
              )}
            </button>
            <span>•</span>
            <span className="font-mono text-muted-foreground">{device.serialNumber}</span>
            <span>•</span>
            <DeviceTypeBadge type={device.deviceType} />
          </CardDescription>
        </div>

        <div className="flex items-center space-x-2">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          )}
          {onRegenerateKey && (
            <Button variant="outline" size="sm" onClick={onRegenerateKey}>
              <KeyRound className="mr-1.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Regenerate API Key
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="font-medium text-foreground">{device.location}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-muted-foreground">
            <Network className="h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">IP Address</p>
              <p className="font-mono text-xs font-medium text-foreground">
                {device.ipAddress || "Not assigned"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-muted-foreground">
            <Code2 className="h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Firmware</p>
              <p className="font-mono text-xs font-medium text-foreground">
                {device.firmwareVersion || "Unknown"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-muted-foreground">
            <HardDrive className="h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Last Seen</p>
              <p className="font-medium text-foreground text-xs">
                {device.lastSeen
                  ? new Date(device.lastSeen).toLocaleString()
                  : "Never recorded"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t">
          <div className="flex items-center space-x-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>Registered: {new Date(device.createdAt).toLocaleDateString()}</span>
          </div>
          <div>Updated: {new Date(device.updatedAt).toLocaleDateString()}</div>
        </div>
      </CardContent>
    </Card>
  );
}
