import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden bg-card text-card-foreground border rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group",
        onClick ? "cursor-pointer" : "",
        active
          ? "border-primary ring-2 ring-primary/30 shadow-md"
          : "border-border/80 hover:border-primary/40"
      )}
    >
      {/* Background Gradient Accent Glow */}
      <div
        className={cn(
          "absolute -right-8 -top-8 w-20 h-20 bg-gradient-to-br rounded-full blur-xl pointer-events-none opacity-40 group-hover:opacity-80 transition-opacity duration-300",
          active ? "from-primary/20 to-transparent opacity-80" : "from-primary/10 to-transparent"
        )}
      />

      {/* Header Row: Title & Icon */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider leading-snug">
          {title}
        </span>
        <div
          className={cn(
            "p-1.5 rounded-lg border shrink-0 transition-transform duration-300 group-hover:scale-105 bg-muted/80 border-border",
            iconColor
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>

      {/* Value & Description */}
      <div>
        <div className="flex items-baseline gap-2">
          <h3 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
            {value}
          </h3>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground/80 mt-1 font-medium leading-normal">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

