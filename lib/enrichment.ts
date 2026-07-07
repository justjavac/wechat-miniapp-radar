import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { resourceScores, resourceSignals, resources as resourcesTable } from "@/db/schema";
import type { RadarResource, RadarStatus, RiskLevel, MaintainStatus } from "@/lib/resources";
import { getResources } from "@/lib/resources";

export type SignalSource = "github" | "npm" | "website";

export interface CollectedSignal {
  resourceId: string;
  source: SignalSource;
  url: string;
  ok: boolean;
  payload: Record<string, unknown>;
  error?: string;
}

export interface ScoredSignal {
  resourceId: string;
  status: RadarStatus;
  maintainStatus: MaintainStatus;
  riskLevel: RiskLevel;
  reasons: string[];
}

export interface EnrichmentResult {
  total: number;
  attempted: number;
  collected: number;
  failed: number;
  persisted: boolean;
  signals: CollectedSignal[];
  scores: ScoredSignal[];
}

interface GitHubRepo {
  full_name: string;
  stargazers_count: number;
  archived: boolean;
  pushed_at: string | null;
  updated_at: string | null;
  open_issues_count: number;
  default_branch: string;
}

interface NpmPackage {
  name: string;
  time?: Record<string, string>;
  "dist-tags"?: Record<string, string>;
}

export function signalId(signal: CollectedSignal) {
  return createHash("sha1").update(`${signal.resourceId}:${signal.source}:${signal.url}`).digest("hex");
}

function parseGitHubRepo(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;
    const [owner, repo] = parsed.pathname.replace(/^\/+/, "").split("/");
    if (!owner || !repo) return null;
    return { owner, repo: repo.replace(/\.git$/i, "") };
  } catch {
    return null;
  }
}

function parseNpmPackage(url: string) {
  try {
    const parsed = new URL(url);
    if (!["www.npmjs.com", "npmjs.com"].includes(parsed.hostname)) return null;
    const parts = parsed.pathname.replace(/^\/+/, "").split("/");
    if (parts[0] !== "package") return null;
    if (parts[1]?.startsWith("@") && parts[2]) return `${parts[1]}/${parts[2]}`;
    return parts[1] ?? null;
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string, headers: HeadersInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "miniprogram-radar",
        ...headers
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHead(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        "user-agent": "miniprogram-radar"
      },
      redirect: "follow",
      signal: controller.signal
    });
    return {
      status: response.status,
      finalUrl: response.url,
      contentType: response.headers.get("content-type")
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function collectResourceSignal(resource: RadarResource): Promise<CollectedSignal> {
  const github = parseGitHubRepo(resource.url);
  if (github) {
    const headers: HeadersInit = {};
    if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

    try {
      const repo = await fetchJson<GitHubRepo>(`https://api.github.com/repos/${github.owner}/${github.repo}`, headers);
      return {
        resourceId: resource.id,
        source: "github",
        url: resource.url,
        ok: true,
        payload: {
          fullName: repo.full_name,
          stars: repo.stargazers_count,
          archived: repo.archived,
          pushedAt: repo.pushed_at,
          updatedAt: repo.updated_at,
          openIssues: repo.open_issues_count,
          defaultBranch: repo.default_branch
        }
      };
    } catch (error) {
      return {
        resourceId: resource.id,
        source: "github",
        url: resource.url,
        ok: false,
        payload: {},
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  const packageName = parseNpmPackage(resource.url);
  if (packageName) {
    try {
      const npmPackage = await fetchJson<NpmPackage>(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`);
      return {
        resourceId: resource.id,
        source: "npm",
        url: resource.url,
        ok: true,
        payload: {
          name: npmPackage.name,
          latest: npmPackage["dist-tags"]?.latest,
          createdAt: npmPackage.time?.created,
          modifiedAt: npmPackage.time?.modified
        }
      };
    } catch (error) {
      return {
        resourceId: resource.id,
        source: "npm",
        url: resource.url,
        ok: false,
        payload: {},
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  try {
    return {
      resourceId: resource.id,
      source: "website",
      url: resource.url,
      ok: true,
      payload: await fetchHead(resource.url)
    };
  } catch (error) {
    return {
      resourceId: resource.id,
      source: "website",
      url: resource.url,
      ok: false,
      payload: {},
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function monthsSince(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 30);
}

export function scoreSignal(signal: CollectedSignal, fallback: RadarResource): ScoredSignal {
  const reasons: string[] = [];
  let status = fallback.radar.status;
  let maintainStatus = fallback.radar.maintainStatus;
  let riskLevel = fallback.radar.riskLevel;

  if (!signal.ok) {
    reasons.push(`${signal.source} 采集失败：${signal.error ?? "未知错误"}`);
    return {
      resourceId: signal.resourceId,
      status: status === "adopt" ? "trial" : status,
      maintainStatus: maintainStatus === "active" ? "unknown" : maintainStatus,
      riskLevel: riskLevel === "low" ? "medium" : riskLevel,
      reasons
    };
  }

  if (signal.source === "github") {
    const archived = signal.payload.archived === true;
    const pushedMonths = monthsSince(signal.payload.pushedAt);
    const stars = typeof signal.payload.stars === "number" ? signal.payload.stars : 0;

    if (archived) {
      reasons.push("GitHub 仓库已归档");
      status = "hold";
      maintainStatus = "deprecated";
      riskLevel = "high";
    } else if (pushedMonths !== null && pushedMonths <= 6) {
      reasons.push("最近 6 个月内仍有代码更新");
      maintainStatus = "active";
      riskLevel = fallback.radar.riskLevel === "high" ? "medium" : "low";
      if (stars >= 1000 && fallback.radar.status !== "hold") status = "adopt";
    } else if (pushedMonths !== null && pushedMonths > 24) {
      reasons.push("超过 24 个月没有代码更新");
      maintainStatus = "stale";
      riskLevel = "high";
      status = fallback.radar.status === "adopt" ? "assess" : fallback.radar.status;
    } else {
      reasons.push("GitHub 更新频率需要继续观察");
    }
  }

  if (signal.source === "npm") {
    const modifiedMonths = monthsSince(signal.payload.modifiedAt);
    if (modifiedMonths !== null && modifiedMonths <= 12) {
      reasons.push("npm 包最近 12 个月内有发布或元数据更新");
      maintainStatus = "active";
      if (riskLevel === "high") riskLevel = "medium";
    } else if (modifiedMonths !== null && modifiedMonths > 24) {
      reasons.push("npm 包超过 24 个月没有更新");
      maintainStatus = "stale";
      riskLevel = "high";
      if (status === "adopt") status = "assess";
    }
  }

  if (signal.source === "website") {
    const httpStatus = signal.payload.status;
    if (typeof httpStatus === "number" && httpStatus >= 200 && httpStatus < 400) {
      reasons.push(`官网可访问，HTTP ${httpStatus}`);
    } else {
      reasons.push(`官网可用性异常，HTTP ${String(httpStatus)}`);
      if (riskLevel === "low") riskLevel = "medium";
    }
  }

  return { resourceId: signal.resourceId, status, maintainStatus, riskLevel, reasons };
}

async function persistEnrichment(candidates: RadarResource[], signals: CollectedSignal[], scores: ScoredSignal[]) {
  if (!process.env.DATABASE_URL) return false;
  const db = createDb();

  for (const resource of candidates) {
    await db
      .insert(resourcesTable)
      .values({
        id: resource.id,
        title: resource.title,
        url: resource.url,
        description: resource.description,
        note: resource.note || null,
        categoryId: resource.categoryId,
        categoryName: resource.category,
        sectionId: resource.sectionId,
        sectionName: resource.section,
        resourceType: resource.radar.type,
        status: resource.radar.status,
        maintainStatus: resource.radar.maintainStatus,
        riskLevel: resource.radar.riskLevel,
        summary: resource.radar.summary,
        metadata: resource.metadata
      })
      .onConflictDoUpdate({
        target: resourcesTable.id,
        set: {
          title: resource.title,
          url: resource.url,
          description: resource.description,
          note: resource.note || null,
          categoryId: resource.categoryId,
          categoryName: resource.category,
          sectionId: resource.sectionId,
          sectionName: resource.section,
          resourceType: resource.radar.type,
          summary: resource.radar.summary,
          metadata: resource.metadata,
          updatedAt: new Date()
        }
      });
  }

  for (const signal of signals) {
    await db
      .insert(resourceSignals)
      .values({
        id: signalId(signal),
        resourceId: signal.resourceId,
        source: signal.source,
        url: signal.url,
        payload: { ...signal.payload, ok: signal.ok, error: signal.error ?? null }
      })
      .onConflictDoUpdate({
        target: resourceSignals.id,
        set: {
          payload: { ...signal.payload, ok: signal.ok, error: signal.error ?? null },
          collectedAt: new Date()
        }
      });
  }

  for (const score of scores) {
    const signal = signals.find((item) => item.resourceId === score.resourceId);
    const scoreSignalId = signal ? signalId(signal) : null;

    await db
      .insert(resourceScores)
      .values({
        resourceId: score.resourceId,
        signalId: scoreSignalId,
        status: score.status,
        maintainStatus: score.maintainStatus,
        riskLevel: score.riskLevel,
        reasons: score.reasons
      })
      .onConflictDoUpdate({
        target: resourceScores.resourceId,
        set: {
          signalId: scoreSignalId,
          status: score.status,
          maintainStatus: score.maintainStatus,
          riskLevel: score.riskLevel,
          reasons: score.reasons,
          scoredAt: new Date()
        }
      });

    await db
      .update(resourcesTable)
      .set({
        status: score.status,
        maintainStatus: score.maintainStatus,
        riskLevel: score.riskLevel,
        updatedAt: new Date()
      })
      .where(eq(resourcesTable.id, score.resourceId));
  }

  return true;
}

export async function runEnrichment(options: { limit?: number; persist?: boolean } = {}): Promise<EnrichmentResult> {
  const resources = await getResources();
  const candidates = resources
    .filter((resource) => resource.url.startsWith("http://") || resource.url.startsWith("https://"))
    .slice(0, options.limit ?? 30);
  const signals: CollectedSignal[] = [];
  const scores: ScoredSignal[] = [];

  for (const resource of candidates) {
    const signal = await collectResourceSignal(resource);
    signals.push(signal);
    scores.push(scoreSignal(signal, resource));
  }

  const persisted = options.persist === false ? false : await persistEnrichment(candidates, signals, scores);

  return {
    total: resources.length,
    attempted: candidates.length,
    collected: signals.filter((signal) => signal.ok).length,
    failed: signals.filter((signal) => !signal.ok).length,
    persisted,
    signals,
    scores
  };
}
