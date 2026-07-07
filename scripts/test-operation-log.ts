import assert from "node:assert/strict";
import { cleanupOperationLogs, getOperationLogRetentionDays } from "@/lib/operation-log";

const originalEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  OPERATION_LOG_RETENTION_DAYS: process.env.OPERATION_LOG_RETENTION_DAYS
};

function setEnv(name: keyof typeof originalEnv, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

try {
  assert.equal(getOperationLogRetentionDays(undefined), 30, "default retention should be 30 days");
  assert.equal(getOperationLogRetentionDays("7"), 7, "numeric retention should be honored");
  assert.equal(getOperationLogRetentionDays("7.9"), 7, "fractional retention should be floored");
  assert.equal(getOperationLogRetentionDays("0"), 30, "zero retention should fall back to default");
  assert.equal(getOperationLogRetentionDays("-1"), 30, "negative retention should fall back to default");
  assert.equal(getOperationLogRetentionDays("invalid"), 30, "invalid retention should fall back to default");

  setEnv("DATABASE_URL", undefined);
  setEnv("OPERATION_LOG_RETENTION_DAYS", "14");

  const cleanup = await cleanupOperationLogs({
    now: new Date("2026-07-06T00:00:00.000Z")
  });

  assert.equal(cleanup.enabled, false, "cleanup should report disabled without DATABASE_URL");
  assert.equal(cleanup.retentionDays, 14, "cleanup should use configured retention days");
  assert.equal(cleanup.deleted, 0, "cleanup without database should not delete rows");
  assert.equal(cleanup.cutoff, "2026-06-22T00:00:00.000Z", "cleanup cutoff should be based on retention days");

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        cases: 2,
        assertions: ["retention parsing", "database-free cleanup result"]
      },
      null,
      2
    )
  );
} finally {
  setEnv("DATABASE_URL", originalEnv.DATABASE_URL);
  setEnv("OPERATION_LOG_RETENTION_DAYS", originalEnv.OPERATION_LOG_RETENTION_DAYS);
}
