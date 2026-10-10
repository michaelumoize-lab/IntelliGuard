"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import { useSystemHealth } from "@/hooks/use-system-health";

export function NavbarSystemHealthBadge() {
  const { health, isLoading, isRefreshing, refresh } = useSystemHealth();

  const fastApiStatus = health?.services?.fastapi?.status;

  if (isLoading && !health) {
    return (
      <button
        onClick={() => refresh()}
        title="Checking AI Engine status (Click to refresh)"
        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 bg-muted/80 hover:bg-muted border border-border rounded-full text-xs font-mono text-muted-foreground transition-all cursor-pointer"
      >
        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" />
        <span className="hidden sm:inline">Checking AI Status...</span>
        <span className="inline sm:hidden text-[10px]">AI...</span>
      </button>
    );
  }

  if (fastApiStatus === "online") {
    return (
      <button
        onClick={() => refresh()}
        title={`AI Engine Online${health?.services?.fastapi?.latencyMs ? ` (Latency: ${health.services.fastapi.latencyMs}ms)` : ""} - Click to refresh all services`}
        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 bg-muted/80 hover:bg-muted border border-emerald-500/20 hover:border-emerald-500/40 rounded-full text-xs font-mono text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer"
      >
        {isRefreshing ? (
          <RefreshCw className="w-3 h-3 animate-spin text-emerald-500" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        )}
        <span className="hidden sm:inline">AI Engine: Online</span>
        <span className="inline sm:hidden text-[10px] font-semibold">AI OK</span>
      </button>
    );
  }

  if (fastApiStatus === "error") {
    return (
      <button
        onClick={() => refresh()}
        title={`AI Engine Degraded: ${health?.services?.fastapi?.message || "Service Degraded"} - Click to retry`}
        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-full text-xs font-mono text-amber-600 dark:text-amber-400 transition-all cursor-pointer"
      >
        {isRefreshing ? (
          <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        )}
        <span className="hidden sm:inline">AI Engine: Degraded</span>
        <span className="inline sm:hidden text-[10px] font-semibold">AI WARN</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => refresh()}
      title={`AI Engine Offline: ${health?.services?.fastapi?.message || "Service unreachable"} - Click to retry`}
      className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 rounded-full text-xs font-mono text-destructive transition-all cursor-pointer"
    >
      {isRefreshing ? (
        <RefreshCw className="w-3 h-3 animate-spin text-destructive" />
      ) : (
        <span className="w-2 h-2 rounded-full bg-destructive" />
      )}
      <span className="hidden sm:inline">AI Engine: Offline</span>
      <span className="inline sm:hidden text-[10px] font-semibold">AI OFF</span>
    </button>
  );
}
