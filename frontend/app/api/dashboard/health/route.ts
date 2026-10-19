import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/get-session";
import type { HealthCheckResponse } from "@/types/health";

export const dynamic = "force-dynamic";
export type { HealthCheckResponse };

async function checkAdminAuth() {
  const session = await getServerSession();
  if (!session || !session.user) {
    return {
      error: NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      ),
    };
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "admin") {
    return {
      error: NextResponse.json(
        { success: false, error: "FORBIDDEN", message: "Admin authorization required." },
        { status: 403 }
      ),
    };
  }
  return { session };
}

// Server-side in-memory cache for health check probes (15-second TTL to avoid burst storms while staying responsive)
let cachedHealth: { data: HealthCheckResponse; timestamp: number } | null = null;
let activeProbePromise: Promise<HealthCheckResponse> | null = null;
const CACHE_TTL_MS = 15 * 1000; // 15 seconds

async function runHealthCheckProbe(): Promise<HealthCheckResponse> {
  // 1. Next.js Local Timing
  const nextjsStart = Date.now();
  const nextjsStatus = { status: "online" as const, latencyMs: 0 };
  nextjsStatus.latencyMs = Date.now() - nextjsStart;

  // 2. Real FastAPI Health Check
  const fastApiUrl = process.env.FASTAPI_URL || "http://localhost:8000";
  let fastApiStatus: { status: "online" | "offline" | "error"; latencyMs?: number; message?: string } = {
    status: "offline",
  };

  try {
    const faStart = Date.now();
    const faRes = await fetch(`${fastApiUrl}/api/v1/health`, {
      method: "GET",
      signal: AbortSignal.timeout(15000), // 15s timeout for cloud cold starts
    });
    const faLatency = Date.now() - faStart;

    if (faRes.ok) {
      const data = await faRes.json();
      if (data.status === "ok" || data.status === "healthy" || data.model_loaded === true) {
        fastApiStatus = { status: "online", latencyMs: faLatency };
      } else {
        fastApiStatus = { status: "error", latencyMs: faLatency, message: "AI service status degraded" };
      }
    } else {
      fastApiStatus = { status: "offline", message: "AI microservice HTTP error response" };
    }
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    console.warn(
      "FastAPI health check probe:",
      isTimeout ? "Request timed out (cold start or unreachable)" : (err instanceof Error ? err.message : "Service unreachable")
    );
    fastApiStatus = {
      status: "offline",
      message: isTimeout ? "AI service starting up (request timed out)" : "AI microservice unreachable",
    };
  }

  // 3. Real PostgreSQL & pgvector Health Check
  let postgresStatus: { status: "connected" | "disconnected"; latencyMs?: number } = { status: "disconnected" };
  let pgvectorStatus: { status: "available" | "unavailable"; message?: string } = { status: "unavailable" };

  try {
    const pgStart = Date.now();
    await prisma.$queryRaw`SELECT 1 as alive`;
    const pgLatency = Date.now() - pgStart;
    postgresStatus = { status: "connected", latencyMs: pgLatency };

    // Verify pgvector extension
    const vectorExt = await prisma.$queryRaw<Array<{ extname: string }>>`SELECT extname::text FROM pg_extension WHERE extname = 'vector'`;
    if (vectorExt && Array.isArray(vectorExt) && vectorExt.length > 0) {
      pgvectorStatus = { status: "available" };
    } else {
      pgvectorStatus = { status: "unavailable", message: "Extension 'vector' not found in database" };
    }
  } catch (err: unknown) {
    console.error("Database health check probe failed:", err);
    postgresStatus = { status: "disconnected" };
    pgvectorStatus = { status: "unavailable", message: "Database query failed" };
  }

  // 4. ImageKit Configuration Check
  const pubKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const privKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

  const isImageKitConfigured = Boolean(pubKey && privKey && urlEndpoint);
  const imagekitStatus = {
    status: isImageKitConfigured ? ("configured" as const) : ("misconfigured" as const),
    message: isImageKitConfigured ? "Keys and endpoint configured" : "Missing environment variables",
  };

  return {
    success: true,
    services: {
      nextjs: nextjsStatus,
      fastapi: fastApiStatus,
      postgresql: postgresStatus,
      pgvector: pgvectorStatus,
      imagekit: imagekitStatus,
    },
  };
}

export async function GET(req: NextRequest) {
  const authCheck = await checkAdminAuth();
  if (authCheck.error) return authCheck.error;

  const forceRefresh = req.nextUrl.searchParams.get("force") === "true";
  const now = Date.now();

  const noCacheHeaders = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };

  // Return cached health report if within short 15s TTL and not forced
  if (!forceRefresh && cachedHealth && now - cachedHealth.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(
      {
        ...cachedHealth.data,
        cached: true,
        cachedAt: new Date(cachedHealth.timestamp).toISOString(),
      },
      { headers: noCacheHeaders }
    );
  }

  // If a probe is currently in-flight, reuse it (including for force=true to prevent burst storms and overlapping probes)
  if (activeProbePromise) {
    const data = await activeProbePromise;
    return NextResponse.json(data, { headers: noCacheHeaders });
  }

  // Execute a new probe and coordinate concurrent requests
  let probePromise: Promise<HealthCheckResponse>;
  probePromise = runHealthCheckProbe()
    .then((result) => {
      if (activeProbePromise === probePromise) {
        cachedHealth = {
          data: result,
          timestamp: Date.now(),
        };
      }
      return result;
    })
    .finally(() => {
      if (activeProbePromise === probePromise) {
        activeProbePromise = null;
      }
    });

  activeProbePromise = probePromise;
  const data = await probePromise;

  return NextResponse.json(data, { headers: noCacheHeaders });
}
