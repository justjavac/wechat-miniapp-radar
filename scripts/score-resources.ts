import { writeFile } from "node:fs/promises";
import { getResources, getStats } from "@/lib/resources";

const resources = await getResources();
const stats = getStats(resources);
const scores = resources.map((resource) => ({
  id: resource.id,
  title: resource.title,
  status: resource.radar.status,
  maintainStatus: resource.radar.maintainStatus,
  riskLevel: resource.radar.riskLevel,
  type: resource.radar.type,
  reasons: resource.radar.evidence.map((item) => `${item.label}: ${item.url}`),
  evidenceRefs: resource.radar.evidence.map((item) => ({
    type: item.type,
    label: item.label,
    url: item.url
  }))
}));

const output = {
  generatedAt: new Date().toISOString(),
  stats,
  scores
};

await writeFile("public/api/radar-scores.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");

console.log(`Scored ${scores.length} resources`);
