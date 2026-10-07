"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { DeviceType, DeviceStatus } from "@prisma/client";

export interface DeviceFormData {
  id?: number;
  deviceName: string;
  serialNumber: string;
  location: string;
  ipAddress?: string;
  firmwareVersion?: string;
  deviceType: DeviceType | string;
  status: DeviceStatus | string;
}

interface DeviceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: DeviceFormData | null;
  onSubmit: (data: DeviceFormData) => Promise<void>;
}

export function DeviceFormDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
}: DeviceFormDialogProps) {
  const isEditing = !!initialData?.id;
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [deviceName, setDeviceName] = React.useState("");
  const [serialNumber, setSerialNumber] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [ipAddress, setIpAddress] = React.useState("");
  const [firmwareVersion, setFirmwareVersion] = React.useState("");
  const [deviceType, setDeviceType] = React.useState<string>("camera");
  const [status, setStatus] = React.useState<string>("offline");

  React.useEffect(() => {
    if (initialData) {
      setDeviceName(initialData.deviceName || "");
      setSerialNumber(initialData.serialNumber || "");
      setLocation(initialData.location || "");
      setIpAddress(initialData.ipAddress || "");
      setFirmwareVersion(initialData.firmwareVersion || "");
      setDeviceType(initialData.deviceType || "camera");
      setStatus(initialData.status || "offline");
    } else {
      setDeviceName("");
      setSerialNumber("");
      setLocation("");
      setIpAddress("");
      setFirmwareVersion("");
      setDeviceType("camera");
      setStatus("offline");
    }
    setError(null);
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim() || (!isEditing && !serialNumber.trim()) || !location.trim()) {
      setError("Device name, serial number, and location are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit({
        id: initialData?.id,
        deviceName: deviceName.trim(),
        serialNumber: serialNumber.trim(),
        location: location.trim(),
        ipAddress: ipAddress.trim() || undefined,
        firmwareVersion: firmwareVersion.trim() || undefined,
        deviceType,
        status,
      });
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to save device.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Device Configuration" : "Register New IoT Device"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update device settings, type, location, or administrative status."
                : "Register a new camera or access control device endpoint."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-xs font-medium text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="deviceName">Device Name *</Label>
              <Input
                id="deviceName"
                placeholder="e.g. Main Entrance Camera 01"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="serialNumber">Serial Number *</Label>
              <Input
                id="serialNumber"
                placeholder="e.g. ESP32-S3-001"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                disabled={isEditing}
                required
              />
              {isEditing && (
                <p className="text-[11px] text-muted-foreground">
                  Serial number is immutable after registration.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                placeholder="e.g. Building A - Front Gate"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="deviceType">Device Type</Label>
                <Select value={deviceType} onValueChange={setDeviceType}>
                  <SelectTrigger id="deviceType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="camera">Camera</SelectItem>
                    <SelectItem value="access_control">Access Control</SelectItem>
                    <SelectItem value="sensor">Sensor</SelectItem>
                    <SelectItem value="iot">IoT Endpoint</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Administrative Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ipAddress">IP Address (Optional)</Label>
                <Input
                  id="ipAddress"
                  placeholder="192.168.1.100"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="firmwareVersion">Firmware (Optional)</Label>
                <Input
                  id="firmwareVersion"
                  placeholder="v1.0.0"
                  value={firmwareVersion}
                  onChange={(e) => setFirmwareVersion(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Register Device"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
