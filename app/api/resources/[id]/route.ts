import { NextResponse } from "next/server";
import { getResourceAiSummary } from "@/lib/ai-summaries";
import { findAlternativeResources, getResources } from "@/lib/resources";
import { buildResourceTimeline } from "@/lib/resource-timeline";
import { getResourceScoreTrace } from "@/lib/score-trace";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const resources = await getResources();
  const resource = resources.find((item) => item.id === id) ?? null;

  if (!resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  const [aiSummary, scoreTrace] = await Promise.all([getResourceAiSummary(resource.id), getResourceScoreTrace(resource.id)]);
  const alternativeResources = findAlternativeResources(resources, resource);
  const updateTimeline = buildResourceTimeline({ resource, aiSummary, scoreTrace, alternatives: alternativeResources });
  return NextResponse.json({ ...resource, aiSummary, scoreTrace, alternativeResources, updateTimeline });
}
