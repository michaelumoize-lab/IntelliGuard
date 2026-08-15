import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ArrowRight, CheckCircle2 } from "lucide-react";

export interface DeviceAlertItem {
  id: number;
  alertType: string;
  title: string;
  message: string;
  severity: string;
  resolved: boolean;
  createdAt: string | Date;
  resolvedAt?: string | Date | null;
  person?: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
}

interface DeviceAlertsProps {
  alerts: DeviceAlertItem[];
  deviceId: number;
}

export function DeviceAlerts({ alerts, deviceId }: DeviceAlertsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <div>
          <CardTitle className="text-base font-semibold flex items-center space-x-2">
            <ShieldAlert className="h-4 w-4 text-rose-500" />
            <span>Device Security Alerts</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Recent anomaly and security alerts associated with this device
          </CardDescription>
        </div>
        <Link
          href={`/dashboard/alerts?search=${deviceId}`}
          className="text-xs font-medium text-primary hover:underline flex items-center"
        >
          View All Alerts
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No security alerts generated for this device.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => (
                <TableRow key={alert.id} className="text-xs">
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {new Date(alert.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div>{alert.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate max-w-[250px]">
                      {alert.message}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[11px] font-normal capitalize">
                      {alert.alertType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {alert.severity === "high" || alert.severity === "critical" ? (
                      <Badge variant="destructive" className="text-[10px] uppercase">
                        {alert.severity}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {alert.severity}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {alert.resolved ? (
                      <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Resolved
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        Unresolved
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
