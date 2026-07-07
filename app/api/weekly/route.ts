import { NextResponse } from "next/server";
import { createWeeklyReport, getWeeklyHistory, readLatestWeeklyReport } from "@/lib/weekly";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("list") === "1") {
    const limitParam = Number(url.searchParams.get("limit") ?? "12");
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 12;
    return NextResponse.json({
      reports: await getWeeklyHistory(limit)
    });
  }

  const report = (await readLatestWeeklyReport()) ?? (await createWeeklyReport());
  return NextResponse.json(report);
}
