import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describeAiProvider } from "@/lib/ai-config";
import { getHealthCheck, type HealthCheck } from "@/lib/health";

const args = process.argv.slice(2);
const outArg = args.find((arg) => arg.startsWith("--out="));
const jsonOutput = args.includes("--json") || process.env.npm_config_json === "true";
const failOnUnhealthy = args.includes("--fail-on-unhealthy") || process.env.npm_config_fail_on_unhealthy === "true";

if (args.includes("-h") || args.includes("--help")) {
  console.log(`Usage:
  miniprogram-radar health [--json] [--out=health.md]
  miniprogram-radar health --fail-on-unhealthy

Options:
  --json               Print structured JSON instead of Markdown.
  --out                Write output to a file.
  --fail-on-unhealthy  Exit with code 2 when health.ok is false.`);
  process.exit(0);
}

function status(value: boolean) {
  return value ? "ok" : "missing";
}

function renderHealth(health: HealthCheck) {
  const lines = [
    "# 小程序雷达健康检查",
    "",
    `状态：${health.ok ? "正常" : "异常"}`,
    `检查时间：${health.checkedAt}`,
    "",
    "## 资源",
    "",
    `- 资源数：${health.resources.count}`,
    "",
    "## 静态快照",
    "",
    `- AI 摘要：${health.snapshots.aiSummaries.present ? "存在" : "缺失"}，数量 ${health.snapshots.aiSummaries.count}，模式 ${health.snapshots.aiSummaries.mode ?? "unknown"}`,
    `- 雷达评分：${health.snapshots.radarScores.present ? "存在" : "缺失"}，数量 ${health.snapshots.radarScores.count}`,
    `- 周报：${health.snapshots.weekly.present ? "存在" : "缺失"}，最新 ${health.snapshots.weekly.latestId ?? "none"}，历史 ${health.snapshots.weekly.historyCount}`,
    "",
    "## 数据库",
    "",
    `- configured：${health.database.configured}`,
    `- connected：${health.database.connected}`,
    `- error：${health.database.error ?? "none"}`,
    "",
    "## 集成",
    "",
    `- AI：${status(health.integrations.ai.configured)}（${describeAiProvider(health.integrations.ai.provider)}，${health.integrations.ai.apiUrl}）`,
    `- GitHub：${status(health.integrations.github)}`,
    `- Cron Secret：${status(health.integrations.cronSecret)}`,
    `- Admin Token：${status(health.integrations.adminToken)}`,
    `- Blob：${status(health.integrations.blob)}`,
    `- Upstash Redis：${status(health.integrations.upstashRedis)}`,
    `- Site URL：${status(health.integrations.siteUrl)}`,
    ""
  ];

  return `${lines.join("\n").trim()}\n`;
}

const health = await getHealthCheck();
const renderedOutput = jsonOutput ? `${JSON.stringify(health, null, 2)}\n` : renderHealth(health);

if (outArg) {
  const outFile = resolve(outArg.slice("--out=".length));
  await writeFile(outFile, renderedOutput, "utf8");
  console.log(jsonOutput ? `Health JSON report written to ${outFile}` : `Health report written to ${outFile}`);
} else {
  process.stdout.write(renderedOutput);
}

if (failOnUnhealthy && !health.ok) {
  console.error("Health check failed.");
  process.exitCode = 2;
}
