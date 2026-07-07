type CheckStatus = "pass" | "warn" | "fail";

export {};

interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

interface HealthPayload {
  ok: boolean;
  resources?: {
    count?: number;
  };
  database?: {
    configured?: boolean;
    connected?: boolean;
    error?: string | null;
  };
  snapshots?: {
    aiSummaries?: {
      present?: boolean;
      generatedAt?: string | null;
      count?: number;
      mode?: string | null;
    };
    radarScores?: {
      present?: boolean;
      generatedAt?: string | null;
      count?: number;
    };
    weekly?: {
      present?: boolean;
      latestId?: string | null;
      generatedAt?: string | null;
      historyCount?: number;
    };
  };
  integrations?: {
    openai?: boolean;
    github?: boolean;
    cronSecret?: boolean;
    adminToken?: boolean;
    blob?: boolean;
    upstashRedis?: boolean;
    siteUrl?: boolean;
  };
}

interface WeeklyPayload {
  id?: string;
  signalDigest?: {
    signals?: unknown[];
  };
}

interface ResourcesPayload {
  total?: number;
  resources?: unknown[];
}

interface ResourceDetailPayload {
  id?: string;
  aiSummary?: {
    evidenceRefs?: unknown[];
  } | null;
  scoreTrace?: {
    reasons?: unknown[];
    evidenceRefs?: unknown[];
  } | null;
  alternativeResources?: unknown[];
  updateTimeline?: unknown[];
}

interface ComparePayload {
  matrix?: unknown[];
  insights?: Array<{
    recommendation?: string;
    validationChecklist?: unknown[];
    evidence?: unknown[];
  }>;
}

interface ExportPayload {
  total?: number;
  resources?: unknown[];
}

interface AiSummariesPayload {
  total?: number;
  summaries?: unknown[];
}

interface DoctorPayload {
  report?: {
    projectType?: string;
    findings?: unknown[];
    summary?: {
      conclusion?: string;
      nextActions?: unknown[];
    };
  };
  blobUrl?: string | null;
}

interface AdminReadinessPayload {
  ok?: boolean;
  summary?: {
    ready?: number;
    missing?: number;
    optional?: number;
    total?: number;
  };
  readiness?: Array<{
    id?: string;
    status?: string;
    action?: string;
  }>;
  health?: {
    resources?: {
      count?: number;
    };
  };
}

const rawBaseUrl = process.argv[2] ?? process.env.DEPLOYMENT_BASE_URL ?? process.env.SMOKE_BASE_URL;

if (!rawBaseUrl) {
  console.error("DEPLOYMENT_BASE_URL or an explicit URL argument is required.");
  console.error("Example: npm run deployment:verify -- https://your-project.vercel.app");
  process.exit(1);
}

const baseUrl = normalizeBaseUrl(rawBaseUrl);
const results: CheckResult[] = [];

function normalizeBaseUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Deployment URL must use http or https.");
  }
  return url.toString().replace(/\/$/, "");
}

function record(name: string, status: CheckStatus, detail: string) {
  results.push({ name, status, detail });
}

function isExpected(name: string) {
  return process.env[`EXPECT_${name}`] === "1";
}

async function fetchWithTimeout(path: string, init?: RequestInit) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(20_000)
  });
}

async function readJson<T>(path: string, init?: RequestInit) {
  const response = await fetchWithTimeout(path, init);
  const payload = (await response.json().catch(() => null)) as T | null;
  return { response, payload };
}

async function checkPage(path: string, markers: string[]) {
  try {
    const response = await fetchWithTimeout(path);
    const text = await response.text();
    const matched = markers.some((marker) => text.includes(marker));
    record(`page:${path}`, response.ok && matched ? "pass" : "fail", `${response.status}, marker=${matched ? "yes" : "no"}`);
  } catch (error) {
    record(`page:${path}`, "fail", error instanceof Error ? error.message : String(error));
  }
}

async function checkHealth() {
  try {
    const { response, payload } = await readJson<HealthPayload>("/api/health");
    const resourceCount = payload?.resources?.count ?? 0;
    record("api:/api/health", response.ok && payload?.ok === true && resourceCount > 0 ? "pass" : "fail", `${response.status}, resources=${resourceCount}`);
    const snapshots = payload?.snapshots;
    const snapshotsReady =
      (snapshots?.aiSummaries?.count ?? 0) > 0 &&
      (snapshots?.radarScores?.count ?? 0) > 0 &&
      (snapshots?.weekly?.historyCount ?? 0) > 0 &&
      Boolean(snapshots?.weekly?.latestId);
    record(
      "health:snapshots",
      snapshotsReady ? "pass" : "fail",
      `ai=${snapshots?.aiSummaries?.count ?? 0}, scores=${snapshots?.radarScores?.count ?? 0}, weekly=${snapshots?.weekly?.historyCount ?? 0}, latest=${snapshots?.weekly?.latestId ?? "none"}`
    );

    const databaseConfigured = payload?.database?.configured === true;
    const databaseConnected = payload?.database?.connected === true;
    if (databaseConfigured) {
      record("integration:database", databaseConnected ? "pass" : "fail", databaseConnected ? "database connected." : payload?.database?.error ?? "database configured but not connected.");
    } else {
      record("integration:database", isExpected("DATABASE") ? "fail" : "warn", "DATABASE_URL is not configured on the deployment.");
    }

    const integrations = payload?.integrations ?? {};
    for (const [name, configured] of [
      ["GITHUB", integrations.github],
      ["CRON_SECRET", integrations.cronSecret],
      ["ADMIN_TOKEN", integrations.adminToken],
      ["BLOB", integrations.blob],
      ["UPSTASH_REDIS", integrations.upstashRedis],
      ["SITE_URL", integrations.siteUrl],
      ["OPENAI", integrations.openai]
    ] as const) {
      record(
        `integration:${name.toLowerCase()}`,
        configured ? "pass" : isExpected(name) ? "fail" : "warn",
        configured ? `${name} is configured.` : `${name} is not configured.`
      );
    }
  } catch (error) {
    record("api:/api/health", "fail", error instanceof Error ? error.message : String(error));
  }
}

async function checkResources() {
  try {
    const { response, payload } = await readJson<ResourcesPayload>("/api/resources?type=framework&useCase=%E5%B7%A5%E5%85%B7&pageSize=5");
    const total = payload?.total ?? 0;
    const count = payload?.resources?.length ?? 0;
    record("api:/api/resources", response.ok && total > 0 && count > 0 ? "pass" : "fail", `${response.status}, total=${total}, count=${count}`);
  } catch (error) {
    record("api:/api/resources", "fail", error instanceof Error ? error.message : String(error));
  }
}

async function checkResourceDetail() {
  try {
    const { response, payload } = await readJson<ResourceDetailPayload>("/api/resources/github-com-nervjstaro");
    const aiEvidenceCount = payload?.aiSummary?.evidenceRefs?.length ?? 0;
    const scoreReasonCount = payload?.scoreTrace?.reasons?.length ?? 0;
    const scoreEvidenceCount = payload?.scoreTrace?.evidenceRefs?.length ?? 0;
    const timelineCount = payload?.updateTimeline?.length ?? 0;
    record(
      "api:/api/resources/[id]",
      response.ok && Boolean(payload?.id) && aiEvidenceCount > 0 && scoreReasonCount > 0 && scoreEvidenceCount > 0 && timelineCount > 0 ? "pass" : "fail",
      `${response.status}, aiEvidence=${aiEvidenceCount}, scoreReasons=${scoreReasonCount}, scoreEvidence=${scoreEvidenceCount}, timeline=${timelineCount}`
    );
  } catch (error) {
    record("api:/api/resources/[id]", "fail", error instanceof Error ? error.message : String(error));
  }
}

async function checkCompare() {
  try {
    const { response, payload } = await readJson<ComparePayload>("/api/compare");
    const matrixCount = payload?.matrix?.length ?? 0;
    const insightCount = payload?.insights?.length ?? 0;
    const hasDecisionInsight =
      payload?.insights?.some((item) => item.recommendation && (item.validationChecklist?.length ?? 0) > 0 && (item.evidence?.length ?? 0) > 0) === true;
    record("api:/api/compare", response.ok && matrixCount > 0 && hasDecisionInsight ? "pass" : "fail", `${response.status}, matrix=${matrixCount}, insights=${insightCount}`);
  } catch (error) {
    record("api:/api/compare", "fail", error instanceof Error ? error.message : String(error));
  }
}

async function checkExports() {
  try {
    const { response, payload } = await readJson<ExportPayload>("/api/export/resources?format=json&type=framework&useCase=%E5%B7%A5%E5%85%B7");
    const total = payload?.total ?? 0;
    const count = payload?.resources?.length ?? 0;
    record("api:/api/export/resources.json", response.ok && total > 0 && count > 0 ? "pass" : "fail", `${response.status}, total=${total}, count=${count}`);
  } catch (error) {
    record("api:/api/export/resources.json", "fail", error instanceof Error ? error.message : String(error));
  }

  try {
    const response = await fetchWithTimeout("/api/export/resources?format=csv&type=framework");
    const text = await response.text();
    const contentType = response.headers.get("content-type") ?? "unknown";
    record("api:/api/export/resources.csv", response.ok && contentType.includes("text/csv") && text.startsWith("id,title,url") ? "pass" : "fail", `${response.status}, ${contentType}`);
  } catch (error) {
    record("api:/api/export/resources.csv", "fail", error instanceof Error ? error.message : String(error));
  }
}

async function checkWeekly() {
  try {
    const { response, payload } = await readJson<WeeklyPayload>("/api/weekly");
    const signalCount = payload?.signalDigest?.signals?.length ?? 0;
    record("api:/api/weekly", response.ok && Boolean(payload?.id) && signalCount > 0 ? "pass" : "fail", `${response.status}, id=${payload?.id ?? "none"}, signals=${signalCount}`);
  } catch (error) {
    record("api:/api/weekly", "fail", error instanceof Error ? error.message : String(error));
  }
}

async function checkAiSummaries() {
  try {
    const { response, payload } = await readJson<AiSummariesPayload>("/api/ai-summaries?limit=3");
    const total = payload?.total ?? 0;
    const count = payload?.summaries?.length ?? 0;
    record("api:/api/ai-summaries", response.ok && total > 0 && count > 0 ? "pass" : "fail", `${response.status}, total=${total}, count=${count}`);
  } catch (error) {
    record("api:/api/ai-summaries", "fail", error instanceof Error ? error.message : String(error));
  }
}

async function checkDoctor() {
  try {
    const { response, payload } = await readJson<DoctorPayload>("/api/doctor", {
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
    const findingCount = payload?.report?.findings?.length ?? 0;
    const nextActionCount = payload?.report?.summary?.nextActions?.length ?? 0;
    const hasRiskSummary = /P0|迁移|高风险/.test(payload?.report?.summary?.conclusion ?? "");
    record(
      "api:/api/doctor",
      response.ok && payload?.report?.projectType === "WePY" && findingCount > 0 && hasRiskSummary && nextActionCount > 0 && payload && "blobUrl" in payload
        ? "pass"
        : "fail",
      `${response.status}, type=${payload?.report?.projectType ?? "none"}, findings=${findingCount}, actions=${nextActionCount}, blob=${payload?.blobUrl ?? "none"}`
    );
  } catch (error) {
    record("api:/api/doctor", "fail", error instanceof Error ? error.message : String(error));
  }
}

async function checkRss() {
  try {
    const response = await fetchWithTimeout("/weekly.xml");
    const text = await response.text();
    const contentType = response.headers.get("content-type") ?? "unknown";
    record("rss:/weekly.xml", response.ok && contentType.includes("application/rss+xml") && text.includes("<rss") ? "pass" : "fail", `${response.status}, ${contentType}`);
  } catch (error) {
    record("rss:/weekly.xml", "fail", error instanceof Error ? error.message : String(error));
  }
}

async function checkSeoFiles() {
  try {
    const response = await fetchWithTimeout("/sitemap.xml");
    const text = await response.text();
    const entryCount = text.match(/<url>/g)?.length ?? 0;
    const hasCanonicalRadar = text.includes(`${baseUrl}/radar`);
    const hasCanonicalResource = text.includes(`${baseUrl}/resources/`);
    record(
      "seo:/sitemap.xml",
      response.ok && hasCanonicalRadar && hasCanonicalResource ? "pass" : "fail",
      `${response.status}, entries=${entryCount}, canonicalRadar=${hasCanonicalRadar ? "yes" : "no"}, canonicalResource=${hasCanonicalResource ? "yes" : "no"}`
    );
  } catch (error) {
    record("seo:/sitemap.xml", "fail", error instanceof Error ? error.message : String(error));
  }

  try {
    const response = await fetchWithTimeout("/robots.txt");
    const text = await response.text();
    const hasCanonicalSitemap = text.includes(`Sitemap: ${baseUrl}/sitemap.xml`);
    record(
      "seo:/robots.txt",
      response.ok && hasCanonicalSitemap && text.includes("Disallow: /api/cron") ? "pass" : "fail",
      `${response.status}, canonicalSitemap=${hasCanonicalSitemap ? "yes" : "no"}`
    );
  } catch (error) {
    record("seo:/robots.txt", "fail", error instanceof Error ? error.message : String(error));
  }
}

async function checkAdvisor() {
  try {
    const { response, payload } = await readJson<{ recommendation?: string; evidence?: unknown[] }>("/api/advisor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "React 团队做电商小程序，后续可能上 H5，应该选 Taro 还是原生？"
      })
    });
    record(
      "api:/api/advisor",
      response.ok && Boolean(payload?.recommendation) && (payload?.evidence?.length ?? 0) > 0 ? "pass" : "fail",
      `${response.status}, evidence=${payload?.evidence?.length ?? 0}`
    );
  } catch (error) {
    record("api:/api/advisor", "fail", error instanceof Error ? error.message : String(error));
  }
}

async function checkUnauthorizedGuards() {
  for (const path of ["/api/cron/enrich", "/api/cron/weekly"]) {
    try {
      const response = await fetchWithTimeout(path);
      record(`guard:${path}`, response.status === 401 ? "pass" : "fail", `${response.status}, expected 401 without credentials`);
    } catch (error) {
      record(`guard:${path}`, "fail", error instanceof Error ? error.message : String(error));
    }
  }

  try {
    const response = await fetchWithTimeout("/api/admin/resources/__deployment_verify__", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "assess" })
    });
    record("guard:/api/admin/resources/[id]", response.status === 401 ? "pass" : "fail", `${response.status}, expected 401 without credentials`);
  } catch (error) {
    record("guard:/api/admin/resources/[id]", "fail", error instanceof Error ? error.message : String(error));
  }

  try {
    const response = await fetchWithTimeout("/api/admin/readiness");
    record("guard:/api/admin/readiness", response.status === 401 ? "pass" : "fail", `${response.status}, expected 401 without credentials`);
  } catch (error) {
    record("guard:/api/admin/readiness", "fail", error instanceof Error ? error.message : String(error));
  }

  try {
    const response = await fetchWithTimeout("/api/export/resources?format=json&upload=1&type=framework");
    record("guard:/api/export/resources?upload=1", response.status === 401 ? "pass" : "fail", `${response.status}, expected 401 without credentials`);
  } catch (error) {
    record("guard:/api/export/resources?upload=1", "fail", error instanceof Error ? error.message : String(error));
  }
}

async function checkAuthorizedCronDryRun() {
  const cronSecret = process.env.VERIFY_CRON_SECRET;
  if (!cronSecret) return;

  try {
    const { response, payload } = await readJson<{ ok?: boolean; mode?: string; result?: { attempted?: number; collected?: number; failed?: number; persisted?: boolean } }>(
      "/api/cron/enrich?dryRun=1&limit=1",
      {
        headers: {
          authorization: `Bearer ${cronSecret}`
        }
      }
    );
    record(
      "cron-dry-run:/api/cron/enrich",
      response.ok && payload?.ok === true && payload.mode === "dry-run" && (payload.result?.attempted ?? 0) > 0 && payload.result?.persisted === false
        ? "pass"
        : "fail",
      `${response.status}, mode=${payload?.mode ?? "unknown"}, attempted=${payload?.result?.attempted ?? 0}, persisted=${String(payload?.result?.persisted)}`
    );
  } catch (error) {
    record("cron-dry-run:/api/cron/enrich", "fail", error instanceof Error ? error.message : String(error));
  }

  try {
    const { response, payload } = await readJson<{ ok?: boolean; mode?: string; weekly?: { id?: string; stats?: { total?: number } } }>(
      "/api/cron/weekly?dryRun=1",
      {
        headers: {
          authorization: `Bearer ${cronSecret}`
        }
      }
    );
    record(
      "cron-dry-run:/api/cron/weekly",
      response.ok && payload?.ok === true && payload.mode === "dry-run" && Boolean(payload.weekly?.id) ? "pass" : "fail",
      `${response.status}, mode=${payload?.mode ?? "unknown"}, total=${payload?.weekly?.stats?.total ?? 0}`
    );
  } catch (error) {
    record("cron-dry-run:/api/cron/weekly", "fail", error instanceof Error ? error.message : String(error));
  }
}

async function checkAuthorizedAdminReadiness() {
  const adminToken = process.env.VERIFY_ADMIN_TOKEN;
  if (!adminToken) return;

  try {
    const { response, payload } = await readJson<AdminReadinessPayload>("/api/admin/readiness", {
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });
    const total = payload?.summary?.total ?? 0;
    const itemCount = payload?.readiness?.length ?? 0;
    const resourceCount = payload?.health?.resources?.count ?? 0;
    const hasActions = payload?.readiness?.every((item) => item.id && item.status && item.action) === true;
    record(
      "admin-readiness:/api/admin/readiness",
      response.ok && payload?.ok === true && total > 0 && itemCount === total && resourceCount > 0 && hasActions ? "pass" : "fail",
      `${response.status}, total=${total}, items=${itemCount}, resources=${resourceCount}, actions=${hasActions ? "yes" : "no"}`
    );
  } catch (error) {
    record("admin-readiness:/api/admin/readiness", "fail", error instanceof Error ? error.message : String(error));
  }
}

await checkPage("/", ["MiniProgram Radar", "小程序雷达"]);
await checkPage("/radar", ["Radar"]);
await checkPage("/compare", ["Compare"]);
await checkPage("/advisor", ["Advisor"]);
await checkPage("/doctor", ["Doctor"]);
await checkPage("/weekly", ["Weekly"]);
await checkPage("/admin", ["Admin 需要授权", "运维控制台"]);
await checkHealth();
await checkResources();
await checkResourceDetail();
await checkCompare();
await checkExports();
await checkAiSummaries();
await checkWeekly();
await checkRss();
await checkSeoFiles();
await checkAdvisor();
await checkDoctor();
await checkUnauthorizedGuards();
await checkAuthorizedCronDryRun();
await checkAuthorizedAdminReadiness();

const summary = {
  pass: results.filter((result) => result.status === "pass").length,
  warn: results.filter((result) => result.status === "warn").length,
  fail: results.filter((result) => result.status === "fail").length
};

console.log(JSON.stringify({ baseUrl, checkedAt: new Date().toISOString(), summary, results }, null, 2));

if (summary.fail > 0) {
  process.exitCode = 1;
}
