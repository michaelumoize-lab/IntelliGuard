import React from "react";
import { prisma } from "@/lib/prisma";
import { DeviceType, DeviceStatus } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  AddDeviceButton,
  DevicesStatCards,
  DevicesClientFilters,
  DevicesTableInteractive,
} from "@/components/devices/devices-client-actions";
import { DeviceTableItem } from "@/components/devices/device-table";
import { DataTablePagination } from "@/components/dashboard/data-table-pagination";
import { Cpu } from "lucide-react";

export const dynamic = "force-dynamic";

const VALID_DEVICE_TYPES = Object.values(DeviceType);
const VALID_DEVICE_STATUSES = Object.values(DeviceStatus);

interface DevicesPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    deviceType?: string;
  }>;
}

export default async function DevicesPage({ searchParams }: DevicesPageProps) {
  const resolvedParams = await searchParams;
  const rawPage = parseInt(resolvedParams.page || "1", 10);
  const requestedPage = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
  const limit = 10;

  const search = (resolvedParams.search || "").trim();
  const status = (resolvedParams.status || "").trim().toLowerCase();
  const deviceType = (resolvedParams.deviceType || "").trim().toLowerCase();

  const whereClause: any = {};

  if (search) {
    whereClause.OR = [
      { deviceName: { contains: search, mode: "insensitive" } },
      { serialNumber: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
      { ipAddress: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status && VALID_DEVICE_STATUSES.includes(status as DeviceStatus)) {
    whereClause.status = status as DeviceStatus;
  }

  if (deviceType && VALID_DEVICE_TYPES.includes(deviceType as DeviceType)) {
    whereClause.deviceType = deviceType as DeviceType;
  }

  // Execute database queries directly on PostgreSQL via Prisma in parallel
  const [
    totalCount,
    onlineCount,
    offlineCount,
    maintenanceCount,
    errorCount,
    totalMatching,
    rawDevices,
  ] = await Promise.all([
    prisma.device.count(),
    prisma.device.count({ where: { status: "online" } }),
    prisma.device.count({ where: { status: "offline" } }),
    prisma.device.count({ where: { status: "maintenance" } }),
    prisma.device.count({ where: { status: "error" } }),
    prisma.device.count({ where: whereClause }),
    prisma.device.findMany({
      where: whereClause,
      skip: Math.max(0, (requestedPage - 1) * limit),
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            accessLogs: true,
            alerts: true,
          },
        },
        accessLogs: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(totalMatching / limit) || 1;
  const effectivePage = Math.min(requestedPage, totalPages);

  // Map Prisma data to clean serializable items for client table
  const devices: DeviceTableItem[] = rawDevices.map((device) => ({
    id: device.id,
    deviceName: device.deviceName,
    serialNumber: device.serialNumber,
    location: device.location,
    ipAddress: device.ipAddress,
    firmwareVersion: device.firmwareVersion,
    deviceType: device.deviceType,
    status: device.status,
    lastSeen: device.lastSeen ? device.lastSeen.toISOString() : null,
    createdAt: device.createdAt.toISOString(),
    accessLogCount: device._count.accessLogs,
    alertCount: device._count.alerts,
    lastAccessAt: device.accessLogs[0]?.createdAt.toISOString() || null,
  }));

  const stats = {
    total: totalCount,
    online: onlineCount,
    offline: offlineCount,
    maintenance: maintenanceCount,
    error: errorCount,
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-4 sm:space-y-6 bg-background text-foreground">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-primary/10 border border-primary/20 text-primary rounded-lg shrink-0">
              <Cpu className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Device Management</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage registered cameras, access-control devices, sensors, and IoT endpoints.
          </p>
        </div>

        <AddDeviceButton />
      </div>

      {/* Summary Cards */}
      <DevicesStatCards stats={stats} currentStatus={status} />

      {/* URL-Driven Search & Filters Toolbar */}
      <DevicesClientFilters initialStatus={status} initialType={deviceType} />

      {/* Data Table & Pagination Container */}
      <Card className="border border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <DevicesTableInteractive devices={devices} />
        </CardContent>

        <DataTablePagination
          total={totalMatching}
          page={effectivePage}
          limit={limit}
          totalPages={totalPages}
          itemLabel="devices"
        />
      </Card>
    </div>
  );
}
