import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/api-security";
import { cleanupOperationLogs, logOperation } from "@/lib/operation-log";
import { acquireTaskLock } from "@/lib/task-lock";
import { createWeeklyReport, persistWeeklyReport, uploadWeeklyReport } from "@/lib/weekly";

const WEEKLY_LOCK_TTL_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1" || url.searchParams.get("dryRun") === "true";
  const lock = dryRun ? null : await acquireTaskLock("cron.weekly", WEEKLY_LOCK_TTL_MS);

  if (lock && !lock.acquired) {
    return NextResponse.json(
      {
        ok: false,
        error: "Weekly report generation is already running.",
        lock: {
          enabled: lock.enabled,
          key: lock.key
        }
      },
      { status: 409 }
    );
  }

  try {
    const report = await createWeeklyReport();
    const persisted = dryRun ? false : await persistWeeklyReport(report);
    const blobUrl = dryRun ? null : await uploadWeeklyReport(report);
    const logCleanup = dryRun ? { enabled: false, deleted: 0, retentionDays: null } : await cleanupOperationLogs();

    if (!dryRun) {
      await logOperation({
        scope: "cron.weekly",
        level: "info",
        message: "Weekly report generated.",
        metadata: {
          reportId: report.id,
          persisted,
          uploaded: Boolean(blobUrl),
          highRisk: report.stats.highRisk,
          total: report.stats.total,
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
      mode: persisted ? "persist" : "dry-run",
      blobUrl,
      lock: lock
        ? {
            enabled: lock.enabled,
            error: lock.error ?? null
          }
        : null,
      logCleanup,
      weekly: report
    });
  } catch (error) {
    const logCleanup = await cleanupOperationLogs();
    await logOperation({
      scope: "cron.weekly",
      level: "error",
      message: "Weekly report generation failed.",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        logCleanup
      }
    });
    return NextResponse.json({ ok: false, error: "Weekly report generation failed" }, { status: 500 });
  } finally {
    await lock?.release();
  }
}
