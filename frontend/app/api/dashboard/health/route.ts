import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { HealthCheckResponse } from "@/types/health";

export const dynamic = "force-dynamic";
export type { HealthCheckResponse };

export async function GET(req: NextRequest) {
  // 1. Next.js Local Work Timing
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
      signal: AbortSignal.timeout(5000), // 5s timeout
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
  } catch (err: any) {
    console.error("FastAPI health check probe failed:", err);
    fastApiStatus = { status: "offline", message: "AI microservice unreachable" };
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
    const vectorExt: any = await prisma.$queryRaw`SELECT extname::text FROM pg_extension WHERE extname = 'vector'`;
    if (vectorExt && Array.isArray(vectorExt) && vectorExt.length > 0) {
      pgvectorStatus = { status: "available" };
    } else {
      pgvectorStatus = { status: "unavailable", message: "Extension 'vector' not found in database" };
    }
  } catch (err: any) {
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

  return NextResponse.json({
    success: true,
    services: {
      nextjs: nextjsStatus,
      fastapi: fastApiStatus,
      postgresql: postgresStatus,
      pgvector: pgvectorStatus,
      imagekit: imagekitStatus,
    },
  });
}

