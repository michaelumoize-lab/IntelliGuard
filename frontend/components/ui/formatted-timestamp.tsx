"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export interface FormattedTimestampProps extends React.HTMLAttributes<HTMLSpanElement> {
  date: string | Date | number | null | undefined;
  mode?: "datetime" | "time" | "date";
  showTimezone?: boolean;
  showSeconds?: boolean;
  className?: string;
  fallback?: string;
}

/**
 * Hybrid Formatted Timestamp Component
 *
 * Displays timestamp in the user's local browser timezone with timezone indicator
 * (e.g. "Nov 2, 2026, 08:31:00 PM GMT+2"), paired with a shadcn UI tooltip
 * revealing the canonical UTC timestamp for security audit and compliance clarity.
 *
 * Hydration-safe in Next.js Server & Client components.
 */
export function FormattedTimestamp({
  date,
  mode = "datetime",
  showTimezone = true,
  showSeconds = true,
  className,
  fallback = "N/A",
  ...props
}: FormattedTimestampProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!date) {
    return <span className={cn("font-mono text-muted-foreground", className)}>{fallback}</span>;
  }

  const d = new Date(date);
  const isValid = !isNaN(d.getTime());

  if (!isValid) {
    return <span className={cn("font-mono text-muted-foreground", className)}>{fallback}</span>;
  }

  const utcIso = d.toISOString();
  const utcDisplay = `${utcIso.slice(0, 10)} ${utcIso.slice(11, 19)} UTC`;

  // Pre-mount / SSR fallback: Output standard UTC representation with suppressHydrationWarning
  if (!isMounted) {
    let serverText = "";
    if (mode === "time") {
      serverText = `${utcIso.slice(11, showSeconds ? 19 : 16)} UTC`;
    } else if (mode === "date") {
      serverText = utcIso.slice(0, 10);
    } else {
      serverText = `${utcIso.slice(0, 10)} ${utcIso.slice(11, showSeconds ? 19 : 16)} UTC`;
    }

    return (
      <span
        suppressHydrationWarning
        className={cn("font-mono whitespace-nowrap", className)}
        {...props}
      >
        {serverText}
      </span>
    );
  }

  // Client-side mounted: Format in user's browser local timezone
  const options: Intl.DateTimeFormatOptions = {};

  if (mode === "time") {
    options.hour = "2-digit";
    options.minute = "2-digit";
    if (showSeconds) options.second = "2-digit";
  } else if (mode === "date") {
    options.month = "short";
    options.day = "numeric";
    options.year = "numeric";
  } else {
    options.month = "short";
    options.day = "numeric";
    options.year = "numeric";
    options.hour = "2-digit";
    options.minute = "2-digit";
    if (showSeconds) options.second = "2-digit";
  }

  if (showTimezone && mode !== "date") {
    options.timeZoneName = "short";
  }

  const localFormatted = new Intl.DateTimeFormat(undefined, options).format(d);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("font-mono whitespace-nowrap cursor-help hover:text-foreground transition-colors", className)}
          {...props}
        >
          {localFormatted}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs font-mono py-1.5 px-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-semibold">Local: {localFormatted}</span>
          <span className="text-[10px] text-muted-foreground">UTC: {utcDisplay}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
