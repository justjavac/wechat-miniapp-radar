import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { desc } from "drizzle-orm";
import { createDb } from "@/db/client";
import { weeklyReports } from "@/db/schema";
import { uploadTextArtifact } from "@/lib/blob-storage";
import { getResources, getStats, type RadarResource, type ResourceStats } from "@/lib/resources";
import { getScoreSnapshot, type ScoreSnapshot } from "@/lib/score-snapshot";

export type WeeklySignalKind = "adopt" | "risk" | "assessment";

export interface WeeklySignal {
  resourceId: string;
  title: string;
  kind: WeeklySignalKind;
  message: string;
  evidence: string | null;
}

export interface WeeklySignalDigest {
  source: "score-snapshot" | "resource-snapshot";
  generatedAt: string;
  signals: WeeklySignal[];
}

export interface WeeklyReport {
  id: string;
  title: string;
  generatedAt: string;
  stats: ResourceStats;
  highlights: RadarResource[];
  risks: RadarResource[];
  needsAssessment: RadarResource[];
  signalDigest: WeeklySignalDigest;
  markdown: string;
}

export interface WeeklyListItem {
  id: string;
  title: string;
  generatedAt: string;
  stats: ResourceStats;
}

function dateId(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function escapeMarkdownLinkText(value: string) {
  return value.replace(/[\\[\]]/g, "\\$&");
}

function escapeMarkdownLinkUrl(value: string) {
  return value.replace(/[()\\]/g, (character) => {
    if (character === "(") return "%28";
    if (character === ")") return "%29";
    return "%5C";
  });
}

function evidenceLinks(resource: RadarResource) {
  const evidence = resource.radar.evidence.slice(0, 2);
  if (evidence.length === 0) return `[资源链接](${escapeMarkdownLinkUrl(resource.url)})`;

  return evidence
    .map((item) => `[${escapeMarkdownLinkText(item.label)}](${escapeMarkdownLinkUrl(item.url)})`)
    .join("、");
}

function resourceLine(resource: RadarResource) {
  const reason = resource.radar.summary.replace(/\s+/g, " ");
  return `- [${escapeMarkdownLinkText(resource.title)}](/resources/${resource.id})：${reason} 证据：${evidenceLinks(resource)}`;
}

function signalKindLabel(kind: WeeklySignalKind) {
  return kind === "adopt" ? "recommend" : kind === "risk" ? "risk" : "assessment";
}

function signalLine(signal: WeeklySignal) {
  const evidence = signal.evidence ? ` Evidence: ${signal.evidence}` : "";
  return `- ${signalKindLabel(signal.kind)}: [${escapeMarkdownLinkText(signal.title)}](/resources/${signal.resourceId}) - ${signal.message}${evidence}`;
}

function firstReason(reasons: string[]) {
  return reasons.find(Boolean) ?? "No explicit signal reason was recorded.";
}

function scoreToSignal(score: ScoreSnapshot["scores"][number], kind: WeeklySignalKind): WeeklySignal {
  return {
    resourceId: score.id,
    title: score.title,
    kind,
    message: firstReason(score.reasons),
    evidence: score.reasons.find((reason) => reason.includes("http")) ?? null
  };
}

async function buildSignalDigest(resources: RadarResource[], generatedAt: string): Promise<WeeklySignalDigest> {
  const scoreSnapshot = await getScoreSnapshot();
  if (scoreSnapshot) {
    const riskSignals = scoreSnapshot.scores
      .filter((score) => score.riskLevel === "high" || score.status === "hold")
      .slice(0, 4)
      .map((score) => scoreToSignal(score, "risk"));
    const assessmentSignals = scoreSnapshot.scores
      .filter((score) => score.status === "assess" || score.maintainStatus === "stale")
      .slice(0, 4)
      .map((score) => scoreToSignal(score, "assessment"));
    const adoptSignals = scoreSnapshot.scores
      .filter((score) => score.status === "adopt" && score.riskLevel === "low")
      .slice(0, 4)
      .map((score) => scoreToSignal(score, "adopt"));

    return {
      source: "score-snapshot",
      generatedAt: scoreSnapshot.generatedAt,
      signals: [...riskSignals, ...assessmentSignals, ...adoptSignals]
    };
  }

  return {
    source: "resource-snapshot",
    generatedAt,
    signals: [
      ...resources
        .filter((resource) => resource.radar.riskLevel === "high")
        .slice(0, 4)
        .map((resource) => ({
          resourceId: resource.id,
          title: resource.title,
          kind: "risk" as const,
          message: resource.radar.summary,
          evidence: resource.radar.evidence[0]?.url ?? null
        })),
      ...resources
        .filter((resource) => resource.radar.status === "assess")
        .slice(0, 4)
        .map((resource) => ({
          resourceId: resource.id,
          title: resource.title,
          kind: "assessment" as const,
          message: resource.radar.summary,
          evidence: resource.radar.evidence[0]?.url ?? null
        })),
      ...resources
        .filter((resource) => resource.radar.status === "adopt")
        .slice(0, 4)
        .map((resource) => ({
          resourceId: resource.id,
          title: resource.title,
          kind: "adopt" as const,
          message: resource.radar.summary,
          evidence: resource.radar.evidence[0]?.url ?? null
        }))
    ]
  };
}

function renderMarkdown(report: Omit<WeeklyReport, "markdown">) {
  const lines = [
    `# ${report.title}`,
    "",
    `生成时间：${new Date(report.generatedAt).toLocaleString("zh-CN")}`,
    "",
    "## 概览",
    "",
    `- 资源总量：${report.stats.total}`,
    `- 推荐采用：${report.stats.adopt}`,
    `- 需要评估：${report.stats.assess}`,
    `- 高风险：${report.stats.highRisk}`,
    "",
    "## Signal Digest",
    "",
    `- Source: ${report.signalDigest.source}`,
    `- Snapshot: ${new Date(report.signalDigest.generatedAt).toLocaleString("zh-CN")}`,
    ...report.signalDigest.signals.map(signalLine),
    "",
    "## 推荐关注",
    "",
    ...report.highlights.map(resourceLine),
    "",
    "## 风险提醒",
    "",
    ...report.risks.map(resourceLine),
    "",
    "## 需要评估",
    "",
    ...report.needsAssessment.map(resourceLine),
    ""
  ];

  return `${lines.join("\n").trim()}\n`;
}

export async function createWeeklyReport(date = new Date()): Promise<WeeklyReport> {
  const resources = await getResources();
  const id = dateId(date);
  const generatedAt = date.toISOString();
  const signalDigest = await buildSignalDigest(resources, generatedAt);
  const base = {
    id,
    title: `小程序生态周报 ${id}`,
    generatedAt,
    stats: getStats(resources),
    highlights: resources.filter((resource) => resource.radar.status === "adopt").slice(0, 8),
    risks: resources.filter((resource) => resource.radar.riskLevel === "high").slice(0, 8),
    needsAssessment: resources.filter((resource) => resource.radar.status === "assess").slice(0, 8),
    signalDigest
  };

  return {
    ...base,
    markdown: renderMarkdown(base)
  };
}

export async function persistWeeklyReport(report: WeeklyReport) {
  if (!process.env.DATABASE_URL) return false;

  const db = createDb();
  await db
    .insert(weeklyReports)
    .values({
      id: report.id,
      title: report.title,
      content: report.markdown,
      snapshot: {
        stats: report.stats,
        highlights: report.highlights.map((resource) => resource.id),
        risks: report.risks.map((resource) => resource.id),
        needsAssessment: report.needsAssessment.map((resource) => resource.id),
        signalDigest: report.signalDigest
      },
      generatedAt: new Date(report.generatedAt)
    })
    .onConflictDoUpdate({
      target: weeklyReports.id,
      set: {
        title: report.title,
        content: report.markdown,
        snapshot: {
          stats: report.stats,
          highlights: report.highlights.map((resource) => resource.id),
          risks: report.risks.map((resource) => resource.id),
          needsAssessment: report.needsAssessment.map((resource) => resource.id),
          signalDigest: report.signalDigest
        },
        generatedAt: new Date(report.generatedAt)
      }
    });

  return true;
}

export async function writeWeeklyFiles(report: WeeklyReport) {
  await mkdir("public/api/weekly", { recursive: true });
  await mkdir("public/weekly", { recursive: true });

  await writeFile("public/api/weekly/latest.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(join("public/weekly", `${report.id}.md`), report.markdown, "utf8");

  const existing = await readWeeklyIndexFile();
  const nextItem = toWeeklyListItem(report);
  const index = [nextItem, ...existing.filter((item) => item.id !== report.id)].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  await writeFile("public/api/weekly/index.json", `${JSON.stringify({ generatedAt: new Date().toISOString(), reports: index }, null, 2)}\n`, "utf8");
}

export async function uploadWeeklyReport(report: WeeklyReport) {
  return uploadTextArtifact(`weekly/${report.id}.md`, report.markdown, "text/markdown; charset=utf-8");
}

export async function readLatestWeeklyReport() {
  try {
    return JSON.parse(await readFile("public/api/weekly/latest.json", "utf8")) as WeeklyReport;
  } catch {
    return null;
  }
}

function toWeeklyListItem(report: WeeklyReport): WeeklyListItem {
  return {
    id: report.id,
    title: report.title,
    generatedAt: report.generatedAt,
    stats: report.stats
  };
}

async function readWeeklyIndexFile(): Promise<WeeklyListItem[]> {
  try {
    const payload = JSON.parse(await readFile("public/api/weekly/index.json", "utf8")) as { reports?: WeeklyListItem[] };
    return Array.isArray(payload.reports) ? payload.reports : [];
  } catch {
    return [];
  }
}

async function getDatabaseWeeklyReports(limit: number): Promise<WeeklyListItem[] | null> {
  if (!process.env.DATABASE_URL) return null;

  try {
    const db = createDb();
    const rows = await db
      .select({
        id: weeklyReports.id,
        title: weeklyReports.title,
        snapshot: weeklyReports.snapshot,
        generatedAt: weeklyReports.generatedAt
      })
      .from(weeklyReports)
      .orderBy(desc(weeklyReports.generatedAt))
      .limit(limit);

    if (rows.length === 0) return null;

    return rows.map((row) => {
      const snapshot = row.snapshot as { stats?: ResourceStats } | null;
      return {
        id: row.id,
        title: row.title,
        generatedAt: row.generatedAt.toISOString(),
        stats: snapshot?.stats ?? {
          total: 0,
          adopt: 0,
          trial: 0,
          assess: 0,
          hold: 0,
          highRisk: 0,
          categories: 0
        }
      };
    });
  } catch {
    return null;
  }
}

export async function getWeeklyHistory(limit = 12): Promise<WeeklyListItem[]> {
  const databaseReports = await getDatabaseWeeklyReports(limit);
  if (databaseReports) return databaseReports;

  const indexReports = await readWeeklyIndexFile();
  if (indexReports.length > 0) return indexReports.slice(0, limit);

  const latest = await readLatestWeeklyReport();
  return latest ? [toWeeklyListItem(latest)] : [];
}
