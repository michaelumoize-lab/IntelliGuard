"use client";

import React, { useEffect, useState, useCallback } from "react";
import type { HealthCheckResponse } from "@/types/health";
import { RefreshCw } from "lucide-react";

export function NavbarSystemHealthBadge() {
  const [status, setStatus] = useState<"online" | "offline" | "loading">("loading");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const checkHealth = useCallback(async (force = false) => {
    if (force) setIsRefreshing(true);
    try {
      const url = force ? "/api/dashboard/health?force=true" : "/api/dashboard/health";
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data: HealthCheckResponse = await res.json();
        if (data.services?.fastapi?.status === "online") {
          setStatus("online");
          return;
        }
      }
      setStatus("offline");
    } catch {
      setStatus("offline");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  if (status === "loading") {
    return (
      <button
        onClick={() => checkHealth(true)}
        title="Click to refresh AI Status"
        className="hidden md:flex items-center gap-2 px-3 py-1 bg-muted/80 hover:bg-muted border border-border rounded-full text-xs font-mono text-muted-foreground transition-all cursor-pointer"
      >
        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" />
        <span>Checking AI Status...</span>
      </button>
    );
  }

  if (status === "online") {
    return (
      <button
        onClick={() => checkHealth(true)}
        title="Click to refresh AI Status"
        className="hidden md:flex items-center gap-2 px-3 py-1 bg-muted/80 hover:bg-muted border border-emerald-500/20 hover:border-emerald-500/40 rounded-full text-xs font-mono text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer"
      >
        {isRefreshing ? (
          <RefreshCw className="w-3 h-3 animate-spin text-emerald-500" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        )}
        <span>AI Engine: Online</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => checkHealth(true)}
      title="Click to retry health check"
      className="hidden md:flex items-center gap-2 px-3 py-1 bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 rounded-full text-xs font-mono text-destructive transition-all cursor-pointer"
    >
      {isRefreshing ? (
        <RefreshCw className="w-3 h-3 animate-spin text-destructive" />
      ) : (
        <span className="w-2 h-2 rounded-full bg-destructive" />
      )}
      <span>AI Engine: Offline</span>
    </button>
  );
}

