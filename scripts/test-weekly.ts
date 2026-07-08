import assert from "node:assert/strict";
import { createWeeklyReport, getWeeklyHistory, hydrateWeeklyReportFromSnapshot } from "@/lib/weekly";

const report = await createWeeklyReport(new Date("2026-01-05T00:00:00.000Z"));

assert.equal(report.id, "2026-01-05");
assert.ok(report.title.includes("2026-01-05"));
assert.ok(report.stats.total > 0, "weekly report should include resource stats");
assert.ok(report.highlights.length > 0, "weekly report should include highlighted resources");
assert.ok(report.risks.length > 0, "weekly report should include risk resources");
assert.ok(report.needsAssessment.length > 0, "weekly report should include assessment resources");
assert.ok(report.signalDigest.signals.length > 0, "weekly report should include signal digest entries");
assert.ok(["score-snapshot", "resource-snapshot"].includes(report.signalDigest.source), "weekly signal digest should expose its source");

for (const heading of ["## 概览", "## 推荐关注", "## 风险提醒", "## 需要评估"]) {
  assert.ok(report.markdown.includes(heading), `weekly markdown should include ${heading}`);
}

assert.ok(report.markdown.includes("## Signal Digest"), "weekly markdown should include signal digest");
assert.ok(
  report.markdown.indexOf("## 概览") < report.markdown.indexOf("## Signal Digest"),
  "weekly signal digest should appear after the overview"
);
assert.ok(
  report.markdown.indexOf("## Signal Digest") < report.markdown.indexOf("## 推荐关注"),
  "weekly signal digest should appear before recommended resources"
);

for (const resource of [report.highlights[0], report.risks[0], report.needsAssessment[0]]) {
  assert.ok(report.markdown.includes(`/resources/${resource.id}`), `${resource.id} should link to its resource detail page`);
  assert.ok(
    resource.radar.evidence.some((evidence) => report.markdown.includes(evidence.url)),
    `${resource.id} should include at least one evidence URL`
  );
}

assert.ok(report.markdown.includes("证据："), "weekly markdown should label evidence links");

assert.ok(report.markdown.includes(`/resources/${report.signalDigest.signals[0].resourceId}`), "weekly signal digest should link to resource details");

const fixtureResources = [...report.highlights, ...report.risks, ...report.needsAssessment].filter(
  (resource, index, array) => array.findIndex((item) => item.id === resource.id) === index
);
const databaseReport = hydrateWeeklyReportFromSnapshot(
  {
    id: "2026-01-12",
    title: "小程序生态周报 2026-01-12",
    content: "database markdown",
    generatedAt: new Date("2026-01-12T03:00:00.000Z"),
    snapshot: {
      stats: report.stats,
      highlights: report.highlights.map((resource) => resource.id),
      risks: report.risks.map((resource) => resource.id),
      needsAssessment: report.needsAssessment.map((resource) => resource.id),
      signalDigest: report.signalDigest
    }
  },
  fixtureResources
);
assert.equal(databaseReport.id, "2026-01-12");
assert.equal(databaseReport.generatedAt, "2026-01-12T03:00:00.000Z");
assert.equal(databaseReport.markdown, "database markdown");
assert.deepEqual(
  databaseReport.highlights.map((resource) => resource.id),
  report.highlights.map((resource) => resource.id),
  "persisted weekly report should hydrate highlighted resource ids"
);
assert.deepEqual(
  databaseReport.risks.map((resource) => resource.id),
  report.risks.map((resource) => resource.id),
  "persisted weekly report should hydrate risk resource ids"
);
assert.deepEqual(databaseReport.signalDigest, report.signalDigest, "persisted weekly report should preserve signal digest");

const history = await getWeeklyHistory(12);
assert.ok(history.length > 0, "weekly history should expose at least one report");
assert.ok(history.every((item) => item.id && item.title && item.generatedAt), "weekly history items should include id, title and generatedAt");

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      reportId: report.id,
      total: report.stats.total,
      highlights: report.highlights.length,
      risks: report.risks.length,
      needsAssessment: report.needsAssessment.length,
      signals: report.signalDigest.signals.length,
      hydratedReportId: databaseReport.id,
      history: history.length
    },
    null,
    2
  )
);
