import assert from "node:assert/strict";
import { getResourceScoreTrace } from "@/lib/score-trace";

const originalDatabaseUrl = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;

try {
  const trace = await getResourceScoreTrace("github-com-tencentwepy");
  assert.ok(trace, "score trace should be available from the static snapshot");
  assert.equal(trace.source, "snapshot");
  assert.equal(trace.resourceId, "github-com-tencentwepy");
  assert.ok(trace.reasons.length > 0, "score trace should include reasons");
  assert.ok(trace.evidenceRefs.length > 0, "score trace should include structured evidence references");
  assert.ok(trace.evidenceRefs.every((evidence) => evidence.label && evidence.url), "score evidence refs should include labels and URLs");
  assert.ok(trace.scoredAt, "score trace should expose snapshot time");

  const missing = await getResourceScoreTrace("missing-resource");
  assert.equal(missing, null, "missing resources should not produce a trace");

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        cases: 2,
        assertions: ["snapshot trace", "structured score evidence", "missing trace"]
      },
      null,
      2
    )
  );
} finally {
  if (originalDatabaseUrl) {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
}
