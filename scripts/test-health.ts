import assert from "node:assert/strict";
import { GET } from "@/app/api/health/route";
import { getHealthCheck } from "@/lib/health";

const envKeys = [
  "DATABASE_URL",
  "OPENAI_API_KEY",
  "OPENAI_API_URL",
  "OPENAI_MODEL",
  "OPENAI_FALLBACK_MODEL",
  "GITHUB_TOKEN",
  "CRON_SECRET",
  "ADMIN_TOKEN",
  "EDGEONE_BLOB_STORE",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "SITE_URL",
  "NEXT_PUBLIC_SITE_URL"
] as const;

const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function setEnv(key: (typeof envKeys)[number], value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

try {
  for (const key of envKeys) setEnv(key, undefined);

  const baseline = await getHealthCheck();
  assert.equal(baseline.ok, true, "health check should pass with static fallback resources");
  assert.ok(baseline.resources.count > 0, "health check should report resource count");
  assert.equal(baseline.database.configured, false);
  assert.equal(baseline.database.connected, false);
  assert.equal(baseline.database.error, null);
  assert.equal(baseline.snapshots.aiSummaries.present, true);
  assert.ok(baseline.snapshots.aiSummaries.count > 0, "health check should report AI summary snapshot count");
  assert.equal(baseline.snapshots.aiSummaries.mode, "rules");
  assert.ok(baseline.snapshots.aiSummaries.generatedAt, "health check should report AI summary generatedAt");
  assert.equal(baseline.snapshots.radarScores.present, true);
  assert.ok(baseline.snapshots.radarScores.count > 0, "health check should report radar score snapshot count");
  assert.ok(baseline.snapshots.radarScores.generatedAt, "health check should report radar score generatedAt");
  assert.equal(baseline.snapshots.weekly.present, true);
  assert.ok(baseline.snapshots.weekly.latestId, "health check should report latest weekly id");
  assert.ok(baseline.snapshots.weekly.historyCount > 0, "health check should report weekly history count");
  assert.deepEqual(baseline.integrations, {
    openai: false,
    ai: {
      configured: false,
      apiKeyConfigured: false,
      apiUrl: "https://api.openai.com/v1",
      model: "openai/gpt-oss-20b:free",
      fallbackModel: "nvidia/nemotron-nano-9b-v2:free",
      provider: "openai"
    },
    aiRuntime: {
      configured: false,
      provider: "openai",
      apiUrl: "https://api.openai.com/v1",
      primaryModel: "openai/gpt-oss-20b:free",
      fallbackModel: "nvidia/nemotron-nano-9b-v2:free",
      lastUpdatedAt: null,
      lastSource: "not_configured",
      lastModel: null,
      fallbackUsed: false,
      fallbackReason: null,
      lastError: null
    },
    github: false,
    cronSecret: false,
    adminToken: false,
    blob: false,
    upstashRedis: false,
    siteUrl: false
  });

  setEnv("OPENAI_API_KEY", "test-openai-key");
  setEnv("OPENAI_API_URL", "https://openrouter.ai/api/v1");
  setEnv("OPENAI_MODEL", "openai/gpt-oss-20b:free");
  setEnv("OPENAI_FALLBACK_MODEL", "nvidia/nemotron-nano-9b-v2:free");
  setEnv("GITHUB_TOKEN", "test-github-token");
  setEnv("CRON_SECRET", "test-cron-secret");
  setEnv("ADMIN_TOKEN", "test-admin-token");
  setEnv("EDGEONE_BLOB_STORE", "test-blob-store");
  setEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  setEnv("UPSTASH_REDIS_REST_TOKEN", "test-upstash-token");
  setEnv("SITE_URL", "https://miniprogram-radar.example.com");

  const configured = await getHealthCheck();
  assert.equal(configured.ok, true);
  assert.equal(configured.database.configured, false);
  assert.deepEqual(configured.integrations, {
    openai: true,
    ai: {
      configured: true,
      apiKeyConfigured: true,
      apiUrl: "https://openrouter.ai/api/v1",
      model: "openai/gpt-oss-20b:free",
      fallbackModel: "nvidia/nemotron-nano-9b-v2:free",
      provider: "openrouter"
    },
    aiRuntime: {
      configured: true,
      provider: "openrouter",
      apiUrl: "https://openrouter.ai/api/v1",
      primaryModel: "openai/gpt-oss-20b:free",
      fallbackModel: "nvidia/nemotron-nano-9b-v2:free",
      lastUpdatedAt: null,
      lastSource: "not_configured",
      lastModel: null,
      fallbackUsed: false,
      fallbackReason: null,
      lastError: null
    },
    github: true,
    cronSecret: true,
    adminToken: true,
    blob: true,
    upstashRedis: true,
    siteUrl: true
  });

  const response = await GET();
  assert.equal(response.status, 200);
  const payload = (await response.json()) as typeof configured;
  assert.equal(payload.ok, true);
  assert.ok(payload.resources.count > 0);
  assert.ok(payload.snapshots.aiSummaries.count > 0);
  assert.ok(payload.snapshots.radarScores.count > 0);
  assert.ok(payload.snapshots.weekly.historyCount > 0);
  assert.equal(payload.integrations.openai, true);
  assert.equal(payload.integrations.ai.provider, "openrouter");

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        cases: 4,
        assertions: ["static fallback", "snapshot health", "integration flags", "route status"]
      },
      null,
      2
    )
  );
} finally {
  for (const key of envKeys) setEnv(key, originalEnv[key]);
}
