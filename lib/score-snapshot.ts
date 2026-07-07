import { readFile } from "node:fs/promises";
import type { ResourceStats } from "@/lib/resources";

export interface ScoreSnapshot {
  generatedAt: string;
  stats: ResourceStats;
  scores: Array<{
    id: string;
    title: string;
    status: string;
    maintainStatus: string;
    riskLevel: string;
    type: string;
    reasons: string[];
    evidenceRefs: Array<{
      type: string;
      label: string;
      url: string;
    }>;
  }>;
}

export async function getScoreSnapshot(): Promise<ScoreSnapshot | null> {
  try {
    return JSON.parse(await readFile("public/api/radar-scores.json", "utf8")) as ScoreSnapshot;
  } catch {
    return null;
  }
}
