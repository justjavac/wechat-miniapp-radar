import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { maintainLabels, riskLabels, statusLabels, typeLabels } from "@/components/resource-labels";
import { uploadTextArtifact } from "@/lib/blob-storage";
import { filterResources, getResources, type RadarResource, type RadarStatus, type ResourceType, type RiskLevel } from "@/lib/resources";

const args = process.argv.slice(2);
const outArg = args.find((arg) => arg.startsWith("--out="));
const formatArg = valueFor("format");
const format = formatArg === "json" || formatArg === "csv" || formatArg === "md" ? formatArg : "md";
const limit = Math.max(1, Math.min(500, Number(valueFor("limit") ?? "50") || 50));
const uploadRequested = args.includes("--upload") || args.includes("--snapshot");

if (args.includes("-h") || args.includes("--help")) {
  console.log(`Usage:
  miniprogram-radar resources [--q=taro] [--type=framework] [--status=adopt] [--format=md|json|csv]
  miniprogram-radar resources --risk=high --limit=20 --out=resources.md

Options:
  --q         Keyword search.
  --category  Category id filter.
  --status   adopt, trial, assess, hold, or all.
  --risk     low, medium, high, or all.
  --type     framework, ui, tooling, cloud, sdk, example, docs, or all.
  --useCase  Use-case label filter.
  --limit    Maximum rows to print. Default: 50.
  --format   md, json, or csv. Default: md.
  --out      Write output to a file.
  --upload   Upload the export snapshot to Vercel Blob when BLOB_READ_WRITE_TOKEN is configured.`);
  process.exit(0);
}

function valueFor(name: string) {
  const prefix = `--${name}=`;
  const arg = args.find((item) => item.startsWith(prefix));
  return arg?.slice(prefix.length).trim() || undefined;
}

function parseStatus(value: string | undefined): RadarStatus | "all" | undefined {
  if (!value) return undefined;
  return value === "adopt" || value === "trial" || value === "assess" || value === "hold" || value === "all" ? value : undefined;
}

function parseRisk(value: string | undefined): RiskLevel | "all" | undefined {
  if (!value) return undefined;
  return value === "low" || value === "medium" || value === "high" || value === "all" ? value : undefined;
}

function parseType(value: string | undefined): ResourceType | "all" | undefined {
  if (!value) return undefined;
  return value === "framework" || value === "ui" || value === "tooling" || value === "cloud" || value === "sdk" || value === "example" || value === "docs" || value === "all"
    ? value
    : undefined;
}

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function exportRows(resources: RadarResource[]) {
  return resources.map((resource) => ({
    id: resource.id,
    title: resource.title,
    url: resource.url,
    category: resource.category,
    section: resource.section ?? "",
    type: resource.radar.type,
    status: resource.radar.status,
    maintainStatus: resource.radar.maintainStatus,
    riskLevel: resource.radar.riskLevel,
    summary: resource.radar.summary,
    useCases: resource.radar.useCases,
    alternatives: resource.radar.alternatives,
    evidenceUrls: resource.radar.evidence.map((item) => item.url)
  }));
}

function toCsv(rows: ReturnType<typeof exportRows>) {
  const headers = ["id", "title", "url", "category", "section", "type", "status", "maintainStatus", "riskLevel", "summary", "useCases", "alternatives", "evidenceUrls"];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header as keyof typeof row])).join(","))].join("\n")}\n`;
}

function toMarkdown(resources: RadarResource[], total: number) {
  const lines = [
    "# 小程序雷达资源筛选",
    "",
    `匹配资源：${total}`,
    `输出资源：${resources.length}`,
    "",
    "资源 | 类型 | 推荐状态 | 风险 | 维护状态 | 摘要",
    "--- | --- | --- | --- | --- | ---",
    ...resources.map((resource) =>
      [
        `[${resource.title}](${resource.url})`,
        typeLabels[resource.radar.type],
        statusLabels[resource.radar.status],
        riskLabels[resource.radar.riskLevel],
        maintainLabels[resource.radar.maintainStatus],
        resource.radar.summary.replace(/\|/g, "/")
      ].join(" | ")
    ),
    ""
  ];

  return `${lines.join("\n").trim()}\n`;
}

const allResources = await getResources();
const filtered = filterResources(allResources, {
  query: valueFor("q"),
  category: valueFor("category"),
  status: parseStatus(valueFor("status")),
  risk: parseRisk(valueFor("risk")),
  type: parseType(valueFor("type")),
  useCase: valueFor("useCase")
});
const limited = filtered.slice(0, limit);
const rows = exportRows(limited);
const payload = {
  generatedAt: new Date().toISOString(),
  total: filtered.length,
  limit,
  filters: {
    q: valueFor("q") ?? null,
    category: valueFor("category") ?? null,
    status: parseStatus(valueFor("status")) ?? null,
    risk: parseRisk(valueFor("risk")) ?? null,
    type: parseType(valueFor("type")) ?? null,
    useCase: valueFor("useCase") ?? null
  },
  uploadRequested,
  blobUrl: null as string | null,
  resources: rows
};
let renderedOutput = format === "json" ? `${JSON.stringify(payload, null, 2)}\n` : format === "csv" ? toCsv(rows) : toMarkdown(limited, filtered.length);
const contentType = format === "json" ? "application/json; charset=utf-8" : format === "csv" ? "text/csv; charset=utf-8" : "text/markdown; charset=utf-8";

if (uploadRequested) {
  payload.blobUrl = await uploadTextArtifact(`exports/${Date.now()}-miniprogram-radar-resources.${format}`, renderedOutput, contentType);
  if (format === "json") renderedOutput = `${JSON.stringify(payload, null, 2)}\n`;
}

if (outArg) {
  const outFile = resolve(outArg.slice("--out=".length));
  await writeFile(outFile, renderedOutput, "utf8");
  console.log(`Resources ${format.toUpperCase()} export written to ${outFile}`);
  if (uploadRequested) {
    console.log(payload.blobUrl ? `Resources Blob snapshot uploaded to ${payload.blobUrl}` : "Resources Blob snapshot skipped because BLOB_READ_WRITE_TOKEN is not configured.");
  }
} else {
  if (uploadRequested && format !== "json") {
    console.error(payload.blobUrl ? `Resources Blob snapshot uploaded to ${payload.blobUrl}` : "Resources Blob snapshot skipped because BLOB_READ_WRITE_TOKEN is not configured.");
  }
  process.stdout.write(renderedOutput);
}
