import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type BootstrapOutput = {
  mode?: string;
  productionUrl?: string | null;
  expectations?: {
    mvp?: boolean;
    database?: boolean;
    cronDryRun?: boolean;
    adminReadiness?: boolean;
    siteUrl?: boolean;
    vercelDeploy?: boolean;
  };
  blockingIssues?: string[];
  steps?: Array<{
    name: string;
    status: "ready" | "skipped" | "pass" | "fail";
    command: string[];
  }>;
};

const envKeys = [
  "DEPLOYMENT_BASE_URL",
  "DATABASE_URL",
  "GITHUB_TOKEN",
  "BLOB_READ_WRITE_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "OPENAI_API_KEY",
  "SITE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "CRON_SECRET",
  "VERIFY_CRON_SECRET",
  "VERIFY_ADMIN_TOKEN",
  "npm_config_expect_mvp",
  "npm_config_execute",
  "EXPECT_MVP",
  "EXPECT_DATABASE",
  "EXPECT_GITHUB",
  "EXPECT_BLOB",
  "EXPECT_UPSTASH_REDIS",
  "EXPECT_OPENAI",
  "EXPECT_SITE_URL",
  "EXPECT_VERCEL_DEPLOY",
  "VERCEL_TOKEN",
  "VERCEL_PROJECT_ID",
  "VERCEL_ORG_ID",
  "VERCEL_LINK_DIR",
  "VERIFY_BLOB_WRITE"
];

function parseOutput(stdout: string): BootstrapOutput {
  const start = stdout.lastIndexOf("\n{");
  const normalizedStart = start === -1 ? stdout.indexOf("{") : start + 1;
  assert.notEqual(normalizedStart, -1, `production bootstrap should print JSON, got: ${stdout}`);
  return JSON.parse(stdout.slice(normalizedStart)) as BootstrapOutput;
}

async function runBootstrap(args: string[], extraEnv: Record<string, string | undefined> = {}) {
  return await new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const env = { ...process.env };
    for (const key of envKeys) delete env[key];

    const child = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/production-bootstrap.ts", ...args], {
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
      reject(new Error("production bootstrap test timed out"));
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

const withUrl = await runBootstrap(["--url", "https://miniprogram-radar.example.com"]);
assert.equal(withUrl.status, 0, withUrl.stderr);
const withUrlOutput = parseOutput(withUrl.stdout);
assert.equal(withUrlOutput.mode, "plan");
assert.equal(withUrlOutput.productionUrl, "https://miniprogram-radar.example.com");
assert.equal(withUrlOutput.steps?.find((step) => step.name === "vercel-preflight")?.status, "ready");
assert.equal(withUrlOutput.steps?.find((step) => step.name === "mvp-check")?.status, "ready");
assert.equal(withUrlOutput.steps?.find((step) => step.name === "database-migrate")?.status, "skipped");
assert.equal(withUrlOutput.steps?.find((step) => step.name === "deployment-verify")?.status, "ready");

const missingUrl = await runBootstrap([]);
assert.equal(missingUrl.status, 1, "missing production URL should fail the bootstrap plan");
const missingUrlOutput = parseOutput(missingUrl.stdout);
assert.equal(missingUrlOutput.steps?.find((step) => step.name === "vercel-preflight")?.status, "skipped");
assert.equal(missingUrlOutput.steps?.find((step) => step.name === "mvp-check")?.status, "skipped");

const strictDb = await runBootstrap(["--url", "https://miniprogram-radar.example.com", "--expect-database"]);
assert.equal(strictDb.status, 1, "strict database expectation should fail without DATABASE_URL");
const strictDbOutput = parseOutput(strictDb.stdout);
assert.equal(strictDbOutput.expectations?.database, true);

const withCronSecret = await runBootstrap(["https://miniprogram-radar.example.com"], {
  CRON_SECRET: "test-cron-secret"
});
assert.equal(withCronSecret.status, 0, withCronSecret.stderr);
const withCronSecretOutput = parseOutput(withCronSecret.stdout);
assert.equal(withCronSecretOutput.expectations?.cronDryRun, true, "CRON_SECRET should enable deployment verifier cron dry-run");

const withAdminToken = await runBootstrap(["https://miniprogram-radar.example.com"], {
  ADMIN_TOKEN: "test-admin-token"
});
assert.equal(withAdminToken.status, 0, withAdminToken.stderr);
const withAdminTokenOutput = parseOutput(withAdminToken.stdout);
assert.equal(withAdminTokenOutput.expectations?.adminReadiness, true, "ADMIN_TOKEN should enable deployment verifier admin readiness probe");

const withExplicitAdminVerifyToken = await runBootstrap(["https://miniprogram-radar.example.com"], {
  VERIFY_ADMIN_TOKEN: "test-admin-verify-token"
});
assert.equal(withExplicitAdminVerifyToken.status, 0, withExplicitAdminVerifyToken.stderr);
const withExplicitAdminVerifyTokenOutput = parseOutput(withExplicitAdminVerifyToken.stdout);
assert.equal(withExplicitAdminVerifyTokenOutput.expectations?.adminReadiness, true, "VERIFY_ADMIN_TOKEN should enable deployment verifier admin readiness probe");

const strictMvp = await runBootstrap(["https://miniprogram-radar.example.com", "--expect-mvp"]);
assert.equal(strictMvp.status, 1, "strict MVP should fail without required production env vars");
const strictMvpOutput = parseOutput(strictMvp.stdout);
assert.equal(strictMvpOutput.expectations?.mvp, true, "--expect-mvp should enable strict MVP mode");
assert.ok((strictMvpOutput.blockingIssues?.length ?? 0) > 0, "strict MVP should report missing production env vars");

const strictMvpEnv = await runBootstrap(["https://miniprogram-radar.example.com"], {
  EXPECT_MVP: "1"
});
assert.equal(strictMvpEnv.status, 1, "EXPECT_MVP should fail without required production env vars");
const strictMvpEnvOutput = parseOutput(strictMvpEnv.stdout);
assert.equal(strictMvpEnvOutput.expectations?.mvp, true, "EXPECT_MVP should enable strict MVP mode");

const strictMvpNpmConfig = await runBootstrap(["https://miniprogram-radar.example.com"], {
  npm_config_expect_mvp: "true"
});
assert.equal(strictMvpNpmConfig.status, 1, "npm_config_expect_mvp should fail without required production env vars");
const strictMvpNpmConfigOutput = parseOutput(strictMvpNpmConfig.stdout);
assert.equal(strictMvpNpmConfigOutput.expectations?.mvp, true, "npm_config_expect_mvp should enable strict MVP mode");

const strictMvpToken = await runBootstrap(["https://miniprogram-radar.example.com", "expect-mvp"]);
assert.equal(strictMvpToken.status, 1, "expect-mvp token should fail without required production env vars");
const strictMvpTokenOutput = parseOutput(strictMvpToken.stdout);
assert.equal(strictMvpTokenOutput.expectations?.mvp, true, "expect-mvp token should enable strict MVP mode");

const strictMvpConfigured = await runBootstrap(["https://miniprogram-radar.example.com", "expect-mvp"], {
  DATABASE_URL: "postgres://example.invalid/miniprogram_radar",
  CRON_SECRET: "test-cron-secret",
  ADMIN_TOKEN: "test-admin-token",
  GITHUB_TOKEN: "test-github-token",
  BLOB_READ_WRITE_TOKEN: "test-blob-token",
  UPSTASH_REDIS_REST_URL: "https://example.invalid",
  UPSTASH_REDIS_REST_TOKEN: "test-redis-token"
});
assert.equal(strictMvpConfigured.status, 0, strictMvpConfigured.stderr);
const strictMvpConfiguredOutput = parseOutput(strictMvpConfigured.stdout);
assert.deepEqual(strictMvpConfiguredOutput.blockingIssues, [], "strict MVP should pass plan preflight when required env vars are present");

const strictSiteUrl = await runBootstrap(["https://miniprogram-radar.example.com", "--expect-site-url"]);
assert.equal(strictSiteUrl.status, 1, "strict site URL expectation should fail without SITE_URL or NEXT_PUBLIC_SITE_URL");
const strictSiteUrlOutput = parseOutput(strictSiteUrl.stdout);
assert.equal(strictSiteUrlOutput.expectations?.siteUrl, true, "--expect-site-url should enable strict canonical URL mode");
assert.ok(
  strictSiteUrlOutput.blockingIssues?.includes("SITE_URL or NEXT_PUBLIC_SITE_URL is required by expect-site-url."),
  "strict site URL should report missing canonical URL env"
);

const strictSiteUrlConfigured = await runBootstrap(["https://miniprogram-radar.example.com", "expect-site-url"], {
  SITE_URL: "https://miniprogram-radar.example.com"
});
assert.equal(strictSiteUrlConfigured.status, 0, strictSiteUrlConfigured.stderr);
const strictSiteUrlConfiguredOutput = parseOutput(strictSiteUrlConfigured.stdout);
assert.deepEqual(strictSiteUrlConfiguredOutput.blockingIssues, [], "strict site URL should pass when SITE_URL is configured");

const strictVercelDeploy = await runBootstrap(["https://miniprogram-radar.example.com", "--expect-vercel-deploy"]);
assert.equal(strictVercelDeploy.status, 1, "strict Vercel deploy expectation should fail without Vercel token and project link");
const strictVercelDeployOutput = parseOutput(strictVercelDeploy.stdout);
assert.equal(strictVercelDeployOutput.expectations?.vercelDeploy, true, "--expect-vercel-deploy should enable strict Vercel deploy mode");
assert.ok(
  strictVercelDeployOutput.blockingIssues?.some((issue) => issue.includes("VERCEL_TOKEN")),
  "strict Vercel deploy should report missing token"
);
assert.ok(
  strictVercelDeployOutput.blockingIssues?.some((issue) => issue.includes("Vercel project link")),
  "strict Vercel deploy should report missing project link"
);

const strictVercelDeployConfigured = await runBootstrap(["https://miniprogram-radar.example.com", "expect-vercel-deploy"], {
  VERCEL_TOKEN: "test-vercel-token",
  VERCEL_PROJECT_ID: "prj_test",
  VERCEL_ORG_ID: "team_test",
  SITE_URL: "https://miniprogram-radar.example.com"
});
assert.equal(strictVercelDeployConfigured.status, 0, strictVercelDeployConfigured.stderr);
const strictVercelDeployConfiguredOutput = parseOutput(strictVercelDeployConfigured.stdout);
assert.deepEqual(strictVercelDeployConfiguredOutput.blockingIssues, [], "strict Vercel deploy should pass when token and project link are configured");

const repoLinkDir = mkdtempSync(join(tmpdir(), "vercel-bootstrap-link-"));
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
  const strictVercelDeployRepoLinked = await runBootstrap(["https://miniprogram-radar.example.com", "expect-vercel-deploy"], {
    VERCEL_TOKEN: "test-vercel-token",
    VERCEL_LINK_DIR: repoLinkDir,
    SITE_URL: "https://miniprogram-radar.example.com"
  });
  assert.equal(strictVercelDeployRepoLinked.status, 0, strictVercelDeployRepoLinked.stderr);
  const strictVercelDeployRepoLinkedOutput = parseOutput(strictVercelDeployRepoLinked.stdout);
  assert.deepEqual(strictVercelDeployRepoLinkedOutput.blockingIssues, [], "strict Vercel deploy should pass with Vercel CLI repo.json link");
} finally {
  rmSync(repoLinkDir, { recursive: true, force: true });
}

const executeStopsAfterPreflightFailure = await runBootstrap(["https://miniprogram-radar.example.com", "execute", "expect-vercel-deploy"]);
assert.equal(executeStopsAfterPreflightFailure.status, 1, "execute mode should fail when strict Vercel preflight fails");
const executeStopsAfterPreflightFailureOutput = parseOutput(executeStopsAfterPreflightFailure.stdout);
assert.equal(executeStopsAfterPreflightFailureOutput.mode, "execute");
assert.equal(executeStopsAfterPreflightFailureOutput.steps?.find((step) => step.name === "vercel-preflight")?.status, "fail");
assert.equal(executeStopsAfterPreflightFailureOutput.steps?.find((step) => step.name === "mvp-check")?.status, "skipped");
assert.equal(executeStopsAfterPreflightFailureOutput.steps?.find((step) => step.name === "deployment-verify")?.status, "skipped");

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      cases: 17,
      assertions: [
        "production bootstrap plan with URL",
        "missing production URL failure",
        "vercel preflight step",
        "strict database expectation failure",
        "cron secret dry-run detection",
        "admin token readiness detection",
        "explicit admin verify token readiness detection",
        "strict MVP CLI flag",
        "strict MVP env flag",
        "strict MVP npm config flag",
        "strict MVP token flag",
        "strict MVP required env preflight",
        "strict site URL expectation",
        "strict site URL configured preflight",
        "strict Vercel deploy expectation",
        "strict Vercel deploy configured preflight",
        "strict Vercel deploy repo.json preflight",
        "execute mode stops after failed preflight"
      ]
    },
    null,
    2
  )
);
