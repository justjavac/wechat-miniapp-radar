import { NextResponse } from "next/server";
import { getResourceAiSummaries } from "@/lib/ai-summaries";

function parseLimit(value: string | null) {
  if (!value) return undefined;
  const limit = Number(value);
  return Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const payload = await getResourceAiSummaries({
    query: url.searchParams.get("q") ?? undefined,
    limit: parseLimit(url.searchParams.get("limit"))
  });

  return NextResponse.json(payload);
}
