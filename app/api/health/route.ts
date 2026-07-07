import { NextResponse } from "next/server";
import { getHealthCheck } from "@/lib/health";

export async function GET() {
  const health = await getHealthCheck();
  return NextResponse.json(health, {
    status: health.ok ? 200 : 503
  });
}
