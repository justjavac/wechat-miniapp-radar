import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDb } from "@/db/client";
import { resources } from "@/db/schema";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import { logOperation, type OperationLogInput } from "@/lib/operation-log";
import type { MaintainStatus, RadarStatus, RiskLevel } from "@/lib/resources";

const radarStatuses = ["adopt", "trial", "assess", "hold"] as const satisfies readonly RadarStatus[];
const maintainStatuses = ["active", "low", "stale", "deprecated", "unknown"] as const satisfies readonly MaintainStatus[];
const riskLevels = ["low", "medium", "high"] as const satisfies readonly RiskLevel[];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function parseResourcePatch(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { error: "JSON body is required." };
  }

  const body = payload as Record<string, unknown>;
  const patch: Partial<{
    status: RadarStatus;
    maintainStatus: MaintainStatus;
    riskLevel: RiskLevel;
    summary: string;
  }> = {};

  if (body.status !== undefined) {
    if (!isOneOf(body.status, radarStatuses)) return { error: "Invalid status." };
    patch.status = body.status;
  }

  if (body.maintainStatus !== undefined) {
    if (!isOneOf(body.maintainStatus, maintainStatuses)) return { error: "Invalid maintainStatus." };
    patch.maintainStatus = body.maintainStatus;
  }

  if (body.riskLevel !== undefined) {
    if (!isOneOf(body.riskLevel, riskLevels)) return { error: "Invalid riskLevel." };
    patch.riskLevel = body.riskLevel;
  }

  if (body.summary !== undefined) {
    if (typeof body.summary !== "string" || body.summary.trim().length === 0) {
      return { error: "summary must be a non-empty string." };
    }
    patch.summary = body.summary.trim();
  }

  if (Object.keys(patch).length === 0) {
    return { error: "At least one supported field is required." };
  }

  return { patch };
}

export function buildResourceMaintenanceLog(input: {
  resourceId: string;
  resourceTitle: string;
  patch: Partial<{
    status: RadarStatus;
    maintainStatus: MaintainStatus;
    riskLevel: RiskLevel;
    summary: string;
  }>;
}): OperationLogInput {
  const fields = Object.keys(input.patch).sort();
  return {
    scope: "admin",
    level: "info",
    message: "Resource radar fields updated.",
    metadata: {
      resourceId: input.resourceId,
      title: input.resourceTitle,
      fields,
      values: {
        ...(input.patch.status ? { status: input.patch.status } : {}),
        ...(input.patch.maintainStatus ? { maintainStatus: input.patch.maintainStatus } : {}),
        ...(input.patch.riskLevel ? { riskLevel: input.patch.riskLevel } : {}),
        ...(input.patch.summary ? { summaryChanged: true } : {})
      }
    }
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isAdminRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const parsed = parseResourcePatch(await request.json().catch(() => null));

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL is required for resource maintenance." }, { status: 503 });
  }

  const db = createDb();
  const [updated] = await db
    .update(resources)
    .set({
      ...parsed.patch,
      updatedAt: new Date()
    })
    .where(eq(resources.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  const operationLogged = await logOperation(
    buildResourceMaintenanceLog({
      resourceId: id,
      resourceTitle: updated.title,
      patch: parsed.patch
    })
  );

  return NextResponse.json({ resource: updated, operationLogged });
}
