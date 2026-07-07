import assert from "node:assert/strict";
import { GET as enrichCron } from "@/app/api/cron/enrich/route";
import { GET as weeklyCron } from "@/app/api/cron/weekly/route";

const originalEnv = {
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  CRON_SECRET: process.env.CRON_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL
};
const originalFetch = globalThis.fetch;

function setEnv(name: keyof typeof originalEnv, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name as string] = value;
  }
}

try {
  setEnv("NODE_ENV", "production");
  setEnv("CRON_SECRET", "cron-secret");
  setEnv("DATABASE_URL", undefined);
  setEnv("BLOB_READ_WRITE_TOKEN", undefined);

  const unauthorizedEnrich = await enrichCron(new Request("https://example.com/api/cron/enrich"));
  assert.equal(unauthorizedEnrich.status, 401, "enrich cron should reject missing secret");

  const unauthorizedWeekly = await weeklyCron(new Request("https://example.com/api/cron/weekly"));
  assert.equal(unauthorizedWeekly.status, 401, "weekly cron should reject missing secret");

  const authorizedWeekly = await weeklyCron(
    new Request("https://example.com/api/cron/weekly", {
      headers: {
        authorization: "Bearer cron-secret"
      }
    })
  );
  assert.equal(authorizedWeekly.status, 200, "weekly cron should run with a valid secret");

  const payload = (await authorizedWeekly.json()) as {
    ok?: boolean;
    mode?: string;
    blobUrl?: string | null;
    weekly?: { id?: string; stats?: { total?: number }; markdown?: string };
  };
  assert.equal(payload.ok, true);
  assert.equal(payload.mode, "dry-run");
  assert.equal(payload.blobUrl, null);
  assert.ok(payload.weekly?.id, "weekly cron should return a report id");
  assert.ok((payload.weekly?.stats?.total ?? 0) > 0, "weekly cron should include resource stats");
  assert.ok(payload.weekly?.markdown?.includes("/resources/"), "weekly markdown should link back to resources");

  setEnv("DATABASE_URL", "postgres://invalid:invalid@127.0.0.1:1/invalid");
  setEnv("BLOB_READ_WRITE_TOKEN", "test-blob-token");
  const originalWarn = console.warn;
  console.warn = () => {};
  let authorizedWeeklyDryRun: Response;
  try {
    authorizedWeeklyDryRun = await weeklyCron(
      new Request("https://example.com/api/cron/weekly?dryRun=1", {
        headers: {
          authorization: "Bearer cron-secret"
        }
      })
    );
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(authorizedWeeklyDryRun.status, 200, "weekly dry-run should not touch configured database or blob");
  const dryRunPayload = (await authorizedWeeklyDryRun.json()) as {
    ok?: boolean;
    mode?: string;
    blobUrl?: string | null;
    weekly?: { id?: string; stats?: { total?: number } };
  };
  assert.equal(dryRunPayload.ok, true);
  assert.equal(dryRunPayload.mode, "dry-run");
  assert.equal(dryRunPayload.blobUrl, null);
  assert.ok((dryRunPayload.weekly?.stats?.total ?? 0) > 0, "weekly dry-run should still build a report");

  console.warn = () => {};
  let authorizedEnrichDryRun: Response;
  try {
    authorizedEnrichDryRun = await enrichCron(
      new Request("https://example.com/api/cron/enrich?dryRun=1&limit=1", {
        headers: {
          authorization: "Bearer cron-secret"
        }
      })
    );
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(authorizedEnrichDryRun.status, 200, "enrich dry-run should not touch configured database");
  const enrichDryRunPayload = (await authorizedEnrichDryRun.json()) as {
    ok?: boolean;
    mode?: string;
    result?: { attempted?: number; persisted?: boolean };
  };
  assert.equal(enrichDryRunPayload.ok, true);
  assert.equal(enrichDryRunPayload.mode, "dry-run");
  assert.ok((enrichDryRunPayload.result?.attempted ?? 0) > 0, "enrich dry-run should attempt at least one resource");
  assert.equal(enrichDryRunPayload.result?.persisted, false, "enrich dry-run should not persist signals");

  setEnv("UPSTASH_REDIS_REST_TOKEN", "test-redis-token");
  setEnv("UPSTASH_REDIS_REST_URL", "https://upstash.example.test");
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ result: null }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })) as typeof fetch;

  const lockedEnrich = await enrichCron(
    new Request("https://example.com/api/cron/enrich", {
      headers: {
        authorization: "Bearer cron-secret"
      }
    })
  );
  assert.equal(lockedEnrich.status, 409, "enrich cron should reject overlapping Redis-locked runs");
  assert.match((await lockedEnrich.json()).error, /already running/);

  const lockedWeekly = await weeklyCron(
    new Request("https://example.com/api/cron/weekly", {
      headers: {
        authorization: "Bearer cron-secret"
      }
    })
  );
  assert.equal(lockedWeekly.status, 409, "weekly cron should reject overlapping Redis-locked runs");
  assert.match((await lockedWeekly.json()).error, /already running/);

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        cases: 7,
        assertions: [
          "enrich unauthorized",
          "weekly unauthorized",
          "weekly authorized dry-run",
          "weekly dry-run avoids persistence",
          "enrich dry-run avoids persistence",
          "enrich lock contention",
          "weekly lock contention"
        ]
      },
      null,
      2
    )
  );
} finally {
  setEnv("BLOB_READ_WRITE_TOKEN", originalEnv.BLOB_READ_WRITE_TOKEN);
  setEnv("CRON_SECRET", originalEnv.CRON_SECRET);
  setEnv("DATABASE_URL", originalEnv.DATABASE_URL);
  setEnv("NODE_ENV", originalEnv.NODE_ENV);
  setEnv("UPSTASH_REDIS_REST_TOKEN", originalEnv.UPSTASH_REDIS_REST_TOKEN);
  setEnv("UPSTASH_REDIS_REST_URL", originalEnv.UPSTASH_REDIS_REST_URL);
  globalThis.fetch = originalFetch;
}
