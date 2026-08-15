import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Camera, ShieldCheck, Activity, Cpu } from "lucide-react";
import { DeviceType } from "@prisma/client";

interface DeviceTypeBadgeProps {
  type: DeviceType | string;
  className?: string;
}

export function DeviceTypeBadge({ type, className = "" }: DeviceTypeBadgeProps) {
  const normalizedType = (type || "camera").toLowerCase();

  switch (normalizedType) {
    case "camera":
      return (
        <Badge variant="secondary" className={`gap-1 font-normal ${className}`}>
          <Camera className="h-3 w-3 text-blue-500" />
          Camera
        </Badge>
      );
    case "access_control":
      return (
        <Badge variant="secondary" className={`gap-1 font-normal ${className}`}>
          <ShieldCheck className="h-3 w-3 text-indigo-500" />
          Access Control
        </Badge>
      );
    case "sensor":
      return (
        <Badge variant="secondary" className={`gap-1 font-normal ${className}`}>
          <Activity className="h-3 w-3 text-purple-500" />
          Sensor
        </Badge>
      );
    case "iot":
    default:
      return (
        <Badge variant="secondary" className={`gap-1 font-normal ${className}`}>
          <Cpu className="h-3 w-3 text-cyan-500" />
          IoT
        </Badge>
      );
  }
}
