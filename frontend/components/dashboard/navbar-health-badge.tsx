"use client";

import React, { useEffect, useState } from "react";
import type { HealthCheckResponse } from "@/types/health";

export function NavbarSystemHealthBadge() {
  const [status, setStatus] = useState<"online" | "offline" | "loading">("loading");

  const checkHealth = async () => {
    try {
      const res = await fetch("/api/dashboard/health", { cache: "no-store" });
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
    }
  };

  useEffect(() => {
    checkHealth();
    // Poll real health API every 15 seconds
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  if (status === "loading") {
    return (
      <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-muted/80 border border-border rounded-full text-xs font-mono text-muted-foreground">
        <span className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" />
        <span>Checking AI Status...</span>
      </div>
    );
  }

  if (status === "online") {
    return (
      <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-muted/80 border border-emerald-500/20 rounded-full text-xs font-mono text-emerald-600 dark:text-emerald-400">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>AI Engine: Online</span>
      </div>
    );
  }

  return (
    <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-destructive/10 border border-destructive/30 rounded-full text-xs font-mono text-destructive">
      <span className="w-2 h-2 rounded-full bg-destructive" />
      <span>AI Engine: Offline</span>
    </div>
  );
}
