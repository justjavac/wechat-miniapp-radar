import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { resourceScores, resourceSignals } from "@/db/schema";
import { getScoreSnapshot } from "@/lib/score-snapshot";

export interface ResourceScoreTrace {
  resourceId: string;
  status: string;
  maintainStatus: string;
  riskLevel: string;
  reasons: string[];
  evidenceRefs: Array<{
    type: string;
    label: string;
    url: string;
  }>;
  source: "database" | "snapshot";
  scoredAt: string | null;
  signal: {
    id: string;
    source: string;
    url: string;
    payload: Record<string, unknown>;
    collectedAt: string;
  } | null;
}

function normalizeReasons(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

async function getDatabaseScoreTrace(resourceId: string): Promise<ResourceScoreTrace | null> {
  if (!process.env.DATABASE_URL) return null;

  try {
    const db = createDb();
    const [row] = await db
      .select({
        score: resourceScores,
        signal: resourceSignals
      })
      .from(resourceScores)
      .leftJoin(resourceSignals, eq(resourceScores.signalId, resourceSignals.id))
      .where(eq(resourceScores.resourceId, resourceId))
      .limit(1);

    if (!row) return null;

    return {
      resourceId: row.score.resourceId,
      status: row.score.status,
      maintainStatus: row.score.maintainStatus,
      riskLevel: row.score.riskLevel,
      reasons: normalizeReasons(row.score.reasons),
      evidenceRefs: row.signal
        ? [
            {
              type: row.signal.source,
              label: row.signal.source,
              url: row.signal.url
            }
          ]
        : [],
      source: "database",
      scoredAt: row.score.scoredAt.toISOString(),
      signal: row.signal
        ? {
            id: row.signal.id,
            source: row.signal.source,
            url: row.signal.url,
            payload: row.signal.payload as Record<string, unknown>,
            collectedAt: row.signal.collectedAt.toISOString()
          }
        : null
    };
  } catch (error) {
    console.warn(`Falling back to score snapshot for ${resourceId}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function getSnapshotScoreTrace(resourceId: string): Promise<ResourceScoreTrace | null> {
  const snapshot = await getScoreSnapshot();
  if (!snapshot) return null;

  const score = snapshot.scores.find((item) => item.id === resourceId);
  if (!score) return null;

  return {
    resourceId: score.id,
    status: score.status,
    maintainStatus: score.maintainStatus,
    riskLevel: score.riskLevel,
    reasons: score.reasons,
    evidenceRefs: score.evidenceRefs ?? [],
    source: "snapshot",
    scoredAt: snapshot.generatedAt,
    signal: null
  };
}

export async function getResourceScoreTrace(resourceId: string): Promise<ResourceScoreTrace | null> {
  return (await getDatabaseScoreTrace(resourceId)) ?? (await getSnapshotScoreTrace(resourceId));
}
