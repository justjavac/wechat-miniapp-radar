import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { describeAiProvider, getAiConfig } from "@/lib/ai-config";
import { describeUpstashRedisEnvRequirement, hasUpstashRedis } from "@/lib/upstash";

type CheckStatus = "pass" | "warn" | "fail";

interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

const checks: CheckResult[] = [];
const strictMvp = process.env.EXPECT_MVP === "1";

function record(name: string, status: CheckStatus, detail: string) {
  checks.push({ name, status, detail });
}

function pass(name: string, detail: string) {
  record(name, "pass", detail);
}

function warnOrFail(name: string, detail: string, strict = strictMvp) {
  record(name, strict ? "fail" : "warn", detail);
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function checkFile(name: string, file: string) {
  if (existsSync(file)) pass(name, `${file} exists.`);
  else record(name, "fail", `${file} is missing.`);
}

function checkEnv(name: string, requiredForStrictMvp = true) {
  if (process.env[name]) {
    pass(`env:${name}`, `${name} is configured.`);
    return;
  }

  warnOrFail(
    `env:${name}`,
    `${name} is not configured.`,
    requiredForStrictMvp && strictMvp
  );
}

function checkRedisEnv() {
  if (hasUpstashRedis()) {
    pass("env:UPSTASH_REDIS", "Redis REST integration is configured.");
    return;
  }

  warnOrFail(
    "env:UPSTASH_REDIS",
    `Redis REST integration is not configured. Configure ${describeUpstashRedisEnvRequirement()}.`
  );
}

function checkProductionUrl() {
  const value = process.argv[2] ?? process.env.DEPLOYMENT_BASE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!value) {
    warnOrFail("external:production-url", "No production URL provided. Pass a URL or set DEPLOYMENT_BASE_URL.", strictMvp);
    return;
  }

  try {
    const parsed = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      record("external:production-url", "fail", "Production URL must use http or https.");
      return;
    }
    pass("external:production-url", `Production URL is ${parsed.toString().replace(/\/$/, "")}.`);
  } catch {
    record("external:production-url", "fail", `Invalid production URL: ${value}.`);
  }
}

const localFiles = [
  ["local:next-app", "app/page.tsx"],
  ["local:radar-page", "app/radar/page.tsx"],
  ["local:compare-page", "app/compare/page.tsx"],
  ["local:resource-detail-page", "app/resources/[id]/page.tsx"],
  ["local:advisor-page", "app/advisor/page.tsx"],
  ["local:doctor-page", "app/doctor/page.tsx"],
  ["local:weekly-page", "app/weekly/page.tsx"],
  ["local:admin-page", "app/admin/page.tsx"],
  ["local:resources-api", "app/api/resources/route.ts"],
  ["local:resource-detail-api", "app/api/resources/[id]/route.ts"],
  ["local:compare-api", "app/api/compare/route.ts"],
  ["local:advisor-api", "app/api/advisor/route.ts"],
  ["local:ai-summaries-api", "app/api/ai-summaries/route.ts"],
  ["local:doctor-api", "app/api/doctor/route.ts"],
  ["local:weekly-api", "app/api/weekly/route.ts"],
  ["local:export-api", "app/api/export/resources/route.ts"],
  ["local:health-api", "app/api/health/route.ts"],
  ["local:cron-enrich-api", "app/api/cron/enrich/route.ts"],
  ["local:cron-weekly-api", "app/api/cron/weekly/route.ts"],
  ["local:admin-readiness-api", "app/api/admin/readiness/route.ts"],
  ["local:admin-resource-api", "app/api/admin/resources/[id]/route.ts"],
  ["local:sitemap-route", "app/sitemap.ts"],
  ["local:robots-route", "app/robots.ts"],
  ["local:vercel-config", "vercel.json"],
  ["local:vercel-production-workflow", ".github/workflows/verify-vercel.yml"],
  ["local:database-schema", "db/schema.ts"],
  ["local:cli", "bin/miniprogram-radar.mjs"]
] as const;

for (const [name, file] of localFiles) {
  checkFile(name, file);
}

const packageJson = await readJson<{ scripts?: Record<string, string> }>("package.json");
const requiredScripts = [
  "build",
  "check",
  "deploy:check",
  "deployment:verify",
  "db:import",
  "db:verify",
  "integrations:verify",
  "site-url:test",
  "ai:summarize",
  "weekly",
  "doctor",
  "mvp:check",
  "vercel:preflight",
  "production:bootstrap",
  "smoke"
];
for (const script of requiredScripts) {
  if (packageJson?.scripts?.[script]) pass(`script:${script}`, `npm run ${script} is available.`);
  else record(`script:${script}`, "fail", `npm run ${script} is missing.`);
}

const resources = await readJson<{ resources?: unknown[] }>("public/api/resources.json");
const resourceCount = resources?.resources?.length ?? 0;
record(
  "data:resources-snapshot",
  resourceCount > 0 ? "pass" : "fail",
  `${resourceCount} resources in public/api/resources.json.`
);

const aiSummaries = await readJson<{ summaries?: unknown[] }>("public/api/ai-summaries.json");
const aiSummaryCount = aiSummaries?.summaries?.length ?? 0;
record(
  "data:ai-summaries-snapshot",
  aiSummaryCount > 0 ? "pass" : "warn",
  `${aiSummaryCount} rule-based AI summaries in public/api/ai-summaries.json.`
);

const weeklyIndex = await readJson<{ reports?: unknown[] }>("public/api/weekly/index.json");
const weeklyCount = weeklyIndex?.reports?.length ?? 0;
record(
  "data:weekly-index",
  weeklyCount > 0 ? "pass" : "warn",
  `${weeklyCount} weekly reports in public/api/weekly/index.json.`
);

const vercel = await readJson<{ crons?: Array<{ path: string; schedule: string }> }>("vercel.json");
for (const path of ["/api/cron/enrich", "/api/cron/weekly"]) {
  const cron = vercel?.crons?.find((item) => item.path === path);
  record(`vercel-cron:${path}`, cron ? "pass" : "fail", cron ? `${path} scheduled as ${cron.schedule}.` : `${path} is missing.`);
}

checkProductionUrl();
checkEnv("DATABASE_URL");
if (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL) {
  pass("env:SITE_URL", "SITE_URL or NEXT_PUBLIC_SITE_URL is configured for canonical sitemap and robots URLs.");
} else {
  warnOrFail(
    "env:SITE_URL",
    "SITE_URL or NEXT_PUBLIC_SITE_URL is not configured; sitemap and robots may fall back to the Vercel deployment URL.",
    process.env.EXPECT_SITE_URL === "1"
  );
}
checkEnv("CRON_SECRET");
checkEnv("ADMIN_TOKEN");
checkEnv("GITHUB_TOKEN");
checkEnv("BLOB_READ_WRITE_TOKEN");
checkRedisEnv();
checkEnv("OPERATION_LOG_RETENTION_DAYS", false);

const ai = getAiConfig();
if (ai.configured) {
  pass("env:OPENAI_API_KEY", `OPENAI_API_KEY is configured for real AI via ${describeAiProvider(ai.provider)}.`);
  pass("env:OPENAI_API_URL", `AI endpoint is ${ai.apiUrl}.`);
} else {
  warnOrFail(
    "env:OPENAI_API_KEY",
    "OPENAI_API_KEY is not configured. Real AI remains disabled; rule-based summaries and Advisor stay available.",
    process.env.EXPECT_OPENAI === "1"
  );
  if (process.env.OPENAI_API_URL) {
    record("env:OPENAI_API_URL", "warn", "OPENAI_API_URL is configured, but OPENAI_API_KEY is missing.");
  }
}

const summary = {
  pass: checks.filter((check) => check.status === "pass").length,
  warn: checks.filter((check) => check.status === "warn").length,
  fail: checks.filter((check) => check.status === "fail").length
};

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      strictMvp,
      summary,
      checks
    },
    null,
    2
  )
);

if (summary.fail > 0) {
  process.exitCode = 1;
}
