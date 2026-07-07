import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { resourceAiSummaries, resources as databaseResources } from "@/db/schema";
import { validateGeneratedAiSummary } from "@/lib/ai-output-validation";
import { getResource, getResources, type RadarResource } from "@/lib/resources";

export interface GeneratedAiSummary {
  resourceId: string;
  title: string;
  summary: string;
  recommendation: string;
  riskNotes: string[];
  useCases: string[];
  notRecommendedFor: string[];
  evidenceRefs: Array<{
    type: string;
    label: string;
    url: string;
  }>;
  updatedAt?: string;
  source?: "database" | "snapshot";
}

interface AiSummarySnapshot {
  generatedAt: string;
  mode: string;
  count: number;
  summaries: GeneratedAiSummary[];
}

function cleanTitle(title: string) {
  return title.replace(/\s*★.*$/, "").trim();
}

function recommendationFor(resource: RadarResource) {
  const title = cleanTitle(resource.title);
  const useCases = resource.radar.useCases.length > 0 ? `，适合 ${resource.radar.useCases.join("、")}` : "";

  if (resource.radar.status === "adopt") {
    return `${title} 可以作为新项目优先评估方案${useCases}。`;
  }
  if (resource.radar.status === "trial") {
    return `${title} 适合在明确场景中试用验证${useCases}。`;
  }
  if (resource.radar.status === "hold") {
    return `${title} 不建议新项目直接采用，主要用于老项目维护、迁移评估或历史参考。`;
  }
  return `${title} 需要结合团队栈、维护状态和替代方案谨慎评估${useCases}。`;
}

function riskNotesFor(resource: RadarResource) {
  const notes = [
    `当前维护状态：${resource.radar.maintainStatus}。`,
    `当前风险等级：${resource.radar.riskLevel}。`
  ];

  if (resource.radar.riskLevel === "high") {
    notes.push("高风险资源需要优先确认是否停维、是否有迁移路径，以及是否存在更活跃替代方案。");
  }

  if (resource.radar.alternatives.length > 0) {
    notes.push(`可对比替代方案：${resource.radar.alternatives.join("、")}。`);
  }

  return notes;
}

function notRecommendedFor(resource: RadarResource) {
  const items = [...resource.radar.notRecommendedFor];

  if (resource.radar.status === "hold") {
    items.push("新项目从零开始选型。");
  }
  if (resource.radar.riskLevel === "high") {
    items.push("缺少迁移预案或长期维护预算的生产项目。");
  }
  if (resource.radar.maintainStatus === "deprecated" || resource.radar.maintainStatus === "stale") {
    items.push("要求持续升级和长期维护的核心业务。");
  }

  return Array.from(new Set(items));
}

export function createResourceAiSummary(resource: RadarResource): GeneratedAiSummary {
  return {
    resourceId: resource.id,
    title: resource.title,
    summary: resource.radar.summary,
    recommendation: recommendationFor(resource),
    riskNotes: riskNotesFor(resource),
    useCases: resource.radar.useCases,
    notRecommendedFor: notRecommendedFor(resource),
    evidenceRefs: resource.radar.evidence.map((evidence) => ({
      type: evidence.type,
      label: evidence.label,
      url: evidence.url
    }))
  };
}

export function createResourceAiSummaries(resources: RadarResource[], limit?: number) {
  return resources.slice(0, limit ?? resources.length).map(createResourceAiSummary);
}

export function filterValidResourceAiSummaries(summaries: GeneratedAiSummary[], resources: RadarResource[]) {
  return summaries.filter((summary) => validateGeneratedAiSummary(summary, resources).ok);
}

export async function persistResourceAiSummaries(summaries: GeneratedAiSummary[]) {
  if (!process.env.DATABASE_URL) {
    return { persisted: false, count: 0, error: null as string | null };
  }

  const db = createDb();
  let count = 0;

  try {
    for (const summary of summaries) {
      await db
        .insert(resourceAiSummaries)
        .values({
          resourceId: summary.resourceId,
          summary: summary.summary,
          recommendation: summary.recommendation,
          riskNotes: summary.riskNotes,
          useCases: summary.useCases,
          notRecommendedFor: summary.notRecommendedFor,
          evidenceRefs: summary.evidenceRefs
        })
        .onConflictDoUpdate({
          target: resourceAiSummaries.resourceId,
          set: {
            summary: summary.summary,
            recommendation: summary.recommendation,
            riskNotes: summary.riskNotes,
            useCases: summary.useCases,
            notRecommendedFor: summary.notRecommendedFor,
            evidenceRefs: summary.evidenceRefs,
            updatedAt: new Date()
          }
        });
      count += 1;
    }

    return { persisted: true, count, error: null };
  } catch (error) {
    return { persisted: false, count, error: error instanceof Error ? error.message : String(error) };
  }
}

async function readAiSummarySnapshot() {
  try {
    return JSON.parse(await readFile("public/api/ai-summaries.json", "utf8")) as AiSummarySnapshot;
  } catch {
    return null;
  }
}

async function getDatabaseAiSummary(resourceId: string): Promise<GeneratedAiSummary | null> {
  if (!process.env.DATABASE_URL) return null;

  try {
    const db = createDb();
    const [row] = await db
      .select()
      .from(resourceAiSummaries)
      .where(eq(resourceAiSummaries.resourceId, resourceId))
      .limit(1);

    if (!row) return null;

    return {
      resourceId: row.resourceId,
      title: row.resourceId,
      summary: row.summary,
      recommendation: row.recommendation,
      riskNotes: Array.isArray(row.riskNotes) ? (row.riskNotes as string[]) : [],
      useCases: Array.isArray(row.useCases) ? (row.useCases as string[]) : [],
      notRecommendedFor: Array.isArray(row.notRecommendedFor) ? (row.notRecommendedFor as string[]) : [],
      evidenceRefs: Array.isArray(row.evidenceRefs) ? (row.evidenceRefs as GeneratedAiSummary["evidenceRefs"]) : [],
      updatedAt: row.updatedAt.toISOString(),
      source: "database"
    };
  } catch {
    return null;
  }
}

export async function getResourceAiSummary(resourceId: string) {
  const resource = await getResource(resourceId);
  if (!resource) return null;

  const databaseSummary = await getDatabaseAiSummary(resourceId);
  if (databaseSummary && validateGeneratedAiSummary(databaseSummary, [resource]).ok) return databaseSummary;

  const snapshot = await readAiSummarySnapshot();
  const snapshotSummary = snapshot?.summaries.find((summary) => summary.resourceId === resourceId) ?? null;
  return snapshot && snapshotSummary && validateGeneratedAiSummary(snapshotSummary, [resource]).ok
    ? { ...snapshotSummary, updatedAt: snapshot.generatedAt, source: "snapshot" as const }
    : null;
}

async function getDatabaseAiSummaries(): Promise<GeneratedAiSummary[] | null> {
  if (!process.env.DATABASE_URL) return null;

  try {
    const db = createDb();
    const rows = await db
      .select({
        resourceId: resourceAiSummaries.resourceId,
        title: databaseResources.title,
        summary: resourceAiSummaries.summary,
        recommendation: resourceAiSummaries.recommendation,
        riskNotes: resourceAiSummaries.riskNotes,
        useCases: resourceAiSummaries.useCases,
        notRecommendedFor: resourceAiSummaries.notRecommendedFor,
        evidenceRefs: resourceAiSummaries.evidenceRefs,
        updatedAt: resourceAiSummaries.updatedAt
      })
      .from(resourceAiSummaries)
      .leftJoin(databaseResources, eq(resourceAiSummaries.resourceId, databaseResources.id));

    if (rows.length === 0) return null;

    return rows.map((row) => ({
      resourceId: row.resourceId,
      title: row.title ?? row.resourceId,
      summary: row.summary,
      recommendation: row.recommendation,
      riskNotes: Array.isArray(row.riskNotes) ? (row.riskNotes as string[]) : [],
      useCases: Array.isArray(row.useCases) ? (row.useCases as string[]) : [],
      notRecommendedFor: Array.isArray(row.notRecommendedFor) ? (row.notRecommendedFor as string[]) : [],
      evidenceRefs: Array.isArray(row.evidenceRefs) ? (row.evidenceRefs as GeneratedAiSummary["evidenceRefs"]) : [],
      updatedAt: row.updatedAt.toISOString(),
      source: "database"
    }));
  } catch {
    return null;
  }
}

export async function getResourceAiSummaries({
  query,
  limit
}: {
  query?: string;
  limit?: number;
} = {}) {
  const databaseSummaries = await getDatabaseAiSummaries();
  const snapshot = databaseSummaries
    ? {
        generatedAt: new Date().toISOString(),
        mode: "database",
        count: databaseSummaries.length,
        summaries: databaseSummaries
      }
    : await readAiSummarySnapshot();

  const summaries = snapshot?.summaries ?? [];
  const normalizedQuery = query?.trim().toLowerCase();
  const filtered = normalizedQuery
    ? summaries.filter((summary) => `${summary.title} ${summary.summary} ${summary.recommendation}`.toLowerCase().includes(normalizedQuery))
    : summaries;
  const validSummaries = filterValidResourceAiSummaries(filtered, await getResources());

  return {
    generatedAt: snapshot?.generatedAt ?? new Date().toISOString(),
    mode: snapshot?.mode ?? "none",
    total: validSummaries.length,
    summaries: validSummaries.slice(0, limit ?? validSummaries.length)
  };
}
