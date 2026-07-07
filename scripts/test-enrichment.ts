import assert from "node:assert/strict";
import { scoreSignal, signalId, type CollectedSignal } from "@/lib/enrichment";
import type { RadarResource } from "@/lib/resources";

function fallback(overrides: Partial<RadarResource["radar"]> = {}): RadarResource {
  return {
    id: "fixture-resource",
    title: "Fixture Resource",
    url: "https://github.com/example/fixture",
    description: "Fixture resource",
    category: "Fixture",
    categoryId: "fixture",
    section: null,
    sectionId: null,
    metadata: {
      language: ["zh-CN"],
      difficulty: "unknown",
      topics: ["fixture"]
    },
    radar: {
      type: "framework",
      status: "adopt",
      maintainStatus: "active",
      riskLevel: "low",
      summary: "Fixture summary",
      useCases: ["fixture"],
      notRecommendedFor: [],
      alternatives: [],
      evidence: [{ type: "github", label: "GitHub", url: "https://github.com/example/fixture" }],
      ...overrides
    }
  };
}

function signal(overrides: Partial<CollectedSignal>): CollectedSignal {
  return {
    resourceId: "fixture-resource",
    source: "github",
    url: "https://github.com/example/fixture",
    ok: true,
    payload: {},
    ...overrides
  };
}

const archivedSignal = signal({
  payload: {
    archived: true,
    pushedAt: new Date().toISOString(),
    stars: 2000
  }
});
const archivedScore = scoreSignal(archivedSignal, fallback());
assert.equal(archivedScore.status, "hold");
assert.equal(archivedScore.maintainStatus, "deprecated");
assert.equal(archivedScore.riskLevel, "high");
assert.ok(archivedScore.reasons.some((reason) => reason.includes("归档")));
assert.equal(signalId(archivedSignal).length, 40, "signal id should be a sha1 trace key");

const failedScore = scoreSignal(
  signal({
    ok: false,
    error: "HTTP 500"
  }),
  fallback()
);
assert.equal(failedScore.status, "trial");
assert.equal(failedScore.maintainStatus, "unknown");
assert.equal(failedScore.riskLevel, "medium");
assert.ok(failedScore.reasons.some((reason) => reason.includes("采集失败")));

const staleNpmScore = scoreSignal(
  signal({
    source: "npm",
    url: "https://www.npmjs.com/package/fixture",
    payload: {
      modifiedAt: "2020-01-01T00:00:00.000Z"
    }
  }),
  fallback()
);
assert.equal(staleNpmScore.status, "assess");
assert.equal(staleNpmScore.maintainStatus, "stale");
assert.equal(staleNpmScore.riskLevel, "high");
assert.ok(staleNpmScore.reasons.some((reason) => reason.includes("24 个月")));

const websiteScore = scoreSignal(
  signal({
    source: "website",
    url: "https://example.com",
    payload: {
      status: 200,
      finalUrl: "https://example.com",
      contentType: "text/html"
    }
  }),
  fallback({ status: "trial", maintainStatus: "unknown", riskLevel: "medium" })
);
assert.equal(websiteScore.status, "trial");
assert.equal(websiteScore.riskLevel, "medium");
assert.ok(websiteScore.reasons.some((reason) => reason.includes("HTTP 200")));

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      cases: 4,
      assertions: ["archived github", "failed signal", "stale npm", "healthy website"]
    },
    null,
    2
  )
);
