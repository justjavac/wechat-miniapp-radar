import { readFile } from "node:fs/promises";
import { createDb } from "@/db/client";
import { resources as databaseResources } from "@/db/schema";
import { getAiConfig, type AiConfig } from "@/lib/ai-config";
import { getResources } from "@/lib/resources";
import { hasUpstashRedis } from "@/lib/upstash";

export interface HealthCheck {
  ok: boolean;
  checkedAt: string;
  resources: {
    count: number;
  };
  snapshots: {
    aiSummaries: {
      present: boolean;
      generatedAt: string | null;
      count: number;
      mode: string | null;
    };
    radarScores: {
      present: boolean;
      generatedAt: string | null;
      count: number;
    };
    weekly: {
      present: boolean;
      latestId: string | null;
      generatedAt: string | null;
      historyCount: number;
    };
  };
  database: {
    configured: boolean;
    connected: boolean;
    error: string | null;
  };
  integrations: {
    ai: AiConfig;
    openai: boolean;
    github: boolean;
    cronSecret: boolean;
    adminToken: boolean;
    blob: boolean;
    upstashRedis: boolean;
    siteUrl: boolean;
  };
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJsonRecord(file: string): Promise<JsonRecord | null> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readArrayCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

async function getSnapshotHealth(): Promise<HealthCheck["snapshots"]> {
  const [aiSummaries, radarScores, weeklyLatest, weeklyIndex] = await Promise.all([
    readJsonRecord("public/api/ai-summaries.json"),
    readJsonRecord("public/api/radar-scores.json"),
    readJsonRecord("public/api/weekly/latest.json"),
    readJsonRecord("public/api/weekly/index.json")
  ]);

  return {
    aiSummaries: {
      present: Boolean(aiSummaries),
      generatedAt: readString(aiSummaries?.generatedAt),
      count: typeof aiSummaries?.count === "number" ? aiSummaries.count : readArrayCount(aiSummaries?.summaries),
      mode: readString(aiSummaries?.mode)
    },
    radarScores: {
      present: Boolean(radarScores),
      generatedAt: readString(radarScores?.generatedAt),
      count: readArrayCount(radarScores?.scores)
    },
    weekly: {
      present: Boolean(weeklyLatest) && Boolean(weeklyIndex),
      latestId: readString(weeklyLatest?.id),
      generatedAt: readString(weeklyLatest?.generatedAt),
      historyCount: readArrayCount(weeklyIndex?.reports)
    }
  };
}

export async function getHealthCheck(): Promise<HealthCheck> {
  const [resources, snapshots] = await Promise.all([getResources(), getSnapshotHealth()]);
  const ai = getAiConfig();
  const database = {
    configured: Boolean(process.env.DATABASE_URL),
    connected: false,
    error: null as string | null
  };

  if (process.env.DATABASE_URL) {
    try {
      const db = createDb();
      await db.select({ id: databaseResources.id }).from(databaseResources).limit(1);
      database.connected = true;
    } catch (error) {
      database.error = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    ok: resources.length > 0 && (!database.configured || database.connected),
    checkedAt: new Date().toISOString(),
    resources: {
      count: resources.length
    },
    snapshots,
    database,
    integrations: {
      ai,
      openai: ai.configured,
      github: Boolean(process.env.GITHUB_TOKEN),
      cronSecret: Boolean(process.env.CRON_SECRET),
      adminToken: Boolean(process.env.ADMIN_TOKEN),
      blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      upstashRedis: hasUpstashRedis(),
      siteUrl: Boolean(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL)
    }
  };
}
