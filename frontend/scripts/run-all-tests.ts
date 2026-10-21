import { execSync } from "child_process";
import path from "path";

interface TestSuite {
  name: string;
  file: string;
  description: string;
}

const testSuites: TestSuite[] = [
  {
    name: "Access Control Unit Tests",
    file: "tests/access-control.test.ts",
    description: "Multi-rule decision engine, door lock actions, fail-closed evaluation",
  },
  {
    name: "AI Reliability & Schema Contracts",
    file: "tests/phase3-ai-reliability.test.ts",
    description: "FastAPI Zod response schemas, 512D vectors, quality thresholds",
  },
  {
    name: "ImageKit Storage Verification",
    file: "tests/imagekit-url.test.ts",
    description: "Asset upload, canonical CDN delivery URLs, fileId deletion",
  },
  {
    name: "System Health & Cache Synchronization",
    file: "tests/health-sync.test.ts",
    description: "Multi-service health probes, 15s TTL cache, force refresh bypass",
  },
  {
    name: "Device Management & Auth Isolation",
    file: "tests/devices.test.ts",
    description: "Device registration, SHA-256 API key hashing, zero vector leakage",
  },
  {
    name: "Security Dashboard & Metrics",
    file: "tests/dashboard.test.ts",
    description: "Database aggregation queries, recognition breakdown, admin authorization",
  },
  {
    name: "Webcam Simulation Pipeline",
    file: "tests/webcam-simulation.test.ts",
    description: "Frame submission, throttling guard, fail-safe error classification",
  },
  {
    name: "Phase 2 Security & Duplicate Remediation",
    file: "tests/phase2-remediation.test.ts",
    description: "Duplicate precheck, concurrent submissions, suspended person alerts",
  },
  {
    name: "Access Control Integration",
    file: "tests/access.test.ts",
    description: "Full access verification pipeline, AccessLog & Alert persistence",
  },
  {
    name: "Face Recognition & pgvector Verification",
    file: "tests/recognition.test.ts",
    description: "Multi-face rejection, zero-face rejection, pgvector distance query",
  },
  {
    name: "Person Management & Replacement Lifecycle",
    file: "tests/management.test.ts",
    description: "Person CRUD, single-active embedding lifecycle, cascading deletions",
  },
  {
    name: "Phase 4 End-to-End Workflow Journeys",
    file: "tests/e2e-workflow.test.ts",
    description: "Complete user journeys A through F (registration, denial, failure, alerts)",
  },
];

async function runAll() {
  const overallStart = Date.now();
  console.log("================================================================");
  console.log("       IntelliGuard Comprehensive Test Suite Runner             ");
  console.log("================================================================\n");
  console.log(`Discovered ${testSuites.length} test suites to execute.\n`);

  let passed = 0;
  let failed = 0;
  const results: Array<{ name: string; durationMs: number; status: "PASSED" | "FAILED" }> = [];

  for (let i = 0; i < testSuites.length; i++) {
    const suite = testSuites[i];
    console.log(`[${i + 1}/${testSuites.length}] Running: ${suite.name} (${suite.file})...`);
    const suiteStart = Date.now();

    try {
      execSync(`npx tsx ${suite.file}`, {
        cwd: path.resolve(__dirname, ".."),
        stdio: "inherit",
        env: { ...process.env },
      });
      const durationMs = Date.now() - suiteStart;
      console.log(`✅ ${suite.name} completed in ${(durationMs / 1000).toFixed(2)}s\n`);
      passed++;
      results.push({ name: suite.name, durationMs, status: "PASSED" });
    } catch (err) {
      const durationMs = Date.now() - suiteStart;
      console.error(`❌ ${suite.name} FAILED in ${(durationMs / 1000).toFixed(2)}s\n`);
      failed++;
      results.push({ name: suite.name, durationMs, status: "FAILED" });
    }
  }

  const totalTime = ((Date.now() - overallStart) / 1000).toFixed(2);
  console.log("================================================================");
  console.log("                    Test Execution Summary                      ");
  console.log("================================================================\n");
  console.table(results);
  console.log(`\nTotal Suites: ${testSuites.length} | Passed: ${passed} | Failed: ${failed} | Time: ${totalTime}s\n`);

  if (failed > 0) {
    console.error("❌ Test run failed: one or more suites failed.");
    process.exit(1);
  } else {
    console.log("✨ All test suites passed successfully!");
  }
}

runAll().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
