import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

interface ProgressRow {
  phase: string;
  status: string;
  evidence: string;
  nextStep: string;
}

interface IssueRow {
  id: string;
  issue: string;
  impact: string;
  status: string;
  handling: string;
}

interface RiskRow {
  id: string;
  risk: string;
  signal: string;
  mitigation: string;
}

interface VerificationRow {
  date: string;
  scope: string;
  evidence: string;
  result: string;
  note: string;
}

interface TrackerReport {
  checkedAt: string;
  source: string;
  updatedAt: string | null;
  summary: {
    phases: number;
    completed: number;
    inProgress: number;
    pendingProduction: number;
    openIssues: number;
    risks: number;
    verifications: number;
  };
  progress: ProgressRow[];
  issues: IssueRow[];
  risks: RiskRow[];
  verifications: VerificationRow[];
}

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json") || process.env.npm_config_json === "true";
const failOnOpen = args.includes("--fail-on-open") || process.env.npm_config_fail_on_open === "true";
const outArg = args.find((arg) => arg.startsWith("--out="));
const trackerPath = "docs/miniprogram-radar-implementation-tracker.md";

if (args.includes("-h") || args.includes("--help")) {
  console.log(`Usage:
  miniprogram-radar tracker [--json] [--out=tracker.md]
  miniprogram-radar tracker --fail-on-open

Options:
  --json          Print structured JSON instead of Markdown.
  --out           Write output to a file.
  --fail-on-open  Exit with code 2 when the tracker still has open issues.`);
  process.exit(0);
}

function normalizeCell(value: string) {
  return value.replace(/`/g, "").trim();
}

function readSection(markdown: string, heading: string) {
  const start = markdown.indexOf(heading);
  if (start === -1) return "";
  const rest = markdown.slice(start + heading.length);
  const next = rest.search(/\n##\s+/);
  return next === -1 ? rest : rest.slice(0, next);
}

function parseTable(section: string): string[][] {
  return section
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|"))
    .filter((line) => !/^\|\s*-+/.test(line.trim()))
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map(normalizeCell)
    )
    .filter((cells) => cells.length > 1)
    .slice(1);
}

function parseProgress(markdown: string): ProgressRow[] {
  return parseTable(readSection(markdown, "## 2. 进度总览")).map((cells) => ({
    phase: cells[0] ?? "",
    status: cells[1] ?? "",
    evidence: cells[2] ?? "",
    nextStep: cells[3] ?? ""
  }));
}

function parseIssues(markdown: string): IssueRow[] {
  return parseTable(readSection(markdown, "## 3. 当前问题清单")).map((cells) => ({
    id: cells[0] ?? "",
    issue: cells[1] ?? "",
    impact: cells[2] ?? "",
    status: cells[3] ?? "",
    handling: cells[4] ?? ""
  }));
}

function parseRisks(markdown: string): RiskRow[] {
  return parseTable(readSection(markdown, "## 4. 风险清单")).map((cells) => ({
    id: cells[0] ?? "",
    risk: cells[1] ?? "",
    signal: cells[2] ?? "",
    mitigation: cells[3] ?? ""
  }));
}

function parseVerifications(markdown: string): VerificationRow[] {
  return parseTable(readSection(markdown, "## 5. 验证记录")).map((cells) => ({
    date: cells[0] ?? "",
    scope: cells[1] ?? "",
    evidence: cells[2] ?? "",
    result: cells[3] ?? "",
    note: cells[4] ?? ""
  }));
}

function readUpdatedAt(markdown: string) {
  return markdown.match(/更新时间：(.+)/)?.[1]?.trim() ?? null;
}

function buildReport(markdown: string): TrackerReport {
  const progress = parseProgress(markdown);
  const issues = parseIssues(markdown);
  const risks = parseRisks(markdown);
  const verifications = parseVerifications(markdown);
  const openIssues = issues.filter((issue) => !["已关闭", "关闭", "closed"].includes(issue.status.toLowerCase()));

  return {
    checkedAt: new Date().toISOString(),
    source: trackerPath,
    updatedAt: readUpdatedAt(markdown),
    summary: {
      phases: progress.length,
      completed: progress.filter((row) => row.status === "已完成").length,
      inProgress: progress.filter((row) => row.status === "进行中").length,
      pendingProduction: progress.filter((row) => row.status === "待生产配置").length,
      openIssues: openIssues.length,
      risks: risks.length,
      verifications: verifications.length
    },
    progress,
    issues,
    risks,
    verifications
  };
}

function renderMarkdown(report: TrackerReport) {
  const openIssues = report.issues.filter((issue) => !["已关闭", "关闭", "closed"].includes(issue.status.toLowerCase()));
  const lines = [
    "# 小程序雷达实施追踪状态",
    "",
    `来源：${report.source}`,
    `更新时间：${report.updatedAt ?? "unknown"}`,
    `检查时间：${report.checkedAt}`,
    "",
    "## 汇总",
    "",
    `- 阶段：${report.summary.completed}/${report.summary.phases} 已完成`,
    `- 进行中：${report.summary.inProgress}`,
    `- 待生产配置：${report.summary.pendingProduction}`,
    `- 打开问题：${report.summary.openIssues}`,
    `- 风险：${report.summary.risks}`,
    `- 验证记录：${report.summary.verifications}`,
    "",
    "## 下一步",
    "",
    ...report.progress
      .filter((row) => row.status !== "已完成")
      .slice(0, 5)
      .map((row) => `- ${row.phase}：${row.nextStep}`),
    "",
    "## 打开问题",
    "",
    ...(openIssues.length > 0 ? openIssues.map((issue) => `- ${issue.id}：${issue.issue}；处理：${issue.handling}`) : ["- 无"])
  ];

  return `${lines.join("\n").trim()}\n`;
}

const markdown = await readFile(trackerPath, "utf8");
const report = buildReport(markdown);
const output = jsonOutput ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report);

if (outArg) {
  const outFile = resolve(outArg.slice("--out=".length));
  await writeFile(outFile, output, "utf8");
  console.log(jsonOutput ? `Tracker JSON report written to ${outFile}` : `Tracker report written to ${outFile}`);
} else {
  process.stdout.write(output);
}

if (failOnOpen && report.summary.openIssues > 0) {
  console.error(`${report.summary.openIssues} open tracker issues remain.`);
  process.exitCode = 2;
}
