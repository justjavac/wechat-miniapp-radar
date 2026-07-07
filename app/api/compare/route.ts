import { NextResponse } from "next/server";
import { buildCompareInsights, buildCompareMatrix, getCompareResources } from "@/lib/resources";

function parseIds(url: URL) {
  const ids = [...url.searchParams.getAll("id")];
  const commaSeparated = url.searchParams.get("ids");
  if (commaSeparated) ids.push(...commaSeparated.split(","));
  return ids.map((id) => id.trim()).filter(Boolean);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = parseIds(url);
  const resources = await getCompareResources({ ids });
  const foundIds = new Set(resources.map((resource) => resource.id));

  return NextResponse.json({
    resources,
    matrix: buildCompareMatrix(resources),
    insights: buildCompareInsights(resources),
    requestedIds: ids,
    missingIds: ids.filter((id) => !foundIds.has(id))
  });
}
