import * as React from "react";
import { LucideIcon } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";

interface DeviceStatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  iconColor?: string;
  description?: string;
  active?: boolean;
  onClick?: () => void;
}

export function DeviceStatCard({
  title,
  value,
  icon: Icon,
  iconColor = "text-primary",
  description,
  active = false,
  onClick,
}: DeviceStatCardProps) {
  return (
    <StatCard
      title={title}
      value={value}
      icon={<Icon className={`h-4 w-4 ${iconColor}`} />}
      description={description}
      active={active}
      onClick={onClick}
    />
  );
}
