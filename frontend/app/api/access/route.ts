import { NextRequest } from "next/server";
import { handleAccessRequest } from "@/lib/access/access-orchestrator";

export const dynamic = "force-dynamic";

/**
 * Access Control Decision Gateway
 *
 * Receives multipart image captures from ESP32-S3 edge devices or simulation webcams,
 * authenticates requests, orchestrates AI face and person inference, evaluates access
 * control policies, logs audit records, and responds with real-time door actions.
 */
export async function POST(req: NextRequest) {
  return handleAccessRequest(req);
}
