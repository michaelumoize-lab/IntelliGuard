"use client";

import React, { useEffect, useState, useCallback } from "react";
import type { HealthCheckResponse } from "@/types/health";
import { Activity, Server, Database, Cpu, Cloud, RefreshCw, AlertTriangle } from "lucide-react";

export function SystemHealthPanel() {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const fetchHealth = useCallback(async (force = false) => {
    setIsLoading(true);
    setFetchError(false);
    try {
      const url = force ? "/api/dashboard/health?force=true" : "/api/dashboard/health";
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      } else {
        setFetchError(true);
      }
    } catch (err) {
      console.error("Failed to fetch system health:", err);
      setFetchError(true);
    } finally {
      setIsLoading(false);
      setLastChecked(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);


  const getStatusBadge = (status: string) => {
    const isOk = status === "online" || status === "connected" || status === "available" || status === "configured";
    if (isOk) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-xs w-fit">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="capitalize">{status}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 border border-destructive/20 text-destructive font-semibold text-xs w-fit">
        <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
        <span className="capitalize">{status === "offline" ? "Unavailable" : status}</span>
      </span>
    );
  };

  // Calculate healthy service count out of 5
  const healthyCount = health?.services
    ? [
        health.services.nextjs?.status === "online",
        health.services.fastapi?.status === "online",
        health.services.postgresql?.status === "connected",
        health.services.pgvector?.status === "available",
        health.services.imagekit?.status === "configured",
      ].filter(Boolean).length
    : 0;

  return (
    <div className="bg-card text-card-foreground border border-border rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h3 className="text-base font-semibold text-foreground tracking-tight">System Service Health</h3>
              {health && (
                <span
                  className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full font-medium ${
                    healthyCount === 5
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                  }`}
                >
                  {healthyCount}/5 Operational
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Real-time monitoring of backend microservices, database, and cloud assets.
            </p>
          </div>
        </div>

        {/* Refresh & Last Checked */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {lastChecked && (
            <span className="text-xs font-mono text-muted-foreground">
              Checked: {lastChecked}
            </span>
          )}
          <button
            onClick={() => fetchHealth(true)}
            disabled={isLoading}
            className="px-3 py-1.5 bg-secondary hover:bg-muted text-secondary-foreground text-xs font-medium rounded-lg transition-all border border-border flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {fetchError ? (
        <div className="py-8 text-center text-xs text-destructive flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>Failed to retrieve system service health status.</span>
        </div>
      ) : !health ? (
        <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-primary" />
          <span>Polling service health statuses...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5">
          {/* Next.js API */}
          <div className="p-4 bg-muted/30 hover:bg-muted/50 rounded-xl border border-border/80 transition-all flex flex-col justify-between space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-background rounded-lg border border-border text-foreground">
                <Server className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-foreground">Next.js API</span>
            </div>

            <div className="flex flex-col gap-1">
              {getStatusBadge(health.services.nextjs.status)}
              <span className="text-[11px] font-mono text-muted-foreground pt-0.5">
                Latency: {health.services.nextjs.latencyMs}ms
              </span>
            </div>
          </div>

          {/* FastAPI AI Engine */}
          <div className="p-4 bg-muted/30 hover:bg-muted/50 rounded-xl border border-border/80 transition-all flex flex-col justify-between space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-lg border border-primary/20 text-primary">
                <Cpu className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-foreground">FastAPI AI</span>
            </div>

            <div className="flex flex-col gap-1">
              {getStatusBadge(health.services.fastapi.status)}
              <span className="text-[11px] font-mono text-muted-foreground pt-0.5">
                {health.services.fastapi.latencyMs
                  ? `Latency: ${health.services.fastapi.latencyMs}ms`
                  : health.services.fastapi.message || "Connection refused"}
              </span>
            </div>
          </div>

          {/* PostgreSQL DB */}
          <div className="p-4 bg-muted/30 hover:bg-muted/50 rounded-xl border border-border/80 transition-all flex flex-col justify-between space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-background rounded-lg border border-border text-foreground">
                <Database className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-foreground">PostgreSQL</span>
            </div>

            <div className="flex flex-col gap-1">
              {getStatusBadge(health.services.postgresql.status)}
              <span className="text-[11px] font-mono text-muted-foreground pt-0.5">
                {health.services.postgresql.latencyMs ? `Latency: ${health.services.postgresql.latencyMs}ms` : "Offline"}
              </span>
            </div>
          </div>

          {/* pgvector Extension */}
          <div className="p-4 bg-muted/30 hover:bg-muted/50 rounded-xl border border-border/80 transition-all flex flex-col justify-between space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-500">
                <Database className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-foreground">pgvector</span>
            </div>

            <div className="flex flex-col gap-1">
              {getStatusBadge(health.services.pgvector.status)}
              <span className="text-[11px] font-mono text-muted-foreground pt-0.5">
                Native Vector Engine
              </span>
            </div>
          </div>

          {/* ImageKit Cloud Storage */}
          <div className="p-4 bg-muted/30 hover:bg-muted/50 rounded-xl border border-border/80 transition-all flex flex-col justify-between space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-cyan-500/10 rounded-lg border border-cyan-500/20 text-cyan-500">
                <Cloud className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-foreground">ImageKit</span>
            </div>

            <div className="flex flex-col gap-1">
              {getStatusBadge(health.services.imagekit.status)}
              <span className="text-[11px] font-mono text-muted-foreground pt-0.5">
                Cloud Asset Storage
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
