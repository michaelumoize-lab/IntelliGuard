"use client";

import * as React from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DeviceStatusBadge } from "./device-status-badge";
import { DeviceTypeBadge } from "./device-type-badge";
import { MoreHorizontal, Eye, Edit, KeyRound, Trash2, Cpu } from "lucide-react";

export interface DeviceTableItem {
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
  accessLogCount?: number;
  alertCount?: number;
  lastAccessAt?: string | Date | null;
}

interface DeviceTableProps {
  devices: DeviceTableItem[];
  isLoading?: boolean;
  onEdit?: (device: DeviceTableItem) => void;
  onRegenerateKey?: (device: DeviceTableItem) => void;
  onDelete?: (deviceId: number) => Promise<void>;
}

export function DeviceTable({
  devices,
  isLoading = false,
  onEdit,
  onRegenerateKey,
  onDelete,
}: DeviceTableProps) {
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const confirmDelete = async () => {
    if (!deleteId || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(deleteId);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        <div className="flex items-center justify-center space-x-2">
          <Cpu className="h-5 w-5 animate-pulse text-primary" />
          <span className="text-sm font-medium">Loading registered devices...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Table className="min-w-[800px]">
        <TableHeader>
          <TableRow className="bg-muted/50 border-b border-border">
            <TableHead className="w-[120px] font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Status</TableHead>
            <TableHead className="w-[200px] font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Device Name</TableHead>
            <TableHead className="w-[140px] font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Type</TableHead>
            <TableHead className="w-[150px] font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Serial Number</TableHead>
            <TableHead className="w-[160px] font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Location</TableHead>
            <TableHead className="w-[110px] text-right font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Events</TableHead>
            <TableHead className="w-[90px] text-right font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Alerts</TableHead>
            <TableHead className="w-[120px] font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Last Seen</TableHead>
            <TableHead className="w-[70px] text-right font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-border/40">
          {devices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-48 text-center">
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <Cpu className="h-10 w-10 mb-2 opacity-40" />
                  <p className="font-semibold text-base">No registered devices found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try adjusting your search or filter parameters, or add a new device.
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            devices.map((device) => (
              <TableRow key={device.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="py-3">
                  <DeviceStatusBadge status={device.status} />
                </TableCell>
                <TableCell className="py-3 font-medium">
                  <Link
                    href={`/dashboard/devices/${device.id}`}
                    className="hover:underline text-foreground font-semibold text-sm"
                  >
                    {device.deviceName}
                  </Link>
                  {device.ipAddress && (
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {device.ipAddress}
                    </div>
                  )}
                </TableCell>
                <TableCell className="py-3">
                  <DeviceTypeBadge type={device.deviceType} />
                </TableCell>
                <TableCell className="py-3 font-mono text-xs text-muted-foreground">
                  {device.serialNumber}
                </TableCell>
                <TableCell className="py-3 text-xs text-muted-foreground">
                  {device.location}
                </TableCell>
                <TableCell className="py-3 text-right font-medium text-xs font-mono">
                  {device.accessLogCount ?? 0}
                </TableCell>
                <TableCell className="py-3 text-right font-medium text-xs font-mono">
                  {(device.alertCount ?? 0) > 0 ? (
                    <span className="text-rose-500 font-semibold">{device.alertCount}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="py-3 text-xs text-muted-foreground font-mono">
                  {device.lastSeen
                    ? new Date(device.lastSeen).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Never"}
                </TableCell>
                <TableCell className="py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Device Actions</DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/devices/${device.id}`} className="cursor-pointer">
                          <Eye className="mr-2 h-4 w-4 text-blue-500" />
                          View Details & Stats
                        </Link>
                      </DropdownMenuItem>
                      {onEdit && (
                        <DropdownMenuItem onClick={() => onEdit(device)}>
                          <Edit className="mr-2 h-4 w-4 text-amber-500" />
                          Edit Details
                        </DropdownMenuItem>
                      )}
                      {onRegenerateKey && (
                        <DropdownMenuItem onClick={() => onRegenerateKey(device)}>
                          <KeyRound className="mr-2 h-4 w-4 text-emerald-500" />
                          Regenerate API Key
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {onDelete && (
                        <DropdownMenuItem
                          onClick={() => setDeleteId(device.id)}
                          className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/40"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Device
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>


      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(val) => !val && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this device?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will remove the device configuration and invalidate its API credentials.
              <br />
              <strong>Historical access logs and alerts will be preserved</strong> with their device reference set to null.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600"
            >
              {deleting ? "Deleting..." : "Delete Device"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
