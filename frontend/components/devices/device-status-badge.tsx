import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { DeviceStatus } from "@prisma/client";

interface DeviceStatusBadgeProps {
  status: DeviceStatus | string;
  className?: string;
}

export function DeviceStatusBadge({ status, className = "" }: DeviceStatusBadgeProps) {
  const normalizedStatus = (status || "offline").toLowerCase();

  switch (normalizedStatus) {
    case "online":
      return (
        <Badge variant="outline" className={`bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 font-medium ${className}`}>
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
          Online
        </Badge>
      );
    case "maintenance":
      return (
        <Badge variant="outline" className={`bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 font-medium ${className}`}>
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-500"></span>
          Maintenance
        </Badge>
      );
    case "error":
      return (
        <Badge variant="outline" className={`bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400 font-medium ${className}`}>
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-rose-500"></span>
          Error
        </Badge>
      );
    case "offline":
    default:
      return (
        <Badge variant="outline" className={`bg-slate-500/10 text-slate-600 border-slate-500/20 dark:bg-slate-500/20 dark:text-slate-400 font-medium ${className}`}>
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-slate-400"></span>
          Offline
        </Badge>
      );
  }
}
