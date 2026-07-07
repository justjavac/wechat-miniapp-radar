import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/api-security";
import { runEnrichment } from "@/lib/enrichment";
import { cleanupOperationLogs, logOperation } from "@/lib/operation-log";
import { acquireTaskLock } from "@/lib/task-lock";

const ENRICH_LOCK_TTL_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit") ?? "30");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 30;
  const dryRun = url.searchParams.get("dryRun") === "1" || url.searchParams.get("dryRun") === "true";
  const lock = dryRun ? null : await acquireTaskLock("cron.enrich", ENRICH_LOCK_TTL_MS);

  if (lock && !lock.acquired) {
    return NextResponse.json(
      {
        ok: false,
        error: "Enrichment is already running.",
        lock: {
          enabled: lock.enabled,
          key: lock.key
        }
      },
      { status: 409 }
    );
  }

  try {
    const result = await runEnrichment({ limit, persist: !dryRun });
    const logCleanup = dryRun ? { enabled: false, deleted: 0, retentionDays: null } : await cleanupOperationLogs();

    if (!dryRun) {
      await logOperation({
        scope: "cron.enrich",
        level: result.failed > 0 ? "warn" : "info",
        message: result.failed > 0 ? "Enrichment completed with failed signals." : "Enrichment completed.",
        metadata: {
          limit,
          attempted: result.attempted,
          collected: result.collected,
          failed: result.failed,
          persisted: result.persisted,
          lock: lock
            ? {
                enabled: lock.enabled,
                error: lock.error ?? null
              }
            : null,
          logCleanup
        }
      });
    }

    return NextResponse.json({
      ok: true,
      mode: dryRun || !process.env.DATABASE_URL ? "dry-run" : "persist",
      lock: lock
        ? {
            enabled: lock.enabled,
            error: lock.error ?? null
          }
        : null,
      logCleanup,
      result
    });
  } catch (error) {
    const logCleanup = await cleanupOperationLogs();
    await logOperation({
      scope: "cron.enrich",
      level: "error",
      message: "Enrichment failed.",
      metadata: {
        limit,
        error: error instanceof Error ? error.message : String(error),
        logCleanup
      }
    });
    return NextResponse.json({ ok: false, error: "Enrichment failed" }, { status: 500 });
  } finally {
    await lock?.release();
  }
}
