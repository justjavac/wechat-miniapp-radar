import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { describeUpstashRedisEnvRequirement, hasUpstashRedis } from "@/lib/upstash";

type CheckStatus = "pass" | "warn" | "fail";

interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

function result(name: string, status: CheckStatus, detail: string): CheckResult {
  return { name, status, detail };
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function readText(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

function checkFile(file: string, name = file) {
  return result(name, existsSync(file) ? "pass" : "fail", existsSync(file) ? `${file} exists.` : `${file} is missing.`);
}

function checkEnv(name: string, required: boolean) {
  const configured = Boolean(process.env[name]);
  if (configured) return result(`env:${name}`, "pass", `${name} is configured.`);
  return result(`env:${name}`, required ? "fail" : "warn", `${name} is not configured.`);
}

function checkRedisEnv(required: boolean) {
  if (hasUpstashRedis()) return result("env:UPSTASH_REDIS", "pass", "Redis REST integration is configured.");
  return result(
    "env:UPSTASH_REDIS",
    required ? "fail" : "warn",
    `Redis REST integration is not configured. Configure ${describeUpstashRedisEnvRequirement()}.`
  );
}

const checks: CheckResult[] = [];

checks.push(checkFile("vercel.json"));
checks.push(checkFile(".env.example"));
checks.push(checkFile("drizzle.config.ts"));
checks.push(checkFile(".github/workflows/verify-vercel.yml", "ci:verify-vercel-workflow"));
checks.push(checkFile("app/sitemap.ts", "seo:sitemap-route"));
checks.push(checkFile("app/robots.ts", "seo:robots-route"));
checks.push(checkFile("bin/miniprogram-radar.mjs", "cli:miniprogram-radar"));
checks.push(checkFile("scripts/ai-summarize.ts", "cli:ai-summarize"));
checks.push(checkFile("scripts/compare.ts", "cli:compare"));
checks.push(checkFile("scripts/enrich-resources.ts", "cli:enrich"));
checks.push(checkFile("scripts/health.ts", "cli:health"));
checks.push(checkFile("scripts/import-yaml-to-db.ts", "cli:import"));
checks.push(checkFile("scripts/resources.ts", "cli:resources"));
checks.push(checkFile("scripts/score-cli.ts", "cli:score"));
checks.push(checkFile("scripts/verify.ts", "cli:verify"));
checks.push(checkFile("scripts/weekly-cli.ts", "cli:weekly"));
checks.push(checkFile("lib/operation-log.ts", "operation-log-helper"));
checks.push(checkFile("lib/task-lock.ts", "task-lock-helper"));
checks.push(checkFile("lib/ai-client.ts", "ai-client-helper"));
checks.push(checkFile("lib/ai-advisor.ts", "ai-advisor-helper"));
checks.push(checkFile("lib/ai-prompts.ts", "ai-prompt-contract"));
checks.push(checkFile("lib/production-readiness.ts", "production-readiness-helper"));
checks.push(checkFile("components/quick-search.tsx", "quick-search-component"));
checks.push(checkFile("scripts/test-secret-exposure.ts", "secret-exposure-scan"));
checks.push(checkFile("scripts/production-bootstrap.ts", "production-bootstrap-script"));
checks.push(checkFile("app/api/ai-summaries/route.ts", "api:/api/ai-summaries"));
checks.push(checkFile("app/api/export/resources/route.ts", "api:/api/export/resources"));
checks.push(checkFile("app/api/admin/readiness/route.ts", "api:/api/admin/readiness"));
checks.push(checkFile("app/api/admin/session/route.ts", "api:/api/admin/session"));
checks.push(checkFile("public/api/resources.json"));
checks.push(checkFile("public/api/radar-scores.json"));
checks.push(checkFile("public/api/ai-summaries.json"));
checks.push(checkFile("public/api/weekly/latest.json"));
checks.push(checkFile("public/api/weekly/index.json"));

const requiredEnvKeys = [
  "DATABASE_URL",
  "SITE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "OPENAI_API_KEY",
  "OPENAI_API_URL",
  "OPENAI_MODEL",
  "OPENAI_FALLBACK_MODEL",
  "GITHUB_TOKEN",
  "CRON_SECRET",
  "ADMIN_TOKEN",
  "BLOB_READ_WRITE_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "OPERATION_LOG_RETENTION_DAYS",
  "VERCEL_TOKEN",
  "VERCEL_PROJECT_ID",
  "VERCEL_ORG_ID"
];
const envExample = await readText(".env.example");
const missingEnvExampleKeys = requiredEnvKeys.filter((key) => !envExample?.split(/\r?\n/).some((line) => line.startsWith(`${key}=`)));
checks.push(
  result(
    "env-example:keys",
    missingEnvExampleKeys.length === 0 ? "pass" : "fail",
    missingEnvExampleKeys.length === 0 ? ".env.example documents all deployment variables." : `.env.example is missing: ${missingEnvExampleKeys.join(", ")}.`
  )
);

const dbBackedPages = [
  ["db-backed-page:/", "app/page.tsx"],
  ["db-backed-page:/radar", "app/radar/page.tsx"],
  ["db-backed-page:/compare", "app/compare/page.tsx"],
  ["db-backed-page:/weekly", "app/weekly/page.tsx"],
  ["db-backed-page:/resources/[id]", "app/resources/[id]/page.tsx"]
] as const;
for (const [name, file] of dbBackedPages) {
  const source = await readText(file);
  checks.push(
    result(
      name,
      source?.includes('export const dynamic = "force-dynamic"') ? "pass" : "fail",
      source?.includes('export const dynamic = "force-dynamic"') ? `${file} is rendered dynamically.` : `${file} must force dynamic rendering for database-backed content.`
    )
  );
}
const resourceDetailSource = await readText("app/resources/[id]/page.tsx");
checks.push(
  result(
    "db-backed-page:resource-detail-no-static-params",
    resourceDetailSource && !resourceDetailSource.includes("generateStaticParams") ? "pass" : "fail",
    resourceDetailSource && !resourceDetailSource.includes("generateStaticParams")
      ? "Resource detail routes are resolved from the current catalog at request time."
      : "Resource detail routes must not use generateStaticParams for database-backed resources."
  )
);

const packageJson = await readJson<{ scripts?: Record<string, string>; engines?: Record<string, string> }>("package.json");
const requiredScripts = [
  "build",
  "check",
  "integrations:verify",
  "integrations-verify:test",
  "db:migrate",
  "db:import",
  "db:import:test",
  "db-client:test",
  "db:verify",
  "db-verify:test",
  "enrich",
  "enrich:test",
  "resources-api:test",
  "resource-detail-api:test",
  "export-api:test",
  "compare-api:test",
  "alternatives:test",
  "score",
  "score-trace:test",
  "tracker",
  "tracker:test",
  "operation-log:test",
  "task-lock:test",
  "site-url:test",
  "health:test",
  "production-readiness:test",
  "ai:summarize",
  "ai-output:test",
  "security:test",
  "secret-exposure:test",
  "admin-api:test",
  "cron-routes:test",
  "compare",
  "health",
  "resources",
  "weekly",
  "weekly:test",
  "advisor",
  "advisor:test",
  "doctor",
  "doctor:test",
  "cli:test",
  "deploy:check",
  "deployment:verify",
  "deployment-verify:test",
  "mvp:check",
  "mvp-check:test",
  "verify",
  "vercel:preflight",
  "vercel-preflight:test",
  "verify-vercel-workflow:test",
  "production:bootstrap",
  "production-bootstrap:test",
  "smoke"
];
for (const script of requiredScripts) {
  checks.push(
    result(
      `script:${script}`,
      packageJson?.scripts?.[script] ? "pass" : "fail",
      packageJson?.scripts?.[script] ? `npm run ${script} is available.` : `npm run ${script} is missing.`
    )
  );
}

const legacyPaths = ["public/index.html", "scripts/serve.ts", "scripts/import-readme.ts"];
const remainingLegacyPaths = legacyPaths.filter((file) => existsSync(file));
checks.push(
  result(
    "legacy-web:removed-files",
    remainingLegacyPaths.length === 0 ? "pass" : "fail",
    remainingLegacyPaths.length === 0
      ? "Legacy static site and README importer files are removed."
      : `Remove legacy files: ${remainingLegacyPaths.join(", ")}.`
  )
);

const legacyScripts = ["legacy:site", "import:readme", "site"];
const remainingLegacyScripts = legacyScripts.filter((script) => Boolean(packageJson?.scripts?.[script]));
checks.push(
  result(
    "legacy-web:removed-scripts",
    remainingLegacyScripts.length === 0 ? "pass" : "fail",
    remainingLegacyScripts.length === 0
      ? "Legacy static site and README importer scripts are removed."
      : `Remove legacy package scripts: ${remainingLegacyScripts.join(", ")}.`
  )
);

checks.push(
  result(
    "node-engine",
    packageJson?.engines?.node?.includes("20") ? "pass" : "warn",
    packageJson?.engines?.node ? `Node engine is ${packageJson.engines.node}.` : "Node engine is not pinned."
  )
);

const validateWorkflow = await readText(".github/workflows/validate.yml");
const requiredWorkflowCommands = ["npm run check", "npm run deploy:check", "npm run build", "npm run smoke"];
const missingWorkflowCommands = requiredWorkflowCommands.filter((command) => !validateWorkflow?.includes(command));
checks.push(
  result(
    "ci:validate-workflow",
    missingWorkflowCommands.length === 0 ? "pass" : "fail",
    missingWorkflowCommands.length === 0
      ? "Validate workflow runs full checks, readiness, build, and smoke."
      : `Validate workflow is missing: ${missingWorkflowCommands.join(", ")}.`
  )
);

const verifyVercelWorkflow = await readText(".github/workflows/verify-vercel.yml");
const requiredVerifyWorkflowCommands = [
  "npm run vercel:preflight",
  "npm run mvp:check",
  "npm run integrations:verify",
  "npm run deployment:verify",
  "github.event.deployment.environment",
  "VAR_EXPECT_VERCEL_DEPLOY",
  "VAR_EXPECT_MVP",
  "VAR_EXPECT_DATABASE",
  "VAR_EXPECT_GITHUB",
  "VAR_EXPECT_BLOB",
  "VAR_EXPECT_UPSTASH_REDIS",
  "VAR_EXPECT_SITE_URL",
  "VAR_EXPECT_OPENAI",
  "SITE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "OPENAI_API_KEY",
  "OPENAI_API_URL",
  "OPENAI_MODEL",
  "OPENAI_FALLBACK_MODEL",
  "RADAR_GITHUB_TOKEN",
  "GITHUB_TOKEN",
  "BLOB_READ_WRITE_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "VERCEL_TOKEN",
  "VERCEL_PROJECT_ID",
  "VERCEL_ORG_ID"
];
const missingVerifyWorkflowCommands = requiredVerifyWorkflowCommands.filter((command) => !verifyVercelWorkflow?.includes(command));
checks.push(
  result(
    "ci:verify-vercel-commands",
    missingVerifyWorkflowCommands.length === 0 ? "pass" : "fail",
    missingVerifyWorkflowCommands.length === 0
      ? "Vercel verification workflow runs Vercel preflight, MVP, integrations, and production deployment checks."
      : `Vercel verification workflow is missing: ${missingVerifyWorkflowCommands.join(", ")}.`
  )
);

const layoutSource = await readText("app/layout.tsx");
const globalCss = await readText("app/globals.css");
checks.push(
  result(
    "build:local-fonts",
    layoutSource?.includes("next/font/google") === false && Boolean(globalCss?.includes("--font-sans") && globalCss.includes("--font-mono"))
      ? "pass"
      : "fail",
    layoutSource?.includes("next/font/google") === false && Boolean(globalCss?.includes("--font-sans") && globalCss.includes("--font-mono"))
      ? "Build uses local system font variables instead of downloading Google Fonts."
      : "Build should not depend on next/font/google or remote font downloads."
  )
);

const readme = await readText("README.md");
const readmeStillLooksLikeAwesomeList =
  Boolean(readme?.includes("## 目录")) ||
  Boolean(readme?.includes("[↑ 返回目录 ↑]")) ||
  Boolean(readme?.includes("## 工具\n\n- [uni-app"));
const readmeDeveloperSections = ["## 本地运行", "## 常用任务", "## 部署环境变量", "## 部署检查", "## 数据维护"];
const readmeIncludesDeveloperSections = readmeDeveloperSections.some((section) => readme?.includes(section));
checks.push(
  result(
    "readme:product-positioning",
    readme?.includes("## 适合谁") && readme.includes("## 可以做什么") && readme.includes("## 数据概览") && readme.includes("## 核心样例") && !readmeStillLooksLikeAwesomeList && !readmeIncludesDeveloperSections ? "pass" : "fail",
    readme?.includes("## 适合谁") && readme.includes("## 可以做什么") && readme.includes("## 数据概览") && readme.includes("## 核心样例") && !readmeStillLooksLikeAwesomeList && !readmeIncludesDeveloperSections
      ? "README is user-facing and presents MiniProgram Radar as a product."
      : "README should be user-facing, without developer setup, deployment, or full awesome list sections."
  )
);

const agents = await readText("AGENTS.md");
checks.push(
  result(
    "agents:developer-guide",
    Boolean(agents?.includes("## 本地运行") && agents.includes("## 常用任务") && agents.includes("## 环境变量") && agents.includes("## 部署检查")) ? "pass" : "fail",
    Boolean(agents?.includes("## 本地运行") && agents.includes("## 常用任务") && agents.includes("## 环境变量") && agents.includes("## 部署检查"))
      ? "AGENTS.md contains developer setup, commands, environment, and deployment guidance."
      : "AGENTS.md should contain developer setup, commands, environment, and deployment guidance."
  )
);

const gitignore = await readText(".gitignore");
checks.push(
  result(
    "docs:local-only",
    gitignore?.split(/\r?\n/).some((line) => line.trim() === "docs/") ? "pass" : "fail",
    gitignore?.split(/\r?\n/).some((line) => line.trim() === "docs/")
      ? "docs/ is ignored and kept as local-only implementation notes."
      : "docs/ should be ignored because implementation documents are local-only."
  )
);

const adminPageSource = await readText("app/admin/page.tsx");
const requiredAdminEndpointSnippets = ["/api/admin/readiness", "受保护生产就绪清单", "/api/admin/resources/[id]"];
const missingAdminEndpointSnippets = requiredAdminEndpointSnippets.filter((snippet) => !adminPageSource?.includes(snippet));
checks.push(
  result(
    "admin:endpoint-catalog",
    missingAdminEndpointSnippets.length === 0 ? "pass" : "fail",
    missingAdminEndpointSnippets.length === 0
      ? "Admin endpoint catalog includes readiness and maintenance APIs."
      : `Admin endpoint catalog is missing: ${missingAdminEndpointSnippets.join(", ")}.`
  )
);

const cliSource = await readText("bin/miniprogram-radar.mjs");
checks.push(
  result(
    "cli:ai-summarize-command",
    cliSource?.includes('"ai-summarize"') && cliSource.includes("ai-summarize.ts") ? "pass" : "fail",
    cliSource?.includes('"ai-summarize"') && cliSource.includes("ai-summarize.ts")
      ? "miniprogram-radar ai-summarize is wired to the AI summary CLI."
      : "miniprogram-radar ai-summarize command is missing."
  )
);
checks.push(
  result(
    "cli:advisor-prompt-contract",
    cliSource?.includes("--prompt") && cliSource.includes("model-ready prompt contract") ? "pass" : "fail",
    cliSource?.includes("--prompt") && cliSource.includes("model-ready prompt contract")
      ? "miniprogram-radar advisor can export a model-ready prompt contract."
      : "miniprogram-radar advisor should document --prompt for model-ready prompt export."
  )
);
checks.push(
  result(
    "cli:compare-command",
    cliSource?.includes('"compare"') && cliSource.includes("compare.ts") ? "pass" : "fail",
    cliSource?.includes('"compare"') && cliSource.includes("compare.ts")
      ? "miniprogram-radar compare is wired to the compare CLI."
      : "miniprogram-radar compare command is missing."
  )
);
checks.push(
  result(
    "cli:enrich-command",
    cliSource?.includes('"enrich"') && cliSource.includes("enrich-resources.ts") ? "pass" : "fail",
    cliSource?.includes('"enrich"') && cliSource.includes("enrich-resources.ts")
      ? "miniprogram-radar enrich is wired to the enrichment CLI."
      : "miniprogram-radar enrich command is missing."
  )
);
checks.push(
  result(
    "cli:health-command",
    cliSource?.includes('"health"') && cliSource.includes("health.ts") ? "pass" : "fail",
    cliSource?.includes('"health"') && cliSource.includes("health.ts")
      ? "miniprogram-radar health is wired to the health CLI."
      : "miniprogram-radar health command is missing."
  )
);
checks.push(
  result(
    "cli:import-command",
    cliSource?.includes('"import"') && cliSource.includes("import-yaml-to-db.ts") ? "pass" : "fail",
    cliSource?.includes('"import"') && cliSource.includes("import-yaml-to-db.ts")
      ? "miniprogram-radar import is wired to the database import CLI."
      : "miniprogram-radar import command is missing."
  )
);
checks.push(
  result(
    "cli:resources-command",
    cliSource?.includes('"resources"') && cliSource.includes("resources.ts") ? "pass" : "fail",
    cliSource?.includes('"resources"') && cliSource.includes("resources.ts")
      ? "miniprogram-radar resources is wired to the resources CLI."
      : "miniprogram-radar resources command is missing."
  )
);
checks.push(
  result(
    "cli:score-command",
    cliSource?.includes('"score"') && cliSource.includes("score-cli.ts") ? "pass" : "fail",
    cliSource?.includes('"score"') && cliSource.includes("score-cli.ts")
      ? "miniprogram-radar score is wired to the score CLI."
      : "miniprogram-radar score command is missing."
  )
);
checks.push(
  result(
    "cli:tracker-command",
    cliSource?.includes('"tracker"') && cliSource.includes("tracker.ts") ? "pass" : "fail",
    cliSource?.includes('"tracker"') && cliSource.includes("tracker.ts")
      ? "miniprogram-radar tracker is wired to the implementation tracker CLI."
      : "miniprogram-radar tracker command is missing."
  )
);
checks.push(
  result(
    "cli:weekly-command",
    cliSource?.includes('"weekly"') && cliSource.includes("weekly-cli.ts") ? "pass" : "fail",
    cliSource?.includes('"weekly"') && cliSource.includes("weekly-cli.ts")
      ? "miniprogram-radar weekly is wired to the weekly CLI."
      : "miniprogram-radar weekly command is missing."
  )
);
checks.push(
  result(
    "cli:verify-command",
    cliSource?.includes('"verify"') && cliSource.includes("verify.ts") ? "pass" : "fail",
    cliSource?.includes('"verify"') && cliSource.includes("verify.ts")
      ? "miniprogram-radar verify is wired to the verification CLI."
      : "miniprogram-radar verify command is missing."
  )
);

const vercel = await readJson<{ crons?: Array<{ path: string; schedule: string }> }>("vercel.json");
for (const cronPath of ["/api/cron/enrich", "/api/cron/weekly"]) {
  const cron = vercel?.crons?.find((item) => item.path === cronPath);
  checks.push(result(`cron:${cronPath}`, cron ? "pass" : "fail", cron ? `${cronPath} scheduled as ${cron.schedule}.` : `${cronPath} is missing.`));
}

const schema = await readText("db/schema.ts");
checks.push(
  result(
    "schema:operation_logs",
    schema?.includes('pgTable("operation_logs"') ? "pass" : "fail",
    schema?.includes('pgTable("operation_logs"') ? "operation_logs table is defined." : "operation_logs table is missing."
  )
);
const operationLogHelper = await readText("lib/operation-log.ts");
checks.push(
  result(
    "operation-log-retention",
    operationLogHelper?.includes("cleanupOperationLogs") && operationLogHelper.includes("OPERATION_LOG_RETENTION_DAYS") ? "pass" : "fail",
    operationLogHelper?.includes("cleanupOperationLogs") && operationLogHelper.includes("OPERATION_LOG_RETENTION_DAYS")
      ? "operation log retention cleanup is implemented."
      : "operation log retention cleanup is missing."
  )
);
checks.push(
  result(
    "schema:resource_scores",
    schema?.includes('pgTable("resource_scores"') ? "pass" : "fail",
    schema?.includes('pgTable("resource_scores"') ? "resource_scores table is defined." : "resource_scores table is missing."
  )
);
checks.push(
  result(
    "schema:resource_alternatives",
    schema?.includes('pgTable("resource_alternatives"') ? "pass" : "fail",
    schema?.includes('pgTable("resource_alternatives"') ? "resource_alternatives table is defined." : "resource_alternatives table is missing."
  )
);

const resources = await readJson<{ resources?: unknown[] }>("public/api/resources.json");
checks.push(
  result(
    "resources-snapshot",
    (resources?.resources?.length ?? 0) > 0 ? "pass" : "fail",
    `${resources?.resources?.length ?? 0} resources in public/api/resources.json.`
  )
);

const aiSummaries = await readJson<{ count?: number; summaries?: unknown[] }>("public/api/ai-summaries.json");
const aiSummaryCount = typeof aiSummaries?.count === "number" ? aiSummaries.count : (aiSummaries?.summaries?.length ?? 0);
checks.push(
  result(
    "ai-summaries-snapshot",
    aiSummaryCount > 0 ? "pass" : "warn",
    `${aiSummaryCount} summaries in public/api/ai-summaries.json.`
  )
);

const radarScores = await readJson<{
  generatedAt?: string;
  scores?: Array<{
    evidenceRefs?: unknown[];
  }>;
}>("public/api/radar-scores.json");
const radarScoreCount = radarScores?.scores?.length ?? 0;
checks.push(
  result(
    "radar-scores-snapshot",
    radarScoreCount > 0 && Boolean(radarScores?.generatedAt) ? "pass" : "fail",
    `${radarScoreCount} scores in public/api/radar-scores.json.`
  )
);
const radarScoresWithEvidence = radarScores?.scores?.filter((score) => (score.evidenceRefs?.length ?? 0) > 0).length ?? 0;
checks.push(
  result(
    "radar-scores-evidence",
    radarScoreCount > 0 && radarScoresWithEvidence === radarScoreCount ? "pass" : "fail",
    `${radarScoresWithEvidence}/${radarScoreCount} scores include structured evidence references.`
  )
);

const weeklyIndex = await readJson<{ generatedAt?: string; reports?: Array<{ id?: string; generatedAt?: string }> }>("public/api/weekly/index.json");
const weeklyLatest = await readJson<{ id?: string; generatedAt?: string }>("public/api/weekly/latest.json");
const weeklyHistoryCount = weeklyIndex?.reports?.length ?? 0;
const latestInHistory = Boolean(weeklyLatest?.id && weeklyIndex?.reports?.some((report) => report.id === weeklyLatest.id));
checks.push(
  result(
    "weekly-snapshot",
    weeklyHistoryCount > 0 && Boolean(weeklyLatest?.id) && latestInHistory ? "pass" : "fail",
    `${weeklyHistoryCount} reports in public/api/weekly/index.json; latest=${weeklyLatest?.id ?? "none"}.`
  )
);

checks.push(checkEnv("DATABASE_URL", false));
checks.push(
  result(
    "env:SITE_URL",
    process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL ? "pass" : "warn",
    process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL
      ? "SITE_URL or NEXT_PUBLIC_SITE_URL is configured for canonical sitemap and robots URLs."
      : "SITE_URL or NEXT_PUBLIC_SITE_URL is not configured; sitemap and robots may fall back to the Vercel deployment URL."
  )
);
checks.push(checkEnv("CRON_SECRET", false));
checks.push(checkEnv("ADMIN_TOKEN", false));
checks.push(checkEnv("GITHUB_TOKEN", false));
checks.push(checkEnv("OPENAI_API_KEY", false));
checks.push(checkEnv("OPENAI_API_URL", false));
checks.push(checkEnv("OPENAI_MODEL", false));
checks.push(checkEnv("OPENAI_FALLBACK_MODEL", false));
checks.push(checkEnv("BLOB_READ_WRITE_TOKEN", false));
checks.push(checkRedisEnv(false));
checks.push(checkEnv("OPERATION_LOG_RETENTION_DAYS", false));
checks.push(checkEnv("VERCEL_TOKEN", false));
checks.push(checkEnv("VERCEL_PROJECT_ID", false));
checks.push(checkEnv("VERCEL_ORG_ID", false));

const summary = {
  pass: checks.filter((check) => check.status === "pass").length,
  warn: checks.filter((check) => check.status === "warn").length,
  fail: checks.filter((check) => check.status === "fail").length
};

console.log(JSON.stringify({ checkedAt: new Date().toISOString(), summary, checks }, null, 2));

if (summary.fail > 0) {
  process.exitCode = 1;
}
