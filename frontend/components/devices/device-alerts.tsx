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
              <TableRow className="border-b border-border/60 text-muted-foreground font-mono uppercase text-[10px] tracking-wider hover:bg-transparent">
                <TableHead className="py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Time</TableHead>
                <TableHead className="py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Title</TableHead>
                <TableHead className="py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Type</TableHead>
                <TableHead className="py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Severity</TableHead>
                <TableHead className="py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/40">
              {alerts.map((alert) => (
                <TableRow key={alert.id} className="text-xs hover:bg-muted/40 transition-colors">
                  <TableCell className="text-muted-foreground font-mono whitespace-nowrap py-3">
                    {new Date(alert.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="font-medium py-3">
                    <div>{alert.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate max-w-[250px]">
                      {alert.message}
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="font-mono text-xs uppercase font-semibold text-foreground">
                      {alert.alertType}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    {alert.severity === "high" || alert.severity === "critical" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-destructive/10 border border-destructive/20 text-destructive font-mono font-semibold text-[10px] uppercase">
                        {alert.severity}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 font-mono font-semibold text-[10px] uppercase">
                        {alert.severity}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    {alert.resolved ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                        <CheckCircle2 className="w-3 h-3" /> Resolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 font-semibold text-[11px]">
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
