import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type PreflightOutput = {
  strictDeploy?: boolean;
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
  nextCommands?: string[];
};

const envKeys = [
  "EXPECT_VERCEL_DEPLOY",
  "RUN_VERCEL_CLI_CHECK",
  "VERCEL_TOKEN",
  "VERCEL_PROJECT_ID",
  "VERCEL_ORG_ID",
  "DEPLOYMENT_BASE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
  "SITE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "VERCEL_LINK_DIR",
  "DATABASE_URL",
  "CRON_SECRET",
  "ADMIN_TOKEN",
  "GITHUB_TOKEN",
  "BLOB_READ_WRITE_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "OPENAI_API_KEY"
];

function parseOutput(stdout: string): PreflightOutput {
  const start = stdout.indexOf("{");
  assert.notEqual(start, -1, `preflight should print JSON, got: ${stdout}`);
  return JSON.parse(stdout.slice(start)) as PreflightOutput;
}

async function runPreflight(extraEnv: Record<string, string | undefined> = {}, args: string[] = []) {
  return await new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const env = { ...process.env };
    for (const key of envKeys) delete env[key];

    const child = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/vercel-preflight.ts", ...args], {
      cwd: process.cwd(),
      env: {
        ...env,
        VERCEL_LINK_DIR: join(process.cwd(), ".vercel-missing-test-link"),
        ...extraEnv
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("vercel preflight test timed out"));
    }, 30_000);

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

const baseline = await runPreflight();
assert.equal(baseline.status, 0, baseline.stderr);
const baselineOutput = parseOutput(baseline.stdout);
assert.equal(baselineOutput.summary?.fail, 0);
assert.ok((baselineOutput.summary?.warn ?? 0) > 0, "baseline should warn about missing Vercel external state");
assert.equal(baselineOutput.checks?.find((check) => check.name === "vercel:project-link")?.status, "warn");
assert.equal(baselineOutput.checks?.find((check) => check.name === "vercel:token")?.status, "warn");
assert.equal(baselineOutput.checks?.find((check) => check.name === "vercel:production-url")?.status, "warn");
assert.equal(baselineOutput.checks?.find((check) => check.name === "env:SITE_URL")?.status, "warn");
assert.equal(baselineOutput.checks?.find((check) => check.name === "vercel:cli")?.status, "warn");
assert.ok(baselineOutput.nextCommands?.some((command) => command.includes("production:bootstrap")));
assert.ok(baselineOutput.nextCommands?.some((command) => command.includes("VERIFY_ADMIN_TOKEN=<ADMIN_TOKEN>")), "preflight should suggest authorized admin readiness verification");

const strict = await runPreflight({ EXPECT_VERCEL_DEPLOY: "1" });
assert.equal(strict.status, 1, "strict deploy preflight should fail without project link and production URL");
const strictOutput = parseOutput(strict.stdout);
assert.equal(strictOutput.strictDeploy, true);
assert.equal(strictOutput.checks?.find((check) => check.name === "vercel:project-link")?.status, "fail");
assert.equal(strictOutput.checks?.find((check) => check.name === "vercel:token")?.status, "fail");
assert.equal(strictOutput.checks?.find((check) => check.name === "vercel:production-url")?.status, "fail");
assert.equal(strictOutput.checks?.find((check) => check.name === "env:SITE_URL")?.status, "fail");

const repoLinkDir = mkdtempSync(join(tmpdir(), "vercel-repo-link-"));
try {
  writeFileSync(
    join(repoLinkDir, "repo.json"),
    JSON.stringify({
      projects: [
        {
          id: "prj_test",
          orgId: "team_test",
          directory: "."
        }
      ]
    })
  );
  const repoLinked = await runPreflight({ VERCEL_LINK_DIR: repoLinkDir }, ["https://miniprogram-radar.example.com"]);
  assert.equal(repoLinked.status, 0, repoLinked.stderr);
  const repoLinkedOutput = parseOutput(repoLinked.stdout);
  assert.equal(repoLinkedOutput.checks?.find((check) => check.name === "vercel:project-link")?.status, "pass");
} finally {
  rmSync(repoLinkDir, { recursive: true, force: true });
}

const configured = await runPreflight(
  {
    EXPECT_VERCEL_DEPLOY: "1",
    VERCEL_PROJECT_ID: "prj_test",
    VERCEL_ORG_ID: "team_test",
    VERCEL_TOKEN: "test-token",
    SITE_URL: "https://miniprogram-radar.example.com"
  },
  ["https://miniprogram-radar.example.com"]
);
assert.equal(configured.status, 0, configured.stderr);
const configuredOutput = parseOutput(configured.stdout);
assert.equal(configuredOutput.checks?.find((check) => check.name === "vercel:project-link")?.status, "pass");
assert.equal(configuredOutput.checks?.find((check) => check.name === "vercel:token")?.status, "pass");
assert.equal(configuredOutput.checks?.find((check) => check.name === "vercel:production-url")?.status, "pass");
assert.equal(configuredOutput.checks?.find((check) => check.name === "env:SITE_URL")?.status, "pass");
assert.equal(configuredOutput.checks?.find((check) => check.name === "vercel:cli")?.status, "warn");

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      cases: 4,
      assertions: [
        "baseline external warnings",
        "strict deploy external failures",
        "repo.json project link detection",
        "configured non-interactive deploy state",
        "cli probe skipped unless explicitly requested",
        "next command guidance"
      ]
    },
    null,
    2
  )
);
