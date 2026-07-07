interface SmokeResult {
  name: string;
  ok: boolean;
  detail: string;
}

export {};

const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const results: SmokeResult[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
}

async function getJson<T>(path: string) {
  const response = await fetch(`${baseUrl}${path}`);
  const payload = (await response.json()) as T;
  return { response, payload };
}

async function checkPage(path: string, marker: string) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  record(`page:${path}`, response.ok && text.includes(marker), `${response.status} ${path}`);
}

async function checkPageAny(path: string, markers: string[]) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  record(`page:${path}`, response.ok && markers.some((marker) => text.includes(marker)), `${response.status} ${path}`);
}

await checkPage("/", "MiniProgram Radar");
await checkPage("/", "快速搜索");
await checkPage("/radar", "Radar");
await checkPage("/radar", "适用场景");
await checkPage("/radar", "替代方案");
await checkPage("/compare", "选型结论");
await checkPage("/compare", "证据来源");
await checkPage("/advisor", "Advisor");
await checkPage("/doctor", "Doctor");
await checkPage("/weekly", "Weekly");
await checkPageAny("/admin", ["Admin 需要授权", "运维控制台"]);

const health = await getJson<{ ok: boolean; resources: { count: number } }>("/api/health");
record("api:/api/health", health.response.ok && health.payload.ok && health.payload.resources.count > 0, `${health.response.status}, resources=${health.payload.resources.count}`);

const resources = await getJson<{ total: number; resources: unknown[] }>("/api/resources?type=framework&useCase=工具");
record("api:/api/resources", resources.response.ok && resources.payload.total > 0, `${resources.response.status}, total=${resources.payload.total}`);

const compare = await getJson<{ matrix: unknown[]; insights: Array<{ recommendation?: string; validationChecklist?: unknown[]; evidence?: unknown[] }> }>("/api/compare");
record(
  "api:/api/compare",
  compare.response.ok &&
    compare.payload.matrix.length > 0 &&
    compare.payload.insights.some((item) => item.recommendation && (item.validationChecklist?.length ?? 0) > 0 && (item.evidence?.length ?? 0) > 0),
  `${compare.response.status}, matrix=${compare.payload.matrix.length}, insights=${compare.payload.insights.length}`
);

const exportJson = await getJson<{ total: number; filters?: { useCase?: string | null }; resources: unknown[] }>("/api/export/resources?format=json&type=framework&useCase=工具");
record(
  "api:/api/export/resources.json",
  exportJson.response.ok && exportJson.payload.total > 0 && exportJson.payload.filters?.useCase === "工具",
  `${exportJson.response.status}, total=${exportJson.payload.total}, useCase=${exportJson.payload.filters?.useCase ?? "none"}`
);

const exportCsvResponse = await fetch(`${baseUrl}/api/export/resources?format=csv&type=framework`);
const exportCsv = await exportCsvResponse.text();
record(
  "api:/api/export/resources.csv",
  exportCsvResponse.ok && (exportCsvResponse.headers.get("content-type") ?? "").includes("text/csv") && exportCsv.startsWith("id,title,url"),
  `${exportCsvResponse.status}, ${exportCsvResponse.headers.get("content-type") ?? "unknown"}`
);

const resourceDetail = await getJson<{
  aiSummary?: { evidenceRefs?: unknown[] };
  scoreTrace?: { reasons?: unknown[]; evidenceRefs?: unknown[]; source?: string };
  updateTimeline?: unknown[];
}>("/api/resources/github-com-tencentwepy");
record(
  "api:/api/resources/[id]",
  resourceDetail.response.ok &&
    (resourceDetail.payload.aiSummary?.evidenceRefs?.length ?? 0) > 0 &&
    (resourceDetail.payload.scoreTrace?.reasons?.length ?? 0) > 0 &&
    (resourceDetail.payload.scoreTrace?.evidenceRefs?.length ?? 0) > 0 &&
    (resourceDetail.payload.updateTimeline?.length ?? 0) > 0,
  `${resourceDetail.response.status}, trace=${resourceDetail.payload.scoreTrace?.source ?? "none"}, aiEvidence=${resourceDetail.payload.aiSummary?.evidenceRefs?.length ?? 0}, scoreEvidence=${resourceDetail.payload.scoreTrace?.evidenceRefs?.length ?? 0}, timeline=${resourceDetail.payload.updateTimeline?.length ?? 0}`
);

const adminReadinessResponse = await fetch(`${baseUrl}/api/admin/readiness`);
const adminReadiness = (await adminReadinessResponse.json().catch(() => null)) as {
  summary?: { total?: number };
  readiness?: unknown[];
  health?: { resources?: { count?: number } };
} | null;
record(
  "api:/api/admin/readiness",
  adminReadinessResponse.status === 401 ||
    (adminReadinessResponse.ok &&
      (adminReadiness?.summary?.total ?? 0) > 0 &&
      (adminReadiness?.readiness?.length ?? 0) === adminReadiness?.summary?.total &&
      (adminReadiness?.health?.resources?.count ?? 0) > 0),
  `${adminReadinessResponse.status}, total=${adminReadiness?.summary?.total ?? 0}, resources=${adminReadiness?.health?.resources?.count ?? 0}`
);

const aiSummaries = await getJson<{ total: number; summaries: unknown[] }>("/api/ai-summaries?limit=3");
record("api:/api/ai-summaries", aiSummaries.response.ok && aiSummaries.payload.total > 0 && aiSummaries.payload.summaries.length === 3, `${aiSummaries.response.status}, total=${aiSummaries.payload.total}`);

const weekly = await getJson<{ id: string; highlights: unknown[]; signalDigest?: { signals?: unknown[] } }>("/api/weekly");
record(
  "api:/api/weekly",
  weekly.response.ok && Boolean(weekly.payload.id) && (weekly.payload.signalDigest?.signals?.length ?? 0) > 0,
  `${weekly.response.status}, id=${weekly.payload.id}, signals=${weekly.payload.signalDigest?.signals?.length ?? 0}`
);

const weeklyList = await getJson<{ reports: Array<{ id: string }> }>("/api/weekly?list=1");
record("api:/api/weekly?list=1", weeklyList.response.ok && weeklyList.payload.reports.length > 0, `${weeklyList.response.status}, reports=${weeklyList.payload.reports.length}`);

const advisorResponse = await fetch(`${baseUrl}/api/advisor`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    question: "React 团队做电商小程序，后续可能上 H5，应该选 Taro 还是原生？"
  })
});
const advisor = (await advisorResponse.json()) as { recommendation?: string; evidence?: unknown[] };
record("api:/api/advisor", advisorResponse.ok && Boolean(advisor.recommendation) && (advisor.evidence?.length ?? 0) > 0, `${advisorResponse.status}, evidence=${advisor.evidence?.length ?? 0}`);

const doctorResponse = await fetch(`${baseUrl}/api/doctor`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    packageJson: JSON.stringify({
      dependencies: {
        wepy: "^2.0.0"
      },
      scripts: {
        build: "wepy build"
      }
    }),
    projectConfigJson: JSON.stringify({
      appid: "touristappid"
    })
  })
});
const doctor = (await doctorResponse.json()) as {
  report?: {
    projectType: string;
    findings: unknown[];
    summary?: {
      conclusion?: string;
      nextActions?: unknown[];
    };
  };
  blobUrl?: string | null;
};
record(
  "api:/api/doctor",
  doctorResponse.ok &&
    doctor.report?.projectType === "WePY" &&
    doctor.report.findings.length > 0 &&
    /P0|迁移|高风险/.test(doctor.report.summary?.conclusion ?? "") &&
    (doctor.report.summary?.nextActions?.length ?? 0) > 0 &&
    "blobUrl" in doctor,
  `${doctorResponse.status}, type=${doctor.report?.projectType ?? "none"}, actions=${doctor.report?.summary?.nextActions?.length ?? 0}, blob=${doctor.blobUrl ?? "none"}`
);

const rssResponse = await fetch(`${baseUrl}/weekly.xml`);
const rssText = await rssResponse.text();
record("rss:/weekly.xml", rssResponse.ok && rssResponse.headers.get("content-type")?.includes("application/rss+xml") === true && rssText.includes("<rss"), `${rssResponse.status}, ${rssResponse.headers.get("content-type") ?? "unknown"}`);

const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`);
const sitemapText = await sitemapResponse.text();
record("seo:/sitemap.xml", sitemapResponse.ok && sitemapText.includes("/radar") && sitemapText.includes("/resources/github-com-nervjstaro"), `${sitemapResponse.status}, entries=${(sitemapText.match(/<url>/g) ?? []).length}`);

const robotsResponse = await fetch(`${baseUrl}/robots.txt`);
const robotsText = await robotsResponse.text();
record("seo:/robots.txt", robotsResponse.ok && robotsText.includes("Sitemap:") && robotsText.includes("Disallow: /api/cron"), `${robotsResponse.status}, ${robotsResponse.headers.get("content-type") ?? "unknown"}`);

const summary = {
  pass: results.filter((result) => result.ok).length,
  fail: results.filter((result) => !result.ok).length
};

console.log(JSON.stringify({ baseUrl, summary, results }, null, 2));

if (summary.fail > 0) {
  process.exitCode = 1;
}
