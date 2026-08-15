"use client";

import React, { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeviceFormDialog, DeviceFormData } from "@/components/devices/device-form-dialog";
import { DeviceApiKeyDialog } from "@/components/devices/device-api-key-dialog";
import { DeviceStatCard } from "@/components/devices/device-stat-card";
import { DeviceTable, DeviceTableItem } from "@/components/devices/device-table";
import { DeviceDetailsCard } from "@/components/devices/device-details-card";
import { DataTableSearch } from "@/components/dashboard/data-table-search";
import { Plus, Cpu, CheckCircle2, XCircle, Wrench, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface StatCounts {
  total: number;
  online: number;
  offline: number;
  maintenance: number;
  error: number;
}

export function AddDeviceButton() {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);

  // API Key dialog state
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [createdDeviceName, setCreatedDeviceName] = useState<string>("");
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);

  const handleSaveDevice = async (data: DeviceFormData) => {
    const res = await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      toast.error(json.message || "Failed to create device.");
      throw new Error(json.message || "Failed to create device.");
    }

    toast.success(`Successfully registered ${data.deviceName}`);

    if (json.apiKey) {
      setCreatedApiKey(json.apiKey);
      setCreatedDeviceName(json.device?.deviceName || data.deviceName);
      setApiKeyDialogOpen(true);
    }

    router.refresh();
  };

  return (
    <>
      <Button onClick={() => setFormOpen(true)} className="shrink-0 cursor-pointer">
        <Plus className="mr-2 h-4 w-4" />
        Add Device
      </Button>

      <DeviceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSaveDevice}
      />

      <DeviceApiKeyDialog
        open={apiKeyDialogOpen}
        apiKey={createdApiKey}
        deviceName={createdDeviceName}
        onClose={() => {
          setApiKeyDialogOpen(false);
          setCreatedApiKey(null);
        }}
      />
    </>
  );
}

export function DevicesStatCards({
  stats,
  currentStatus,
}: {
  stats: StatCounts;
  currentStatus: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleStatClick = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");

    if (status === "all" || status === currentStatus) {
      params.delete("status");
    } else {
      params.set("status", status);
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
      <DeviceStatCard
        title="Total Devices"
        value={stats.total}
        icon={Cpu}
        iconColor="text-blue-500"
        description="Administrative device count"
        active={!currentStatus || currentStatus === "all"}
        onClick={() => handleStatClick("all")}
      />
      <DeviceStatCard
        title="Online"
        value={stats.online}
        icon={CheckCircle2}
        iconColor="text-emerald-500"
        description="Configured as online"
        active={currentStatus === "online"}
        onClick={() => handleStatClick("online")}
      />
      <DeviceStatCard
        title="Offline"
        value={stats.offline}
        icon={XCircle}
        iconColor="text-slate-400"
        description="Configured as offline"
        active={currentStatus === "offline"}
        onClick={() => handleStatClick("offline")}
      />
      <DeviceStatCard
        title="Maintenance"
        value={stats.maintenance}
        icon={Wrench}
        iconColor="text-amber-500"
        description="In maintenance mode"
        active={currentStatus === "maintenance"}
        onClick={() => handleStatClick("maintenance")}
      />
      <DeviceStatCard
        title="Error"
        value={stats.error}
        icon={AlertTriangle}
        iconColor="text-rose-500"
        description="Attention required"
        active={currentStatus === "error"}
        onClick={() => handleStatClick("error")}
      />
    </div>
  );
}

export function DevicesClientFilters({
  initialStatus,
  initialType,
}: {
  initialStatus: string;
  initialType: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const updateFilters = (newParams: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");

    Object.entries(newParams).forEach(([key, val]) => {
      if (val && val !== "all") {
        params.set(key, val);
      } else {
        params.delete(key);
      }
    });

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <Card className="border border-border shadow-sm">
      <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
          <DataTableSearch
            placeholder="Search by name, serial, location, IP..."
            className="max-w-none flex-1"
          />

          <Select
            value={initialStatus || "all"}
            onValueChange={(val) => updateFilters({ status: val })}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={initialType || "all"}
            onValueChange={(val) => updateFilters({ deviceType: val })}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Device Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="camera">Camera</SelectItem>
              <SelectItem value="access_control">Access Control</SelectItem>
              <SelectItem value="sensor">Sensor</SelectItem>
              <SelectItem value="iot">IoT</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="shrink-0 cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardContent>
    </Card>
  );
}

export function DevicesTableInteractive({
  devices,
}: {
  devices: DeviceTableItem[];
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceFormData | null>(null);

  // API Key dialog state
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [createdDeviceName, setCreatedDeviceName] = useState<string>("");
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);

  const handleSaveDevice = async (data: DeviceFormData) => {
    if (data.id) {
      const res = await fetch(`/api/devices/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceName: data.deviceName,
          location: data.location,
          ipAddress: data.ipAddress,
          firmwareVersion: data.firmwareVersion,
          deviceType: data.deviceType,
          status: data.status,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to update device.");
        throw new Error(json.message || "Failed to update device.");
      }
      toast.success(`Updated ${data.deviceName}`);
      router.refresh();
    }
  };

  const handleRegenerateKey = async (device: DeviceTableItem) => {
    try {
      const res = await fetch(`/api/devices/${device.id}/regenerate-key`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to regenerate API key.");
        return;
      }
      if (json.apiKey) {
        setCreatedApiKey(json.apiKey);
        setCreatedDeviceName(device.deviceName);
        setApiKeyDialogOpen(true);
        toast.success(`New API Key generated for ${device.deviceName}`);
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while regenerating API key.");
    }
  };

  const handleDeleteDevice = async (deviceId: number) => {
    const res = await fetch(`/api/devices/${deviceId}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      toast.error(json.message || "Failed to delete device.");
      return;
    }
    toast.success("Device deleted successfully.");
    router.refresh();
  };

  return (
    <>
      <DeviceTable
        devices={devices}
        onEdit={(dev) => {
          setEditingDevice(dev as DeviceFormData);
          setFormOpen(true);
        }}
        onRegenerateKey={handleRegenerateKey}
        onDelete={handleDeleteDevice}
      />

      <DeviceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={editingDevice}
        onSubmit={handleSaveDevice}
      />

      <DeviceApiKeyDialog
        open={apiKeyDialogOpen}
        apiKey={createdApiKey}
        deviceName={createdDeviceName}
        onClose={() => {
          setApiKeyDialogOpen(false);
          setCreatedApiKey(null);
        }}
      />
    </>
  );
}

export function DeviceDetailHeaderActions({
  device,
}: {
  device: any;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceFormData | null>(null);

  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [createdDeviceName, setCreatedDeviceName] = useState<string>("");
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);

  const handleUpdateDevice = async (formData: DeviceFormData) => {
    const res = await fetch(`/api/devices/${device.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceName: formData.deviceName,
        location: formData.location,
        ipAddress: formData.ipAddress,
        firmwareVersion: formData.firmwareVersion,
        deviceType: formData.deviceType,
        status: formData.status,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      toast.error(json.message || "Failed to update device.");
      throw new Error(json.message || "Failed to update device.");
    }
    toast.success("Device updated successfully.");
    router.refresh();
  };

  const handleRegenerateKey = async () => {
    try {
      const res = await fetch(`/api/devices/${device.id}/regenerate-key`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to regenerate API key.");
        return;
      }
      if (json.apiKey) {
        setCreatedApiKey(json.apiKey);
        setCreatedDeviceName(device.deviceName || "Device");
        setApiKeyDialogOpen(true);
        toast.success("New API key generated.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while regenerating API key.");
    }
  };

  return (
    <>
      <DeviceDetailsCard
        device={device}
        onEdit={() => {
          setEditingDevice(device);
          setFormOpen(true);
        }}
        onRegenerateKey={handleRegenerateKey}
      />

      <DeviceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={editingDevice}
        onSubmit={handleUpdateDevice}
      />

      <DeviceApiKeyDialog
        open={apiKeyDialogOpen}
        apiKey={createdApiKey}
        deviceName={createdDeviceName}
        onClose={() => {
          setApiKeyDialogOpen(false);
          setCreatedApiKey(null);
        }}
      />
    </>
  );
}
