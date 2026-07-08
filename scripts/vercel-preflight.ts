import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getAiConfig, describeAiProvider } from "@/lib/ai-config";
import { describeUpstashRedisEnvRequirement, hasUpstashRedis } from "@/lib/upstash";

type CheckStatus = "pass" | "warn" | "fail";

interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

const strictDeploy = process.env.EXPECT_VERCEL_DEPLOY === "1";
const vercelLinkDir = process.env.VERCEL_LINK_DIR || ".vercel";
const checks: CheckResult[] = [];

function record(name: string, status: CheckStatus, detail: string) {
  checks.push({ name, status, detail });
}

function pass(name: string, detail: string) {
  record(name, "pass", detail);
}

function warnOrFail(name: string, detail: string, strict = strictDeploy) {
  record(name, strict ? "fail" : "warn", detail);
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function resolveProductionUrl() {
  return process.argv[2] ?? process.env.DEPLOYMENT_BASE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
}

function checkProductionUrl() {
  const value = resolveProductionUrl();
  if (!value) {
    warnOrFail("vercel:production-url", "No production URL provided. Pass one as an argument or set DEPLOYMENT_BASE_URL.");
    return;
  }

  try {
    const parsed = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      record("vercel:production-url", "fail", "Production URL must use http or https.");
      return;
    }
    pass("vercel:production-url", `Production URL is ${parsed.toString().replace(/\/$/, "")}.`);
  } catch {
    record("vercel:production-url", "fail", `Invalid production URL: ${value}.`);
  }
}

function checkCliToken() {
  if (process.env.VERCEL_TOKEN) {
    pass("vercel:token", "VERCEL_TOKEN is configured for non-interactive Vercel CLI use.");
    return;
  }

  warnOrFail("vercel:token", "VERCEL_TOKEN is not configured. Run `npx vercel login` locally or set a token for non-interactive deploys.");
}

async function checkProjectLink() {
  type ProjectLink = {
    projectId?: string;
    orgId?: string;
  };
  type RepoLink = {
    projects?: Array<{
      id?: string;
      orgId?: string;
      directory?: string;
    }>;
  };

  const projectLinkPath = join(vercelLinkDir, "project.json");
  const repoLinkPath = join(vercelLinkDir, "repo.json");
  const fileLink = await readJson<ProjectLink>(projectLinkPath);
  const repoLink = await readJson<RepoLink>(repoLinkPath);
  const currentRepoProject = repoLink?.projects?.find((project) => project.directory === "." || project.directory === undefined);
  const envLink = process.env.VERCEL_PROJECT_ID && process.env.VERCEL_ORG_ID;

  if (fileLink?.projectId && fileLink.orgId) {
    pass("vercel:project-link", `${projectLinkPath} contains projectId and orgId.`);
    return;
  }

  if (currentRepoProject?.id && currentRepoProject.orgId) {
    pass("vercel:project-link", `${repoLinkPath} contains project id and orgId.`);
    return;
  }

  if (envLink) {
    pass("vercel:project-link", "VERCEL_PROJECT_ID and VERCEL_ORG_ID are configured.");
    return;
  }

  warnOrFail("vercel:project-link", "Vercel project is not linked. Run `npx vercel link` after logging in.");
}

async function checkVercelConfig() {
  const vercel = await readJson<{ crons?: Array<{ path: string; schedule: string }> }>("vercel.json");
  if (!vercel) {
    record("vercel:config", "fail", "vercel.json is missing or invalid.");
    return;
  }

  pass("vercel:config", "vercel.json is readable.");
  for (const path of ["/api/cron/enrich", "/api/cron/weekly"]) {
    const cron = vercel.crons?.find((item) => item.path === path);
    record(`vercel:cron:${path}`, cron ? "pass" : "fail", cron ? `${path} scheduled as ${cron.schedule}.` : `${path} cron is missing.`);
  }
}

async function checkPackageScripts() {
  const packageJson = await readJson<{ scripts?: Record<string, string> }>("package.json");
  for (const script of ["build", "deploy:check", "mvp:check", "deployment:verify", "production:bootstrap"]) {
    if (packageJson?.scripts?.[script]) pass(`script:${script}`, `npm run ${script} is available.`);
    else record(`script:${script}`, "fail", `npm run ${script} is missing.`);
  }
}

function checkSiteUrl() {
  if (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL) {
    pass("env:SITE_URL", "SITE_URL or NEXT_PUBLIC_SITE_URL is configured.");
    return;
  }

  warnOrFail("env:SITE_URL", "SITE_URL or NEXT_PUBLIC_SITE_URL is not configured for canonical sitemap and robots URLs.");
}

function checkDeploymentEnv() {
  const ai = getAiConfig();
  const optionalEnv = [
    "DATABASE_URL",
    "CRON_SECRET",
    "ADMIN_TOKEN",
    "GITHUB_TOKEN",
    "BLOB_READ_WRITE_TOKEN",
    "OPENAI_API_KEY",
    "OPENAI_API_URL"
  ];

  for (const name of optionalEnv) {
    if (process.env[name]) pass(`env:${name}`, `${name} is configured.`);
    else record(`env:${name}`, "warn", `${name} is not configured.`);
  }
  if (ai.configured) pass("env:AI_PROVIDER", `${describeAiProvider(ai.provider)} endpoint is selected: ${ai.apiUrl}.`);

  if (hasUpstashRedis()) {
    pass("env:UPSTASH_REDIS", "Redis REST integration is configured.");
  } else {
    record("env:UPSTASH_REDIS", "warn", `Redis REST integration is not configured. Configure ${describeUpstashRedisEnvRequirement()}.`);
  }
}

function checkCliNonInteractive() {
  if (process.env.RUN_VERCEL_CLI_CHECK !== "1") {
    record("vercel:cli", "warn", "Skipped Vercel CLI check. Set RUN_VERCEL_CLI_CHECK=1 to run a non-interactive probe.");
    return;
  }

  const version = spawnSync("npx", ["vercel", "--version"], {
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 30_000
  });

  if (version.status !== 0) {
    record("vercel:cli", "fail", `Vercel CLI version check failed: ${(version.stderr || version.stdout).trim()}`);
    return;
  }

  if (!process.env.VERCEL_TOKEN) {
    record("vercel:cli", "warn", "Vercel CLI is available, but whoami was skipped because VERCEL_TOKEN is not configured.");
    return;
  }

  const whoami = spawnSync("npx", ["vercel", "whoami", "--token", process.env.VERCEL_TOKEN], {
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 30_000
  });

  if (whoami.status === 0) {
    pass("vercel:cli", "Vercel CLI token authentication succeeded.");
    return;
  }

  record("vercel:cli", "fail", `Vercel CLI token authentication failed: ${(whoami.stderr || whoami.stdout).trim()}`);
}

await checkProjectLink();
await checkVercelConfig();
await checkPackageScripts();
checkProductionUrl();
checkCliToken();
checkSiteUrl();
checkDeploymentEnv();
checkCliNonInteractive();

const nextCommands = [
  "npm run check",
  "npm run deploy:check",
  "npm run build",
  "npm run production:bootstrap -- <production-url>",
  "VERIFY_CRON_SECRET=<CRON_SECRET> VERIFY_ADMIN_TOKEN=<ADMIN_TOKEN> npm run deployment:verify -- <production-url>"
];

const summary = {
  pass: checks.filter((check) => check.status === "pass").length,
  warn: checks.filter((check) => check.status === "warn").length,
  fail: checks.filter((check) => check.status === "fail").length
};

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      strictDeploy,
      summary,
      checks,
      nextCommands
    },
    null,
    2
  )
);

if (summary.fail > 0) {
  process.exitCode = 1;
}
