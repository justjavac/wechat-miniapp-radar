import { randomUUID } from "node:crypto";
import { desc, lt } from "drizzle-orm";
import { createDb } from "@/db/client";
import { operationLogs } from "@/db/schema";

export type OperationLogLevel = "info" | "warn" | "error";

export interface OperationLogInput {
  scope: string;
  level: OperationLogLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface OperationLogEntry {
  id: string;
  scope: string;
  level: OperationLogLevel;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface OperationLogCleanupResult {
  enabled: boolean;
  retentionDays: number;
  deleted: number;
  cutoff: string | null;
}

const DEFAULT_OPERATION_LOG_RETENTION_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getOperationLogRetentionDays(value = process.env.OPERATION_LOG_RETENTION_DAYS) {
  if (!value) return DEFAULT_OPERATION_LOG_RETENTION_DAYS;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_OPERATION_LOG_RETENTION_DAYS;

  return Math.floor(parsed);
}

export async function logOperation(input: OperationLogInput) {
  if (!process.env.DATABASE_URL) return false;

  try {
    const db = createDb();
    await db.insert(operationLogs).values({
      id: randomUUID(),
      scope: input.scope,
      level: input.level,
      message: input.message,
      metadata: input.metadata ?? {}
    });
    return true;
  } catch (error) {
    console.warn("Failed to write operation log", error);
    return false;
  }
}

export async function cleanupOperationLogs(options: { retentionDays?: number; now?: Date } = {}): Promise<OperationLogCleanupResult> {
  const retentionDays = options.retentionDays ?? getOperationLogRetentionDays();
  const cutoff = new Date((options.now ?? new Date()).getTime() - retentionDays * MS_PER_DAY);

  if (!process.env.DATABASE_URL) {
    return {
      enabled: false,
      retentionDays,
      deleted: 0,
      cutoff: cutoff.toISOString()
    };
  }

  try {
    const db = createDb();
    const deletedRows = await db.delete(operationLogs).where(lt(operationLogs.createdAt, cutoff)).returning({ id: operationLogs.id });
    return {
      enabled: true,
      retentionDays,
      deleted: deletedRows.length,
      cutoff: cutoff.toISOString()
    };
  } catch (error) {
    console.warn("Failed to clean up operation logs", error);
    return {
      enabled: true,
      retentionDays,
      deleted: 0,
      cutoff: cutoff.toISOString()
    };
  }
}

export async function getRecentOperationLogs(limit = 20): Promise<OperationLogEntry[]> {
  if (!process.env.DATABASE_URL) return [];

  try {
    const db = createDb();
    const rows = await db.select().from(operationLogs).orderBy(desc(operationLogs.createdAt)).limit(limit);
    return rows.map((row) => ({
      id: row.id,
      scope: row.scope,
      level: row.level as OperationLogLevel,
      message: row.message,
      metadata: typeof row.metadata === "object" && row.metadata !== null ? (row.metadata as Record<string, unknown>) : {},
      createdAt: row.createdAt.toISOString()
    }));
  } catch {
    return [];
  }
}
