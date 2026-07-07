import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { maintainLabels, riskLabels, statusLabels, typeLabels } from "@/components/resource-labels";
import { buildCompareInsights, buildCompareMatrix, getCompareResources, type CompareInsight, type CompareMatrixRow } from "@/lib/resources";

const args = process.argv.slice(2);
const outArg = args.find((arg) => arg.startsWith("--out="));
const idsArg = args.find((arg) => arg.startsWith("--ids="));
const jsonOutput = args.includes("--json") || process.env.npm_config_json === "true";
const positionalIds = args.filter((arg) => !arg.startsWith("--"));
const requestedIds = [
  ...(idsArg ? idsArg.slice("--ids=".length).split(",") : []),
  ...positionalIds
]
  .map((id) => id.trim())
  .filter(Boolean);

if (args.includes("-h") || args.includes("--help")) {
  console.log(`Usage:
  miniprogram-radar compare [--ids=id1,id2] [--json] [--out=compare.md]
  miniprogram-radar compare github-com-nervjstaro github-com-dcloudiouni-app

Options:
  --ids   Comma-separated resource ids to compare. Defaults to core framework options.
  --json  Print structured JSON instead of Markdown.
  --out   Write output to a file.`);
  process.exit(0);
}

function renderMatrixRow(row: CompareMatrixRow) {
  return [
    `[${row.title}](/resources/${row.id})`,
    typeLabels[row.type],
    statusLabels[row.status],
    riskLabels[row.riskLevel],
    maintainLabels[row.maintainStatus],
    row.useCases.join("、") || "暂无",
    row.alternatives.join("、") || "暂无"
  ].join(" | ");
}

function renderInsight(insight: CompareInsight) {
  const lines = [
    `### ${insight.title}`,
    "",
    insight.recommendation,
    "",
    `- 适合：${insight.bestFor.join("、")}`,
    ...insight.tradeoffs.map((item) => `- ${item}`),
    "- 验证清单：",
    ...insight.validationChecklist.map((item) => `  - ${item}`),
    "- 证据来源：",
    ...insight.evidence.map((item) => `  - [${item.label}](${item.url})`)
  ];

  return lines.join("\n");
}

function renderMarkdown(payload: {
  matrix: CompareMatrixRow[];
  insights: CompareInsight[];
  requestedIds: string[];
  missingIds: string[];
}) {
  const lines = [
    "# 小程序方案对比",
    "",
    payload.requestedIds.length > 0 ? `请求资源：${payload.requestedIds.join("、")}` : "请求资源：默认核心方案",
    payload.missingIds.length > 0 ? `缺失资源：${payload.missingIds.join("、")}` : null,
    "",
    "## 对比矩阵",
    "",
    "方案 | 类型 | 推荐状态 | 风险 | 维护状态 | 适用场景 | 替代方案",
    "--- | --- | --- | --- | --- | --- | ---",
    ...payload.matrix.map(renderMatrixRow),
    "",
    "## 选型洞察",
    "",
    ...payload.insights.map(renderInsight),
    ""
  ].filter((line): line is string => line !== null);

  return `${lines.join("\n").trim()}\n`;
}

const resources = await getCompareResources({ ids: requestedIds });
const foundIds = new Set(resources.map((resource) => resource.id));
const payload = {
  resources,
  matrix: buildCompareMatrix(resources),
  insights: buildCompareInsights(resources),
  requestedIds,
  missingIds: requestedIds.filter((id) => !foundIds.has(id))
};
const renderedOutput = jsonOutput ? `${JSON.stringify(payload, null, 2)}\n` : renderMarkdown(payload);

if (outArg) {
  const outFile = resolve(outArg.slice("--out=".length));
  await writeFile(outFile, renderedOutput, "utf8");
  console.log(jsonOutput ? `Compare JSON report written to ${outFile}` : `Compare report written to ${outFile}`);
} else {
  process.stdout.write(renderedOutput);
}
