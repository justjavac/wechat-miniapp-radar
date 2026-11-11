import radarScoresJson from "@/public/api/radar-scores.json";
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

const embeddedScoreSnapshot = radarScoresJson as unknown as ScoreSnapshot;

export async function getScoreSnapshot(): Promise<ScoreSnapshot> {
  return embeddedScoreSnapshot;
}
