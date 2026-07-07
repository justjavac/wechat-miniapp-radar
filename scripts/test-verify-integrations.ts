import assert from "node:assert/strict";
import { spawn } from "node:child_process";

type VerifyIntegrationsOutput = {
  summary?: {
    pass?: number;
    warn?: number;
    fail?: number;
  };
  checks?: Array<{
    name: string;
    status: "pass" | "warn" | "fail";
    detail: string;
  }>;
};

async function runVerifyIntegrations(extraEnv: Record<string, string | undefined> = {}) {
  return await new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/verify-integrations.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        GITHUB_TOKEN: undefined,
        BLOB_READ_WRITE_TOKEN: undefined,
        UPSTASH_REDIS_REST_URL: undefined,
        UPSTASH_REDIS_REST_TOKEN: undefined,
        ...extraEnv
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("integration verifier test timed out"));
    }, 15_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (status) => {
      clearTimeout(timeout);
      resolve({ status, stdout, stderr });
    });
  });
}

function parseOutput(stdout: string): VerifyIntegrationsOutput {
  const start = stdout.indexOf("{");
  assert.notEqual(start, -1, `integration verifier should print JSON output, got: ${stdout}`);
  return JSON.parse(stdout.slice(start)) as VerifyIntegrationsOutput;
}

const baseline = await runVerifyIntegrations();
assert.equal(baseline.status, 0, baseline.stderr);
const baselineOutput = parseOutput(baseline.stdout);
assert.equal(baselineOutput.summary?.fail, 0);
assert.equal(baselineOutput.summary?.warn, 3);
assert.equal(baselineOutput.checks?.find((check) => check.name === "integration:github")?.status, "warn");
assert.equal(baselineOutput.checks?.find((check) => check.name === "integration:blob")?.status, "warn");
assert.equal(baselineOutput.checks?.find((check) => check.name === "integration:upstash_redis")?.status, "warn");

const strict = await runVerifyIntegrations({ EXPECT_GITHUB: "1", EXPECT_BLOB: "1", EXPECT_UPSTASH_REDIS: "1" });
assert.equal(strict.status, 1, "strict expectations should fail without GitHub, Blob, and Upstash credentials");
const strictOutput = parseOutput(strict.stdout);
assert.equal(strictOutput.summary?.fail, 3);
assert.equal(strictOutput.checks?.find((check) => check.name === "integration:github")?.status, "fail");
assert.equal(strictOutput.checks?.find((check) => check.name === "integration:blob")?.status, "fail");
assert.equal(strictOutput.checks?.find((check) => check.name === "integration:upstash_redis")?.status, "fail");

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      cases: 2,
      assertions: ["integration verifier baseline", "strict integration expectations"]
    },
    null,
    2
  )
);
