import assert from "node:assert/strict";
import { GET } from "@/app/api/compare/route";

interface CompareResponse {
  resources: Array<{ id: string }>;
  matrix: Array<{
    id: string;
    status: string;
    riskLevel: string;
    maintainStatus: string;
    evidenceCount: number;
  }>;
  insights: Array<{
    id: string;
    recommendation: string;
    bestFor: string[];
    tradeoffs: string[];
    validationChecklist: string[];
    evidence: Array<{ url: string }>;
  }>;
  requestedIds: string[];
  missingIds: string[];
}

async function request(path: string) {
  const response = await GET(new Request(`https://example.com${path}`));
  assert.equal(response.status, 200);
  return (await response.json()) as CompareResponse;
}

const defaults = await request("/api/compare");
assert.ok(defaults.resources.length >= 4, "default compare should include core options");
assert.equal(defaults.matrix.length, defaults.resources.length);
assert.ok(defaults.matrix.every((row) => row.id && row.status && row.riskLevel && row.maintainStatus));
assert.equal(defaults.insights.length, defaults.resources.length);
assert.ok(defaults.insights.every((item) => item.id && item.recommendation && item.bestFor.length > 0), "compare insights should include decision context");
assert.ok(defaults.insights.every((item) => item.tradeoffs.length > 0 && item.validationChecklist.length > 0), "compare insights should include tradeoffs and validation checklist");
assert.ok(defaults.insights.every((item) => item.evidence.some((evidence) => evidence.url)), "compare insights should include evidence URLs");

const selected = await request("/api/compare?ids=github-com-nervjstaro,github-com-dcloudiouni-app,missing-resource");
assert.deepEqual(
  selected.resources.map((resource) => resource.id),
  ["github-com-nervjstaro", "github-com-dcloudiouni-app"]
);
assert.deepEqual(selected.requestedIds, ["github-com-nervjstaro", "github-com-dcloudiouni-app", "missing-resource"]);
assert.deepEqual(selected.missingIds, ["missing-resource"]);
assert.equal(selected.matrix.length, 2);
assert.equal(selected.insights.length, 2);

const repeated = await request("/api/compare?id=github-com-nervjstaro&id=github-com-nervjstaro&id=github-com-didimpx");
assert.deepEqual(
  repeated.resources.map((resource) => resource.id),
  ["github-com-nervjstaro", "github-com-didimpx"]
);

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      cases: 3,
      assertions: ["default matrix", "compare insights", "selected ids", "dedupe repeated ids"]
    },
    null,
    2
  )
);
