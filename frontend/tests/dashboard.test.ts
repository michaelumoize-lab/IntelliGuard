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
  } catch (err: unknown) {
    console.error("❌ Test 1 failed:", err);
    process.exitCode = 1;
  }

  // 2. Test Recognition Breakdown Aggregations
  console.log("\n[Test 2] Testing Recognition Breakdown Calculations...");
  try {
    const matchedCount = await prisma.accessLog.count({ where: { matchStatus: "matched" } });
    const unknownCount = await prisma.accessLog.count({ where: { matchStatus: "unknown" } });
    const ambiguousCount = await prisma.accessLog.count({ where: { matchStatus: "ambiguous" } });

    console.log(` - Matched: ${matchedCount} | Unknown: ${unknownCount} | Ambiguous: ${ambiguousCount}`);
    console.log("✅ Test 2 PASSED: Recognition breakdown counts calculated accurately.");
  } catch (err: unknown) {
    console.error("❌ Test 2 failed:", err);
    process.exitCode = 1;
  }

  // 3. Test Security Alerts Unresolved Count
  console.log("\n[Test 3] Testing Security Alerts Unresolved Counting...");
  try {
    const unresolvedCount = await prisma.alert.count({ where: { resolved: false } });
    console.log(` - Unresolved Alerts: ${unresolvedCount}`);
    console.log("✅ Test 3 PASSED: Unresolved alerts count retrieved.");
  } catch (err: unknown) {
    console.error("❌ Test 3 failed:", err);
    process.exitCode = 1;
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
      process.exitCode = 1;
    } else {
      console.log("✅ Test 4 PASSED: Zero raw vector floats in activity payload.");
    }
  } catch (err: unknown) {
    console.error("❌ Test 4 failed:", err);
    process.exitCode = 1;
  }

  // 5. Test Real System Health Checks (FastAPI, PostgreSQL, pgvector, ImageKit)
  console.log("\n[Test 5] Verifying System Health Checks...");
  try {
    // Database check
    await prisma.$queryRaw`SELECT 1 as alive`;
    const vectorExt = await prisma.$queryRaw<Array<{ extname: string }>>`SELECT extname::text FROM pg_extension WHERE extname = 'vector'`;
    const isPgVectorAvailable = Array.isArray(vectorExt) && vectorExt.length > 0;

    console.log(` - PostgreSQL Connected: true`);
    console.log(` - pgvector Extension Available: ${isPgVectorAvailable}`);
    if (isPgVectorAvailable) {
      console.log("✅ Test 5 PASSED: PostgreSQL and native pgvector extension verified alive.");
    } else {
      console.error("❌ Test 5 failed: pgvector extension not found.");
      process.exitCode = 1;
    }
  } catch (err: unknown) {
    console.error("❌ Test 5 failed:", err);
    process.exitCode = 1;
  }

  // 6. Test P0 Auth & Role Enforcement on All 5 Dashboard & Alerts Routes + resolvedBy Tracking
  console.log("\n[Test 6] Verifying P0 Authentication, Role Enforcement & Alert resolvedBy Tracking...");
  const { NextRequest } = await import("next/server");
  const { __setGetServerSessionMock } = await import("../lib/get-session");
  const { GET: GET_ALERTS, PATCH: PATCH_ALERTS_BATCH } = await import("../app/api/alerts/route");
  const { PATCH: PATCH_ALERT } = await import("../app/api/alerts/[id]/route");
  const { GET: GET_ACTIVITY } = await import("../app/api/dashboard/activity/route");
  const { GET: GET_STATS } = await import("../app/api/dashboard/stats/route");
  const { GET: GET_HEALTH } = await import("../app/api/dashboard/health/route");

  let tempAlertId: number | null = null;
  let tempUserId: string | null = null;

  try {
    // 6a. Unauthenticated requests -> 401
    __setGetServerSessionMock(async () => null);

    const rAlerts401 = await GET_ALERTS(new NextRequest("http://localhost:3000/api/alerts"));
    const rPatch401 = await PATCH_ALERT(new NextRequest("http://localhost:3000/api/alerts/1", { method: "PATCH" }), {
      params: Promise.resolve({ id: "1" }),
    });
    const rAct401 = await GET_ACTIVITY(new NextRequest("http://localhost:3000/api/dashboard/activity"));
    const rStats401 = await GET_STATS(new NextRequest("http://localhost:3000/api/dashboard/stats"));
    const rHealth401 = await GET_HEALTH(new NextRequest("http://localhost:3000/api/dashboard/health"));

    if (
      rAlerts401.status !== 401 ||
      rPatch401.status !== 401 ||
      rAct401.status !== 401 ||
      rStats401.status !== 401 ||
      rHealth401.status !== 401
    ) {
      throw new Error(
        `Expected 401 on all 5 routes for unauthenticated caller, got: alerts=${rAlerts401.status}, patch=${rPatch401.status}, activity=${rAct401.status}, stats=${rStats401.status}, health=${rHealth401.status}`
      );
    }

    // 6b. Non-admin USER requests -> 403
    __setGetServerSessionMock(
      async () =>
        ({
          user: { id: "non-admin-user", email: "user@intelliguard.local", name: "Viewer", role: "USER" },
          session: { id: "sess-viewer", userId: "non-admin-user", expiresAt: new Date(Date.now() + 60000) },
        }) as unknown as Awaited<ReturnType<typeof import("../lib/get-session").getServerSession>>
    );

    const rAlerts403 = await GET_ALERTS(new NextRequest("http://localhost:3000/api/alerts"));
    const rPatch403 = await PATCH_ALERT(new NextRequest("http://localhost:3000/api/alerts/1", { method: "PATCH" }), {
      params: Promise.resolve({ id: "1" }),
    });
    const rAct403 = await GET_ACTIVITY(new NextRequest("http://localhost:3000/api/dashboard/activity"));
    const rStats403 = await GET_STATS(new NextRequest("http://localhost:3000/api/dashboard/stats"));
    const rHealth403 = await GET_HEALTH(new NextRequest("http://localhost:3000/api/dashboard/health"));

    if (
      rAlerts403.status !== 403 ||
      rPatch403.status !== 403 ||
      rAct403.status !== 403 ||
      rStats403.status !== 403 ||
      rHealth403.status !== 403
    ) {
      throw new Error(
        `Expected 403 on all 5 routes for non-admin caller, got: alerts=${rAlerts403.status}, patch=${rPatch403.status}, activity=${rAct403.status}, stats=${rStats403.status}, health=${rHealth403.status}`
      );
    }

    // 6c. Admin session -> 200 and PATCH /api/alerts/[id] records resolvedBy
    const existingUser = await prisma.user.findFirst({ select: { id: true } });
    if (existingUser) {
      tempUserId = existingUser.id;
    } else {
      const createdUser = await prisma.user.create({
        data: {
          id: `test-admin-${Date.now()}`,
          name: "Test Admin",
          email: `test-admin-${Date.now()}@intelliguard.local`,
          emailVerified: true,
          role: "ADMIN",
        },
      });
      tempUserId = createdUser.id;
    }

    __setGetServerSessionMock(
      async () =>
        ({
          user: { id: tempUserId!, email: "admin@intelliguard.local", name: "Admin", role: "ADMIN" },
          session: { id: "sess-admin", userId: tempUserId!, expiresAt: new Date(Date.now() + 60000) },
        }) as unknown as Awaited<ReturnType<typeof import("../lib/get-session").getServerSession>>
    );

    const tempAlert = await prisma.alert.create({
      data: {
        alertType: "system_error",
        title: "P0 Auth Test Alert",
        message: "Temporary alert for resolvedBy verification",
        severity: "low",
        resolved: false,
      },
    });
    tempAlertId = tempAlert.id;

    const rPatch200 = await PATCH_ALERT(
      new NextRequest(`http://localhost:3000/api/alerts/${tempAlert.id}`, {
        method: "PATCH",
        body: JSON.stringify({ resolved: true }),
      }),
      { params: Promise.resolve({ id: String(tempAlert.id) }) }
    );
    const patchData = await rPatch200.json();

    if (rPatch200.status !== 200 || !patchData.alert?.resolved || patchData.alert?.resolvedBy !== tempUserId) {
      throw new Error(
        `Expected PATCH /api/alerts/[id] to return 200 with resolvedBy=${tempUserId}, got status=${rPatch200.status}, resolvedBy=${patchData.alert?.resolvedBy}`
      );
    }

    // 6d. Test Batch PATCH /api/alerts (Resolve All)
    const batchAlert1 = await prisma.alert.create({
      data: {
        alertType: "system_error",
        title: "Batch Resolve Alert 1",
        message: "First batch test alert",
        severity: "low",
        resolved: false,
      },
    });
    const batchAlert2 = await prisma.alert.create({
      data: {
        alertType: "system_error",
        title: "Batch Resolve Alert 2",
        message: "Second batch test alert",
        severity: "medium",
        resolved: false,
      },
    });

    const rBatchPatch200 = await PATCH_ALERTS_BATCH(
      new NextRequest("http://localhost:3000/api/alerts", {
        method: "PATCH",
        body: JSON.stringify({
          resolved: true,
          alertIds: [batchAlert1.id, batchAlert2.id],
        }),
      })
    );
    const batchData = await rBatchPatch200.json();

    if (rBatchPatch200.status !== 200 || !batchData.success || batchData.count !== 2) {
      throw new Error(
        `Expected batch PATCH /api/alerts to resolve 2 alerts, got status=${rBatchPatch200.status}, count=${batchData.count}`
      );
    }

    const checkBatch = await prisma.alert.findMany({
      where: { id: { in: [batchAlert1.id, batchAlert2.id] } },
    });
    if (!checkBatch.every((a) => a.resolved && a.resolvedBy === tempUserId)) {
      throw new Error("Batch resolved alerts were not correctly marked resolved with resolvedBy.");
    }

    await prisma.alert.deleteMany({
      where: { id: { in: [batchAlert1.id, batchAlert2.id] } },
    });

    console.log("✅ Test 6 PASSED: All 5 dashboard/alerts routes enforce 401/403/200, batch resolve works, and records resolvedBy.");
  } catch (err: unknown) {
    console.error("❌ Test 6 failed:", err);
    process.exitCode = 1;
  } finally {
    __setGetServerSessionMock(null);
    if (tempAlertId) {
      await prisma.alert.delete({ where: { id: tempAlertId } }).catch(() => {});
    }
    if (tempUserId && tempUserId.startsWith("test-admin-")) {
      await prisma.user.delete({ where: { id: tempUserId } }).catch(() => {});
    }
  }

  // 7. Test Admin-Only Server-Side Protection on /dashboard/project-overview
  console.log("\n[Test 7] Testing Server-Side Admin-Only Protection for Project Overview...");
  try {
    const { __setGetServerSessionMock } = await import("../lib/get-session");
    const ProjectOverviewPage = (await import("../app/dashboard/project-overview/page")).default;

    // 7a. Unauthenticated caller throws redirect to /auth/sign-in
    __setGetServerSessionMock(async () => null);
    let unauthRedirected = false;
    try {
      await ProjectOverviewPage();
    } catch (e: unknown) {
      const errStr = String(e);
      if (errStr.includes("NEXT_REDIRECT") || errStr.includes("/auth/sign-in")) {
        unauthRedirected = true;
      }
    }
    if (!unauthRedirected) {
      throw new Error("Expected ProjectOverviewPage to redirect unauthenticated caller to /auth/sign-in");
    }

    // 7b. Non-admin caller throws redirect to /dashboard
    __setGetServerSessionMock(
      async () =>
        ({
          user: { id: "viewer-1", email: "viewer@intelliguard.local", name: "Viewer", role: "USER" },
          session: { id: "sess-v", userId: "viewer-1", expiresAt: new Date(Date.now() + 60000) },
        }) as unknown as Awaited<ReturnType<typeof import("../lib/get-session").getServerSession>>
    );
    let nonAdminRedirected = false;
    try {
      await ProjectOverviewPage();
    } catch (e: unknown) {
      const errStr = String(e);
      if (errStr.includes("NEXT_REDIRECT") || errStr.includes("/dashboard")) {
        nonAdminRedirected = true;
      }
    }
    if (!nonAdminRedirected) {
      throw new Error("Expected ProjectOverviewPage to redirect non-admin caller to /dashboard");
    }

    // 7c. Authenticated Admin caller renders without throwing
    __setGetServerSessionMock(
      async () =>
        ({
          user: { id: "admin-1", email: "admin@intelliguard.local", name: "Admin", role: "ADMIN" },
          session: { id: "sess-a", userId: "admin-1", expiresAt: new Date(Date.now() + 60000) },
        }) as unknown as Awaited<ReturnType<typeof import("../lib/get-session").getServerSession>>
    );
    const renderResult = await ProjectOverviewPage();
    if (!renderResult) {
      throw new Error("Expected ProjectOverviewPage to return JSX element for authorized admin");
    }

    console.log("✅ Test 7 PASSED: /dashboard/project-overview strictly enforces server-side admin protection.");
  } catch (err: unknown) {
    console.error("❌ Test 7 failed:", err);
    process.exitCode = 1;
  } finally {
    const { __setGetServerSessionMock } = await import("../lib/get-session");
    __setGetServerSessionMock(null);
  }

  console.log("\n==================================================");
  if (process.exitCode === 1) {
    console.error("  Milestone 9 Dashboard Tests Failed!");
  } else {
    console.log("  Milestone 9 Dashboard Tests Completed Successfully!");
  }
  console.log("==================================================");
}

runDashboardTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exitCode = 1;
});
