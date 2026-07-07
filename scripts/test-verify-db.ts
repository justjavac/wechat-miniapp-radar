import assert from "node:assert/strict";
import { spawn } from "node:child_process";

type VerifyDbOutput = {
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

async function runVerifyDb(extraEnv: Record<string, string | undefined> = {}) {
  return await new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/verify-db.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: undefined,
        ...extraEnv
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("db verifier test timed out"));
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

function parseOutput(stdout: string): VerifyDbOutput {
  const start = stdout.indexOf("{");
  assert.notEqual(start, -1, `db verifier should print JSON output, got: ${stdout}`);
  return JSON.parse(stdout.slice(start)) as VerifyDbOutput;
}

const baseline = await runVerifyDb();
assert.equal(baseline.status, 0, baseline.stderr);
const baselineOutput = parseOutput(baseline.stdout);
assert.equal(baselineOutput.summary?.fail, 0);
assert.equal(baselineOutput.summary?.warn, 1);
assert.equal(baselineOutput.checks?.find((check) => check.name === "env:DATABASE_URL")?.status, "warn");

const strict = await runVerifyDb({ EXPECT_DATABASE: "1" });
assert.equal(strict.status, 1, "EXPECT_DATABASE=1 should fail without DATABASE_URL");
const strictOutput = parseOutput(strict.stdout);
assert.equal(strictOutput.summary?.fail, 1);
assert.equal(strictOutput.checks?.find((check) => check.name === "env:DATABASE_URL")?.status, "fail");

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      cases: 2,
      assertions: ["database verifier baseline", "strict database expectation"]
    },
    null,
    2
  )
);
