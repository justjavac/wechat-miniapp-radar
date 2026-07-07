import { NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import { getHealthCheck } from "@/lib/health";
import { buildProductionReadiness, summarizeProductionReadiness } from "@/lib/production-readiness";

export async function GET(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await getHealthCheck();
  const readiness = buildProductionReadiness(health);

  return NextResponse.json(
    {
      ok: health.ok,
      checkedAt: new Date().toISOString(),
      summary: summarizeProductionReadiness(readiness),
      readiness,
      health
    },
    { status: health.ok ? 200 : 503 }
  );
}
