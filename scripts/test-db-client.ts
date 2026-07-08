import assert from "node:assert/strict";
import { closeDb, createDb } from "@/db/client";

const originalDatabaseUrl = process.env.DATABASE_URL;
const primaryUrl = "postgres://user:pass@127.0.0.1:1/primary";
const secondaryUrl = "postgres://user:pass@127.0.0.1:1/secondary";

try {
  delete process.env.DATABASE_URL;
  assert.throws(() => createDb(), /DATABASE_URL is required/, "createDb should require DATABASE_URL when no explicit URL is provided");

  const first = createDb(primaryUrl);
  const second = createDb(primaryUrl);
  const other = createDb(secondaryUrl);
  assert.equal(first, second, "createDb should reuse the same client for the same database URL");
  assert.notEqual(first, other, "createDb should keep separate clients for different database URLs");

  await closeDb(primaryUrl);
  const afterClose = createDb(primaryUrl);
  assert.notEqual(afterClose, first, "closeDb should clear the cached client for a database URL");

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        cases: 4,
        assertions: ["required URL", "same URL reuse", "separate URL cache", "close clears cache"]
      },
      null,
      2
    )
  );
} finally {
  await closeDb();
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
}
