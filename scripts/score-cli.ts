import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { maintainLabels, riskLabels, statusLabels, typeLabels } from "@/components/resource-labels";
import { getResources, getStats } from "@/lib/resources";

const args = process.argv.slice(2);
const outArg = args.find((arg) => arg.startsWith("--out="));
const jsonOutput = args.includes("--json") || process.env.npm_config_json === "true";
const writeSnapshot = args.includes("--write") || process.env.npm_config_write === "true";
const limit = Math.max(1, Math.min(100, Number(valueFor("limit") ?? "20") || 20));

if (args.includes("-h") || args.includes("--help")) {
  console.log(`Usage:
  miniprogram-radar score [--json] [--out=score.md]
  miniprogram-radar score --write

Options:
  --json   Print structured JSON instead of Markdown.
  --out    Write output to a file.
  --limit  Maximum high-risk and assessment rows shown in Markdown. Default: 20.
  --write  Update public/api/radar-scores.json.`);
  process.exit(0);
}

function valueFor(name: string) {
  const prefix = `--${name}=`;
  const arg = args.find((item) => item.startsWith(prefix));
  return arg?.slice(prefix.length).trim() || undefined;
}

function renderMarkdown(output: ScoreOutput) {
  const highRisk = output.scores.filter((score) => score.riskLevel === "high").slice(0, limit);
  const needsAssessment = output.scores.filter((score) => score.status === "assess").slice(0, limit);
  const lines = [
    "# 小程序雷达评分报告",
    "",
    `生成时间：${output.generatedAt}`,
    "",
    "## 概览",
    "",
    `- 资源总量：${output.stats.total}`,
    `- 推荐采用：${output.stats.adopt}`,
    `- 需要评估：${output.stats.assess}`,
    `- 高风险：${output.stats.highRisk}`,
    "",
    "## 高风险资源",
    "",
    ...renderScoreRows(highRisk),
    "",
    "## 需要评估资源",
    "",
    ...renderScoreRows(needsAssessment),
    ""
  ];

  return `${lines.join("\n").trim()}\n`;
}

function renderScoreRows(scores: ScoreOutput["scores"]) {
  if (scores.length === 0) return ["暂无。"];
  return scores.map((score) => {
    const reason = score.reasons[0] ?? "暂无证据。";
    return `- ${score.title}：${typeLabels[score.type]}，${statusLabels[score.status]}，${riskLabels[score.riskLevel]}，${maintainLabels[score.maintainStatus]}。证据：${reason}`;
  });
}

const resources = await getResources();
const output = {
  generatedAt: new Date().toISOString(),
  stats: getStats(resources),
  scores: resources.map((resource) => ({
    id: resource.id,
    title: resource.title,
    status: resource.radar.status,
    maintainStatus: resource.radar.maintainStatus,
    riskLevel: resource.radar.riskLevel,
    type: resource.radar.type,
    reasons: resource.radar.evidence.map((item) => `${item.label}: ${item.url}`),
    evidenceRefs: resource.radar.evidence.map((item) => ({
      type: item.type,
      label: item.label,
      url: item.url
    }))
  }))
} satisfies ScoreOutput;
const renderedOutput = jsonOutput ? `${JSON.stringify(output, null, 2)}\n` : renderMarkdown(output);

if (writeSnapshot) {
  await writeFile("public/api/radar-scores.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");
}

if (outArg) {
  const outFile = resolve(outArg.slice("--out=".length));
  await writeFile(outFile, renderedOutput, "utf8");
  console.log(jsonOutput ? `Score JSON report written to ${outFile}` : `Score report written to ${outFile}`);
} else {
  process.stdout.write(renderedOutput);
}

if (writeSnapshot && (!jsonOutput || outArg)) {
  console.log("Radar score snapshot written to public/api/radar-scores.json");
}

interface ScoreOutput {
  generatedAt: string;
  stats: ReturnType<typeof getStats>;
  scores: Array<{
    id: string;
    title: string;
    status: "adopt" | "trial" | "assess" | "hold";
    maintainStatus: "active" | "low" | "stale" | "deprecated" | "unknown";
    riskLevel: "low" | "medium" | "high";
    type: "framework" | "ui" | "tooling" | "cloud" | "sdk" | "example" | "docs";
    reasons: string[];
    evidenceRefs: Array<{
      type: string;
      label: string;
      url: string;
    }>;
  }>;
}
