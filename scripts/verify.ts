import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type StepStatus = "pass" | "warn" | "fail" | "skipped";

interface ScriptPayload {
  summary?: {
    pass?: number;
    warn?: number;
    fail?: number;
  };
  checks?: unknown[];
  results?: unknown[];
}

interface VerifyStep {
  name: string;
  status: StepStatus;
  detail: string;
  exitCode: number | null;
  summary?: ScriptPayload["summary"];
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const json = args.includes("--json");
const help = args.includes("--help") || args.includes("-h");
const strict = args.includes("--strict") || args.includes("--expect-mvp");

const expectationFlags: Record<string, string> = {
  "--expect-database": "EXPECT_DATABASE",
  "--expect-github": "EXPECT_GITHUB",
  "--expect-blob": "EXPECT_BLOB",
  "--expect-redis": "EXPECT_UPSTASH_REDIS",
  "--expect-upstash-redis": "EXPECT_UPSTASH_REDIS",
  "--expect-site-url": "EXPECT_SITE_URL",
  "--expect-openai": "EXPECT_OPENAI"
};

function printHelp() {
  console.log(`Usage:
  miniprogram-radar verify [production-url] [--json]
  miniprogram-radar verify [production-url] --strict --expect-database --expect-blob

Options:
  --json                   Print a JSON verification report.
  --strict, --expect-mvp   Treat missing production MVP requirements as failures.
  --expect-database        Require a configured database in deployment checks.
  --expect-github          Require GitHub integration in deployment checks.
  --expect-blob            Require Blob integration in deployment checks.
  --expect-redis           Require Upstash Redis integration in deployment checks.
  --expect-site-url        Require SITE_URL or NEXT_PUBLIC_SITE_URL.
  --expect-openai          Require real AI integration.
  -h, --help               Show this help message.`);
}

function resolveUrl() {
  const urlArg = args.find((arg) => !arg.startsWith("-"));
  return urlArg ?? process.env.DEPLOYMENT_BASE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
}

function parseJsonPayload(stdout: string): ScriptPayload | null {
  const start = stdout.indexOf("{");
  if (start === -1) return null;

  try {
    return JSON.parse(stdout.slice(start)) as ScriptPayload;
  } catch {
    return null;
  }
}

function statusFromPayload(exitCode: number | null, payload: ScriptPayload | null): StepStatus {
  if (exitCode !== 0 || (payload?.summary?.fail ?? 0) > 0) return "fail";
  if ((payload?.summary?.warn ?? 0) > 0) return "warn";
  return "pass";
}

function runScript(name: string, script: string, scriptArgs: string[], env: NodeJS.ProcessEnv): VerifyStep {
  const result = spawnSync(process.execPath, ["--import", "tsx", resolve(root, "scripts", script), ...scriptArgs], {
    cwd: root,
    env,
    encoding: "utf8"
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const payload = parseJsonPayload(stdout);
  const status = statusFromPayload(result.status, payload);
  const detail =
    payload?.summary
      ? `${payload.summary.pass ?? 0} pass, ${payload.summary.warn ?? 0} warn, ${payload.summary.fail ?? 0} fail.`
      : (stderr || stdout || result.error?.message || "No output.").trim();

  return {
    name,
    status,
    detail,
    exitCode: result.status,
    summary: payload?.summary
  };
}

function renderMarkdown(steps: VerifyStep[]) {
  const summary = summarize(steps);
  const lines = [
    "# 小程序雷达验证",
    "",
    `结果：${summary.pass} pass / ${summary.warn} warn / ${summary.fail} fail / ${summary.skipped} skipped`,
    "",
    "| Step | Status | Detail |",
    "| --- | --- | --- |",
    ...steps.map((step) => `| ${step.name} | ${step.status} | ${step.detail.replace(/\|/g, "\\|")} |`)
  ];

  return `${lines.join("\n")}\n`;
}

function summarize(steps: VerifyStep[]) {
  return {
    pass: steps.filter((step) => step.status === "pass").length,
    warn: steps.filter((step) => step.status === "warn").length,
    fail: steps.filter((step) => step.status === "fail").length,
    skipped: steps.filter((step) => step.status === "skipped").length
  };
}

if (help) {
  printHelp();
  process.exit(0);
}

const productionUrl = resolveUrl();
const env = { ...process.env };
if (strict) env.EXPECT_MVP = "1";
for (const [flag, envName] of Object.entries(expectationFlags)) {
  if (args.includes(flag)) env[envName] = "1";
}

const steps: VerifyStep[] = [];
steps.push(runScript("mvp", "mvp-check.ts", productionUrl ? [productionUrl] : [], env));

if (productionUrl) {
  steps.push(runScript("deployment", "verify-deployment.ts", [productionUrl], env));
} else {
  steps.push({
    name: "deployment",
    status: "skipped",
    detail: "No production URL provided. Pass a URL to verify the deployed app.",
    exitCode: null
  });
}

const summary = summarize(steps);
const report = {
  checkedAt: new Date().toISOString(),
  productionUrl: productionUrl ?? null,
  strict,
  summary,
  steps
};

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(renderMarkdown(steps));
}

if (summary.fail > 0) {
  process.exitCode = 1;
}
