import assert from "node:assert/strict";
import { acquireTaskLock } from "@/lib/task-lock";

const originalEnv = {
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

function mockFetch(results: unknown[]) {
  const calls: unknown[] = [];
  globalThis.fetch = (async (_input, init) => {
    calls.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ result: results.shift() ?? null }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  return calls;
}

try {
  setEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
  setEnv("UPSTASH_REDIS_REST_URL", undefined);
  const fallbackLock = await acquireTaskLock("cron.test", 1000);
  assert.equal(fallbackLock.acquired, true, "task lock should fail open without Redis");
  assert.equal(fallbackLock.enabled, false, "task lock should be disabled without Redis");
  await fallbackLock.release();

  setEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
  setEnv("UPSTASH_REDIS_REST_URL", "https://upstash.example.test");
  const acquireCalls = mockFetch(["OK", 1]);
  const acquiredLock = await acquireTaskLock("cron.test", 1000);
  assert.equal(acquiredLock.acquired, true, "task lock should acquire when Redis SET NX succeeds");
  assert.equal(acquiredLock.enabled, true, "task lock should report Redis locking as enabled");
  await acquiredLock.release();
  assert.equal(acquireCalls.length, 2, "task lock should call SET and release with EVAL");
  assert.equal((acquireCalls[0] as unknown[])[0], "SET");
  assert.equal((acquireCalls[1] as unknown[])[0], "EVAL");

  const contendedCalls = mockFetch([null]);
  const contendedLock = await acquireTaskLock("cron.test", 1000);
  assert.equal(contendedLock.acquired, false, "task lock should reject when Redis SET NX returns null");
  assert.equal(contendedLock.enabled, true, "contended Redis lock should still be enabled");
  await contendedLock.release();
  assert.equal(contendedCalls.length, 1, "contended lock should not release an unowned lock");

  globalThis.fetch = (async () => new Response("{}", { status: 500 })) as typeof fetch;
  const degradedLock = await acquireTaskLock("cron.test", 1000);
  assert.equal(degradedLock.acquired, true, "task lock should fail open when Redis is unavailable");
  assert.equal(degradedLock.enabled, false, "task lock should report disabled when Redis probe fails");
  assert.ok(degradedLock.error, "task lock should expose the Redis error for operation logs");

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        cases: 4,
        assertions: ["no redis fallback", "redis acquire and release", "redis contention", "redis failure fallback"]
      },
      null,
      2
    )
  );
} finally {
  setEnv("UPSTASH_REDIS_REST_TOKEN", originalEnv.UPSTASH_REDIS_REST_TOKEN);
  setEnv("UPSTASH_REDIS_REST_URL", originalEnv.UPSTASH_REDIS_REST_URL);
  globalThis.fetch = originalFetch;
}
