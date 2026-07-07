import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type StepStatus = "ready" | "skipped" | "pass" | "fail";

interface BootstrapStep {
  name: string;
  command: string[];
  status: StepStatus;
  detail: string;
}

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);

function npmConfigFlag(name: string) {
  return process.env[`npm_config_${name.replace(/-/g, "_")}`] === "true";
}

function hasFlag(name: string) {
  return args.has(name) || args.has(`--${name}`) || npmConfigFlag(name);
}

const execute = hasFlag("execute");
const expectMvp = hasFlag("expect-mvp") || process.env.EXPECT_MVP === "1";
const expectDatabase = hasFlag("expect-database") || process.env.EXPECT_DATABASE === "1";
const expectGitHub = hasFlag("expect-github") || process.env.EXPECT_GITHUB === "1";
const expectBlob = hasFlag("expect-blob") || process.env.EXPECT_BLOB === "1";
const verifyBlobWrite = hasFlag("verify-blob-write") || process.env.VERIFY_BLOB_WRITE === "1";
const expectRedis = hasFlag("expect-redis") || process.env.EXPECT_UPSTASH_REDIS === "1";
const expectOpenAi = hasFlag("expect-openai") || process.env.EXPECT_OPENAI === "1";
const expectSiteUrl = hasFlag("expect-site-url") || process.env.EXPECT_SITE_URL === "1";
const expectVercelDeploy = hasFlag("expect-vercel-deploy") || process.env.EXPECT_VERCEL_DEPLOY === "1";
const verifyCronSecret = process.env.VERIFY_CRON_SECRET || process.env.CRON_SECRET || "";
const verifyAdminToken = process.env.VERIFY_ADMIN_TOKEN || process.env.ADMIN_TOKEN || "";
const vercelLinkDir = process.env.VERCEL_LINK_DIR || ".vercel";

function readUrl() {
  const urlFlagIndex = process.argv.indexOf("--url");
  if (urlFlagIndex >= 0) return process.argv[urlFlagIndex + 1] ?? "";
  const positional = rawArgs.find((item) => /^https?:\/\//.test(item));
  return positional ?? process.env.DEPLOYMENT_BASE_URL ?? "";
}

const productionUrl = readUrl();
const steps: BootstrapStep[] = [];
const strictMvpEnvKeys = [
  "DATABASE_URL",
  "CRON_SECRET",
  "ADMIN_TOKEN",
  "GITHUB_TOKEN",
  "BLOB_READ_WRITE_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN"
];

function addStep(name: string, command: string[], skipped: boolean, detail: string) {
  steps.push({
    name,
    command,
    status: skipped ? "skipped" : "ready",
    detail
  });
}

function hasEnv(name: string) {
  return Boolean(process.env[name]);
}

function hasSiteUrlEnv() {
  return hasEnv("SITE_URL") || hasEnv("NEXT_PUBLIC_SITE_URL");
}

function hasVercelProjectLink() {
  if (hasEnv("VERCEL_PROJECT_ID") && hasEnv("VERCEL_ORG_ID")) return true;
  if (existsSync(join(vercelLinkDir, "project.json"))) return true;

  try {
    const repoLink = JSON.parse(readFileSync(join(vercelLinkDir, "repo.json"), "utf8")) as {
      projects?: Array<{ id?: string; orgId?: string; directory?: string }>;
    };
    return Boolean(repoLink.projects?.some((project) => (project.directory === "." || project.directory === undefined) && project.id && project.orgId));
  } catch {
    return false;
  }
}

addStep(
  "vercel-preflight",
  ["npm", "run", "vercel:preflight", "--", productionUrl || "<production-url>"],
  !productionUrl,
  productionUrl ? "Check Vercel project link, production URL, canonical URL and Cron config." : "Skipped because no production URL was provided."
);

addStep(
  "mvp-check",
  ["npm", "run", "mvp:check", "--", productionUrl || "<production-url>"],
  !productionUrl,
  productionUrl ? "Check local readiness and production URL." : "Skipped because no production URL was provided."
);

addStep(
  "database-migrate",
  ["npm", "run", "db:migrate"],
  !hasEnv("DATABASE_URL"),
  hasEnv("DATABASE_URL") ? "Apply Drizzle migrations to the configured Postgres database." : "Skipped because DATABASE_URL is not configured."
);

addStep(
  "database-import",
  ["npm", "run", "db:import"],
  !hasEnv("DATABASE_URL"),
  hasEnv("DATABASE_URL") ? "Import YAML resources into the configured Postgres database." : "Skipped because DATABASE_URL is not configured."
);

addStep(
  "database-verify",
  ["npm", "run", "db:verify"],
  !hasEnv("DATABASE_URL") && !expectDatabase,
  expectDatabase ? "Strictly verify database schema and imported data." : "Verify database if configured; otherwise report a warning."
);

addStep(
  "integrations-verify",
  ["npm", "run", "integrations:verify"],
  false,
  "Verify GitHub, Blob and Redis integrations according to expectation flags."
);

addStep(
  "deployment-verify",
  ["npm", "run", "deployment:verify", "--", productionUrl || "<production-url>"],
  !productionUrl,
  productionUrl ? "Verify production pages, APIs and guards." : "Skipped because no production URL was provided."
);

if (!execute) {
  const blockingIssues = [
    ...(!productionUrl ? ["Production URL is required."] : []),
    ...(expectMvp
      ? strictMvpEnvKeys.filter((name) => !hasEnv(name)).map((name) => `${name} is required by expect-mvp.`)
      : []),
    ...(expectDatabase && !hasEnv("DATABASE_URL") ? ["DATABASE_URL is required by expect-database."] : []),
    ...(expectGitHub && !hasEnv("GITHUB_TOKEN") ? ["GITHUB_TOKEN is required by expect-github."] : []),
    ...(expectBlob && !hasEnv("BLOB_READ_WRITE_TOKEN") ? ["BLOB_READ_WRITE_TOKEN is required by expect-blob."] : []),
    ...(expectRedis && (!hasEnv("UPSTASH_REDIS_REST_URL") || !hasEnv("UPSTASH_REDIS_REST_TOKEN"))
      ? ["UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required by expect-redis."]
      : []),
    ...(expectSiteUrl && !hasSiteUrlEnv() ? ["SITE_URL or NEXT_PUBLIC_SITE_URL is required by expect-site-url."] : []),
    ...(expectVercelDeploy && !hasEnv("VERCEL_TOKEN") ? ["VERCEL_TOKEN is required by expect-vercel-deploy."] : []),
    ...(expectVercelDeploy && !hasVercelProjectLink()
      ? ["Vercel project link is required by expect-vercel-deploy. Run `npx vercel link` or set VERCEL_PROJECT_ID and VERCEL_ORG_ID."]
      : []),
    ...(expectOpenAi && !hasEnv("OPENAI_API_KEY") ? ["OPENAI_API_KEY is required by expect-openai."] : [])
  ];

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        mode: "plan",
        productionUrl: productionUrl || null,
        expectations: {
          mvp: expectMvp,
          database: expectDatabase,
          github: expectGitHub,
          blob: expectBlob,
          blobWrite: verifyBlobWrite,
          upstashRedis: expectRedis,
          openai: expectOpenAi,
          siteUrl: expectSiteUrl,
          vercelDeploy: expectVercelDeploy,
          cronDryRun: Boolean(verifyCronSecret),
          adminReadiness: Boolean(verifyAdminToken)
        },
        blockingIssues,
        steps
      },
      null,
      2
    )
  );
  if (blockingIssues.length > 0) process.exitCode = 1;
  process.exit();
}

function runStep(step: BootstrapStep) {
  if (step.status === "skipped") return step;
  const [script, ...scriptArgs] = step.command.slice(2);
  const npmExecPath = process.env.npm_execpath;
  const command = npmExecPath ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
  const commandArgs = npmExecPath ? [npmExecPath, "run", script, ...scriptArgs] : ["run", script, ...scriptArgs];
  const env = {
    ...process.env,
    ...(expectMvp ? { EXPECT_MVP: "1" } : {}),
    ...(expectDatabase ? { EXPECT_DATABASE: "1" } : {}),
    ...(expectGitHub ? { EXPECT_GITHUB: "1" } : {}),
    ...(expectBlob ? { EXPECT_BLOB: "1" } : {}),
    ...(verifyBlobWrite ? { VERIFY_BLOB_WRITE: "1" } : {}),
    ...(expectRedis ? { EXPECT_UPSTASH_REDIS: "1" } : {}),
    ...(expectOpenAi ? { EXPECT_OPENAI: "1" } : {}),
    ...(expectSiteUrl ? { EXPECT_SITE_URL: "1" } : {}),
    ...(expectVercelDeploy ? { EXPECT_VERCEL_DEPLOY: "1" } : {}),
    ...(verifyCronSecret ? { VERIFY_CRON_SECRET: verifyCronSecret } : {}),
    ...(verifyAdminToken ? { VERIFY_ADMIN_TOKEN: verifyAdminToken } : {}),
    ...(productionUrl ? { DEPLOYMENT_BASE_URL: productionUrl } : {})
  };
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
    stdio: "inherit"
  });
  const failureDetail = result.error?.message ?? `Exit code ${result.status ?? "unknown"}.`;
  return {
    ...step,
    status: result.status === 0 ? "pass" : "fail",
    detail: result.status === 0 ? step.detail : `${step.detail} ${failureDetail}`
  } satisfies BootstrapStep;
}

const executedSteps: BootstrapStep[] = [];
let failed = false;

for (const step of steps) {
  if (failed && step.status !== "skipped") {
    executedSteps.push({
      ...step,
      status: "skipped",
      detail: "Skipped because a previous bootstrap step failed."
    });
    continue;
  }

  const executedStep = runStep(step);
  executedSteps.push(executedStep);
  if (executedStep.status === "fail") failed = true;
}
const summary = {
  pass: executedSteps.filter((step) => step.status === "pass").length,
  skipped: executedSteps.filter((step) => step.status === "skipped").length,
  fail: executedSteps.filter((step) => step.status === "fail").length
};

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      mode: "execute",
      productionUrl: productionUrl || null,
      strictMvp: expectMvp,
      strictVercelDeploy: expectVercelDeploy,
      cronDryRun: Boolean(verifyCronSecret),
      adminReadiness: Boolean(verifyAdminToken),
      summary,
      steps: executedSteps
    },
    null,
    2
  )
);

if (summary.fail > 0) {
  process.exitCode = 1;
}
