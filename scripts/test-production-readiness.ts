import assert from "node:assert/strict";
import { buildProductionReadiness, summarizeProductionReadiness } from "@/lib/production-readiness";
import type { HealthCheck } from "@/lib/health";

type HealthOverrides = Omit<Partial<HealthCheck>, "database" | "integrations" | "snapshots"> & {
  database?: Partial<HealthCheck["database"]>;
  integrations?: Partial<HealthCheck["integrations"]>;
  snapshots?: Partial<HealthCheck["snapshots"]>;
};

function health(overrides: HealthOverrides = {}): HealthCheck {
  const baseline: HealthCheck = {
    ok: true,
    checkedAt: "2026-01-01T00:00:00.000Z",
    resources: {
      count: 236
    },
    snapshots: {
      aiSummaries: {
        present: true,
        generatedAt: "2026-01-01T00:00:00.000Z",
        count: 236,
        mode: "rules"
      },
      radarScores: {
        present: true,
        generatedAt: "2026-01-01T00:00:00.000Z",
        count: 236
      },
      weekly: {
        present: true,
        latestId: "2026-01-01",
        generatedAt: "2026-01-01T00:00:00.000Z",
        historyCount: 1
      }
    },
    database: {
      configured: false,
      connected: false,
      error: null
    },
    integrations: {
      openai: false,
      github: false,
      cronSecret: false,
      adminToken: false,
      blob: false,
      upstashRedis: false,
      siteUrl: false
    }
  };

  return {
    ...baseline,
    ...overrides,
    snapshots: {
      ...baseline.snapshots,
      ...overrides.snapshots
    },
    database: {
      ...baseline.database,
      ...overrides.database
    },
    integrations: {
      ...baseline.integrations,
      ...overrides.integrations
    }
  };
}

const baselineItems = buildProductionReadiness(health());
const baselineSummary = summarizeProductionReadiness(baselineItems);
assert.equal(baselineSummary.total, 10);
assert.equal(baselineItems.find((item) => item.id === "preview-approval")?.status, "optional");
assert.equal(baselineItems.find((item) => item.id === "database")?.status, "missing");
assert.equal(baselineItems.find((item) => item.id === "snapshots")?.status, "ready");
assert.equal(baselineItems.find((item) => item.id === "openai")?.status, "optional");
assert.ok(baselineItems.every((item) => item.action.length > 0), "every readiness item should include an action");

const configuredItems = buildProductionReadiness(
  health({
    database: {
      configured: true,
      connected: true,
      error: null
    },
    integrations: {
      openai: true,
      github: true,
      cronSecret: true,
      adminToken: true,
      blob: true,
      upstashRedis: true,
      siteUrl: true
    }
  })
);
const configuredSummary = summarizeProductionReadiness(configuredItems);
assert.equal(configuredSummary.ready, 9);
assert.equal(configuredSummary.missing, 0);
assert.equal(configuredSummary.optional, 1);

const brokenSnapshotItems = buildProductionReadiness(
  health({
    snapshots: {
      aiSummaries: {
        present: false,
        generatedAt: null,
        count: 0,
        mode: null
      }
    }
  })
);
assert.equal(brokenSnapshotItems.find((item) => item.id === "snapshots")?.status, "missing");

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      cases: 3,
      assertions: ["baseline readiness", "configured readiness", "snapshot readiness"]
    },
    null,
    2
  )
);
