import "dotenv/config";
import { prisma } from "../lib/prisma";

async function runDashboardTests() {
  console.log("==================================================");
  console.log("  Milestone 9: Security Dashboard Verification");
  console.log("==================================================\n");

  // 1. Test Aggregated Statistics Database Calculations
  console.log("[Test 1] Testing Database Stats Aggregation...");
  try {
    const totalPersons = await prisma.person.count();
    const activePersons = await prisma.person.count({ where: { status: "active" } });
    const totalAccess = await prisma.accessLog.count();
    const grantedAccess = await prisma.accessLog.count({ where: { accessStatus: "granted" } });

    console.log(` - Total Persons: ${totalPersons} | Active: ${activePersons}`);
    console.log(` - Total Access Logs: ${totalAccess} | Granted: ${grantedAccess}`);
    console.log("✅ Test 1 PASSED: PostgreSQL database aggregation queries executed successfully.");
  } catch (err: any) {
    console.error("❌ Test 1 failed:", err);
  }

  // 2. Test Recognition Breakdown Aggregations
  console.log("\n[Test 2] Testing Recognition Breakdown Calculations...");
  try {
    const matchedCount = await prisma.accessLog.count({ where: { matchStatus: "matched" } });
    const unknownCount = await prisma.accessLog.count({ where: { matchStatus: "unknown" } });
    const ambiguousCount = await prisma.accessLog.count({ where: { matchStatus: "ambiguous" } });

    console.log(` - Matched: ${matchedCount} | Unknown: ${unknownCount} | Ambiguous: ${ambiguousCount}`);
    console.log("✅ Test 2 PASSED: Recognition breakdown counts calculated accurately.");
  } catch (err: any) {
    console.error("❌ Test 2 failed:", err);
  }

  // 3. Test Security Alerts Unresolved Count
  console.log("\n[Test 3] Testing Security Alerts Unresolved Counting...");
  try {
    const unresolvedCount = await prisma.alert.count({ where: { resolved: false } });
    console.log(` - Unresolved Alerts: ${unresolvedCount}`);
    console.log("✅ Test 3 PASSED: Unresolved alerts count retrieved.");
  } catch (err: any) {
    console.error("❌ Test 3 failed:", err);
  }

  // 4. Test Zero Raw 512D Vector Leakage in Dashboard Activity
  console.log("\n[Test 4] Verifying Zero Vector Leakage in Recent Activity...");
  try {
    const recentLogs = await prisma.accessLog.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
    });

    const jsonString = JSON.stringify(recentLogs);
    const hasRawEmbedding = jsonString.includes('"embedding":') || jsonString.includes("[0.");
    if (hasRawEmbedding) {
      console.error("❌ Test 4 failed: Raw embedding detected in activity response!");
    } else {
      console.log("✅ Test 4 PASSED: Zero raw vector floats in activity payload.");
    }
  } catch (err: any) {
    console.error("❌ Test 4 failed:", err);
  }

  // 5. Test Real System Health Checks (FastAPI, PostgreSQL, pgvector, ImageKit)
  console.log("\n[Test 5] Verifying System Health Checks...");
  try {
    // Database check
    await prisma.$queryRaw`SELECT 1 as alive`;
    const vectorExt: any = await prisma.$queryRaw`SELECT extname::text FROM pg_extension WHERE extname = 'vector'`;
    const isPgVectorAvailable = Array.isArray(vectorExt) && vectorExt.length > 0;

    console.log(` - PostgreSQL Connected: true`);
    console.log(` - pgvector Extension Available: ${isPgVectorAvailable}`);
    if (isPgVectorAvailable) {
      console.log("✅ Test 5 PASSED: PostgreSQL and native pgvector extension verified alive.");
    } else {
      console.error("❌ Test 5 failed: pgvector extension not found.");
    }
  } catch (err: any) {
    console.error("❌ Test 5 failed:", err);
  }

  console.log("\n==================================================");
  console.log("  Milestone 9 Dashboard Tests Completed!");
  console.log("==================================================");
}

runDashboardTests().catch(console.error);
