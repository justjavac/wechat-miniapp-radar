import assert from "node:assert/strict";
import { spawn } from "node:child_process";

type MvpCheckOutput = {
  strictMvp?: boolean;
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

const envKeys = [
  "DEPLOYMENT_BASE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "SITE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "EXPECT_MVP",
  "EXPECT_OPENAI",
  "EXPECT_SITE_URL",
  "DATABASE_URL",
  "CRON_SECRET",
  "ADMIN_TOKEN",
  "GITHUB_TOKEN",
  "BLOB_READ_WRITE_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "OPENAI_API_KEY",
  "OPENAI_API_URL"
];

function parseOutput(stdout: string): MvpCheckOutput {
  const start = stdout.indexOf("{");
  assert.notEqual(start, -1, `mvp check should print JSON, got: ${stdout}`);
  return JSON.parse(stdout.slice(start)) as MvpCheckOutput;
}

async function runMvpCheck(extraEnv: Record<string, string | undefined> = {}, args: string[] = []) {
  return await new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const env = { ...process.env };
    for (const key of envKeys) delete env[key];

    const child = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/mvp-check.ts", ...args], {
      cwd: process.cwd(),
      env: {
        ...env,
        ...extraEnv
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("mvp check test timed out"));
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

const baseline = await runMvpCheck();
assert.equal(baseline.status, 0, baseline.stderr);
const baselineOutput = parseOutput(baseline.stdout);
assert.equal(baselineOutput.summary?.fail, 0, "baseline should not fail when external services are not expected");
assert.ok((baselineOutput.summary?.warn ?? 0) > 0, "baseline should warn about missing external deployment state");
assert.equal(baselineOutput.checks?.find((check) => check.name === "data:resources-snapshot")?.status, "pass");
assert.equal(baselineOutput.checks?.find((check) => check.name === "local:compare-page")?.status, "pass");
assert.equal(baselineOutput.checks?.find((check) => check.name === "local:compare-api")?.status, "pass");
assert.equal(baselineOutput.checks?.find((check) => check.name === "local:cron-enrich-api")?.status, "pass");
assert.equal(baselineOutput.checks?.find((check) => check.name === "local:sitemap-route")?.status, "pass");
assert.equal(baselineOutput.checks?.find((check) => check.name === "local:vercel-production-workflow")?.status, "pass");
assert.equal(baselineOutput.checks?.find((check) => check.name === "script:site-url:test")?.status, "pass");
assert.equal(baselineOutput.checks?.find((check) => check.name === "script:vercel:preflight")?.status, "pass");
assert.equal(baselineOutput.checks?.find((check) => check.name === "script:production:bootstrap")?.status, "pass");
assert.equal(baselineOutput.checks?.find((check) => check.name === "external:production-url")?.status, "warn");
assert.equal(baselineOutput.checks?.find((check) => check.name === "env:SITE_URL")?.status, "warn");

const withUrl = await runMvpCheck({}, ["https://miniprogram-radar.example.com"]);
assert.equal(withUrl.status, 0, withUrl.stderr);
const withUrlOutput = parseOutput(withUrl.stdout);
assert.equal(withUrlOutput.checks?.find((check) => check.name === "external:production-url")?.status, "pass");

const strict = await runMvpCheck({ EXPECT_MVP: "1", EXPECT_OPENAI: "1" });
assert.equal(strict.status, 1, "strict MVP should fail when external deployment state is missing");
const strictOutput = parseOutput(strict.stdout);
assert.equal(strictOutput.strictMvp, true);
assert.ok((strictOutput.summary?.fail ?? 0) > 0, "strict MVP should report failures");
assert.equal(strictOutput.checks?.find((check) => check.name === "env:DATABASE_URL")?.status, "fail");
assert.equal(strictOutput.checks?.find((check) => check.name === "env:OPENAI_API_KEY")?.status, "fail");

const openRouterConfigured = await runMvpCheck({
  OPENAI_API_KEY: "test-openrouter-key",
  OPENAI_API_URL: "https://openrouter.ai/api/v1"
});
assert.equal(openRouterConfigured.status, 0, openRouterConfigured.stderr);
const openRouterConfiguredOutput = parseOutput(openRouterConfigured.stdout);
assert.equal(openRouterConfiguredOutput.checks?.find((check) => check.name === "env:OPENAI_API_KEY")?.status, "pass");
assert.equal(openRouterConfiguredOutput.checks?.find((check) => check.name === "env:OPENAI_API_URL")?.status, "pass");

const strictSiteUrl = await runMvpCheck({ EXPECT_SITE_URL: "1" });
assert.equal(strictSiteUrl.status, 1, "strict site URL expectation should fail without SITE_URL or NEXT_PUBLIC_SITE_URL");
const strictSiteUrlOutput = parseOutput(strictSiteUrl.stdout);
assert.equal(strictSiteUrlOutput.checks?.find((check) => check.name === "env:SITE_URL")?.status, "fail");

const strictSiteUrlConfigured = await runMvpCheck({
  EXPECT_SITE_URL: "1",
  SITE_URL: "https://miniprogram-radar.example.com"
});
assert.equal(strictSiteUrlConfigured.status, 0, strictSiteUrlConfigured.stderr);
const strictSiteUrlConfiguredOutput = parseOutput(strictSiteUrlConfigured.stdout);
assert.equal(strictSiteUrlConfiguredOutput.checks?.find((check) => check.name === "env:SITE_URL")?.status, "pass");

const strictMvpWithVercelKv = await runMvpCheck(
  {
    EXPECT_MVP: "1",
    DATABASE_URL: "postgres://example.invalid/miniprogram_radar",
    CRON_SECRET: "test-cron-secret",
    ADMIN_TOKEN: "test-admin-token",
    GITHUB_TOKEN: "test-github-token",
    BLOB_READ_WRITE_TOKEN: "test-blob-token",
    KV_REST_API_URL: "https://example.invalid",
    KV_REST_API_TOKEN: "test-redis-token"
  },
  ["https://miniprogram-radar.example.com"]
);
assert.equal(strictMvpWithVercelKv.status, 0, strictMvpWithVercelKv.stderr);
const strictMvpWithVercelKvOutput = parseOutput(strictMvpWithVercelKv.stdout);
assert.equal(strictMvpWithVercelKvOutput.checks?.find((check) => check.name === "env:UPSTASH_REDIS")?.status, "pass");

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      cases: 7,
      assertions: [
        "baseline external warnings",
        "product module checks",
        "production readiness checks",
        "production URL argument",
        "strict MVP external failures",
        "strict OpenAI expectation",
        "OpenRouter-compatible AI endpoint",
        "strict site URL expectation",
        "strict site URL configured",
        "strict MVP accepts Vercel KV Redis env aliases"
      ]
    },
    null,
    2
  )
);
