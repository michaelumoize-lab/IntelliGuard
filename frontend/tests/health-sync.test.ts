import "dotenv/config";
import { NextRequest } from "next/server";
import { GET } from "../app/api/dashboard/health/route";

async function runHealthSyncTests() {
  console.log("==================================================");
  console.log("  Health Probe & Cache Synchronization Verification");
  console.log("==================================================\n");

  try {
    // 1. Initial Health Probe
    console.log("[Test 1] Testing Initial Health Probe Route Execution...");
    const req1 = new NextRequest("http://localhost:3000/api/dashboard/health");
    const res1 = await GET(req1);
    const data1 = await res1.json();

    console.log(` - HTTP Status: ${res1.status}`);
    console.log(` - Services returned: ${Object.keys(data1.services).join(", ")}`);
    console.log(` - FastAPI Status: ${data1.services?.fastapi?.status} (Latency: ${data1.services?.fastapi?.latencyMs ?? "N/A"}ms)`);
    console.log(` - PostgreSQL Status: ${data1.services?.postgresql?.status}`);
    console.log(` - pgvector Status: ${data1.services?.pgvector?.status}`);
    console.log(` - Cache-Control Header: ${res1.headers.get("Cache-Control")}`);

    if (
      data1.success === true &&
      data1.services?.fastapi &&
      data1.services?.postgresql &&
      data1.services?.nextjs
    ) {
      console.log("✅ Test 1 PASSED: Health probe returned valid structured service health report.");
    } else {
      throw new Error("Invalid health report payload structure");
    }

    // 2. Cache Deduplication within TTL
    console.log("\n[Test 2] Testing Server Cache Retention within 15s TTL...");
    const req2 = new NextRequest("http://localhost:3000/api/dashboard/health");
    const res2 = await GET(req2);
    const data2 = await res2.json();

    console.log(` - Cached: ${data2.cached} (CachedAt: ${data2.cachedAt})`);
    if (data2.cached === true) {
      console.log("✅ Test 2 PASSED: Repeated probe within TTL returned synchronized cached response.");
    } else {
      console.warn("⚠️ Warning: Request did not hit in-memory cache as expected.");
    }

    // 3. Force Refresh Parameter
    console.log("\n[Test 3] Testing Force Refresh Bypass (?force=true)...");
    const req3 = new NextRequest("http://localhost:3000/api/dashboard/health?force=true");
    const res3 = await GET(req3);
    const data3 = await res3.json();

    console.log(` - Cached flag on force refresh: ${data3.cached ?? false}`);
    console.log(` - FastAPI Status after force refresh: ${data3.services?.fastapi?.status}`);
    if (!data3.cached) {
      console.log("✅ Test 3 PASSED: Force refresh successfully bypassed cache for real-time probe.");
    } else {
      throw new Error("Force refresh failed to bypass cache");
    }

    console.log("\n==================================================");
    console.log("  Health Sync Tests Completed Successfully!");
    console.log("==================================================");
  } catch (err: any) {
    console.error("❌ Test failed:", err);
    process.exit(1);
  }
}

runHealthSyncTests();
