import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

type VerificationOutput = {
  summary?: {
    pass?: number;
    warn?: number;
    fail?: number;
  };
  results?: Array<{
    name: string;
    status: "pass" | "warn" | "fail";
    detail: string;
  }>;
};

const pageMarkers: Record<string, string> = {
  "/": "MiniProgram Radar",
  "/radar": "Radar",
  "/compare": "Compare",
  "/advisor": "Advisor",
  "/doctor": "Doctor",
  "/weekly": "Weekly",
  "/admin": "Admin 需要授权"
};

let canonicalOriginOverride: string | null = null;

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendText(response: ServerResponse, status: number, body: string, contentType = "text/html; charset=utf-8") {
  response.writeHead(status, { "content-type": contentType });
  response.end(body);
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const origin = `http://${request.headers.host}`;
  const canonicalOrigin = canonicalOriginOverride ?? origin;

  if (request.method === "GET" && pageMarkers[url.pathname]) {
    sendText(response, 200, `<html><body>${pageMarkers[url.pathname]}</body></html>`);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      resources: { count: 236 },
      snapshots: {
        aiSummaries: {
          present: true,
          generatedAt: "2026-07-06T00:00:00.000Z",
          count: 236,
          mode: "rules"
        },
        radarScores: {
          present: true,
          generatedAt: "2026-07-06T00:00:00.000Z",
          count: 236
        },
        weekly: {
          present: true,
          latestId: "2026-07-06",
          generatedAt: "2026-07-06T00:00:00.000Z",
          historyCount: 1
        }
      },
      database: { configured: false, connected: false, error: null },
      integrations: {
        ai: {
          configured: false,
          apiKeyConfigured: false,
          apiUrl: "https://api.openai.com/v1",
          provider: "openai"
        },
        openai: false,
        github: false,
        cronSecret: false,
        adminToken: false,
        blob: false,
        upstashRedis: false,
        siteUrl: false
      }
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/resources") {
    sendJson(response, 200, {
      total: 2,
      resources: [{ id: "taro" }, { id: "uni-app" }]
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/resources/github-com-nervjstaro") {
    sendJson(response, 200, {
      id: "github-com-nervjstaro",
      aiSummary: {
        evidenceRefs: [{ label: "GitHub", url: "https://github.com/NervJS/taro" }]
      },
      scoreTrace: {
        reasons: ["GitHub star 和生态信号较强。"],
        evidenceRefs: [{ label: "GitHub", url: "https://github.com/NervJS/taro" }]
      },
      alternativeResources: [{ id: "uni-app" }],
      updateTimeline: [{ id: "score", title: "评分更新" }]
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/compare") {
    sendJson(response, 200, {
      matrix: [{ id: "taro" }, { id: "uni-app" }],
      insights: [
        {
          recommendation: "Taro 适合作为新项目优先评估方案。",
          validationChecklist: ["验证构建链路和复杂页面性能。"],
          evidence: [{ url: "https://example.com/taro" }]
        }
      ]
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/export/resources" && url.searchParams.get("upload") === "1") {
    sendJson(response, 401, { error: "Unauthorized" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/export/resources" && url.searchParams.get("format") === "json") {
    sendJson(response, 200, {
      total: 2,
      resources: [{ id: "taro" }, { id: "uni-app" }]
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/export/resources" && url.searchParams.get("format") === "csv") {
    sendText(response, 200, "id,title,url\n\"taro\",\"Taro\",\"https://example.com/taro\"\n", "text/csv; charset=utf-8");
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/weekly") {
    sendJson(response, 200, {
      id: "2026-07-06",
      signalDigest: {
        signals: [{ id: "taro" }]
      }
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/ai-summaries") {
    sendJson(response, 200, {
      total: 2,
      summaries: [{ resourceId: "taro" }, { resourceId: "uni-app" }]
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/weekly.xml") {
    sendText(response, 200, "<?xml version=\"1.0\"?><rss></rss>", "application/rss+xml; charset=utf-8");
    return;
  }

  if (request.method === "GET" && url.pathname === "/sitemap.xml") {
    sendText(
      response,
      200,
      `<?xml version="1.0"?><urlset><url><loc>${canonicalOrigin}/radar</loc></url><url><loc>${canonicalOrigin}/resources/github-com-nervjstaro</loc></url></urlset>`,
      "application/xml; charset=utf-8"
    );
    return;
  }

  if (request.method === "GET" && url.pathname === "/robots.txt") {
    sendText(response, 200, `User-Agent: *\nAllow: /\nDisallow: /api/cron\nSitemap: ${canonicalOrigin}/sitemap.xml\n`, "text/plain; charset=utf-8");
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/advisor") {
    const body = await readBody(request);
    sendJson(response, body ? 200 : 400, {
      recommendation: "优先评估 Taro。",
      evidence: [{ id: "taro" }]
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/doctor") {
    sendJson(response, 200, {
      report: {
        projectType: "WePY",
        findings: [{ id: "wepy-risk" }],
        summary: {
          conclusion: "发现 P0 高风险依赖，建议优先评估迁移路线。",
          nextActions: ["先处理 P0 风险。", "对照推荐资源验证迁移路线。"]
        }
      },
      blobUrl: null
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/cron/weekly" && request.headers.authorization === "Bearer verify-cron-secret" && url.searchParams.get("dryRun") === "1") {
    sendJson(response, 200, {
      ok: true,
      mode: "dry-run",
      weekly: {
        id: "2026-07-06",
        stats: {
          total: 236
        }
      }
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/cron/enrich" && request.headers.authorization === "Bearer verify-cron-secret" && url.searchParams.get("dryRun") === "1") {
    sendJson(response, 200, {
      ok: true,
      mode: "dry-run",
      result: {
        attempted: 1,
        collected: 1,
        failed: 0,
        persisted: false
      }
    });
    return;
  }

  if (request.method === "GET" && (url.pathname === "/api/cron/enrich" || url.pathname === "/api/cron/weekly")) {
    sendJson(response, 401, { error: "Unauthorized" });
    return;
  }

  if (request.method === "PATCH" && url.pathname === "/api/admin/resources/__deployment_verify__") {
    sendJson(response, 401, { error: "Unauthorized" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/readiness" && request.headers.authorization === "Bearer verify-admin-token") {
    sendJson(response, 200, {
      ok: true,
      checkedAt: "2026-07-06T00:00:00.000Z",
      summary: {
        ready: 3,
        missing: 5,
        optional: 1,
        total: 9
      },
      readiness: [
        { id: "site-url", status: "missing", action: "配置 SITE_URL。" },
        { id: "database", status: "missing", action: "配置 DATABASE_URL。" },
        { id: "admin-token", status: "ready", action: "保留 ADMIN_TOKEN。" },
        { id: "cron-secret", status: "missing", action: "配置 CRON_SECRET。" },
        { id: "github-token", status: "missing", action: "配置 GITHUB_TOKEN。" },
        { id: "redis", status: "missing", action: "配置 Upstash Redis。" },
        { id: "blob", status: "missing", action: "配置 Vercel Blob。" },
        { id: "snapshots", status: "ready", action: "定期刷新快照。" },
        { id: "openai", status: "optional", action: "确认后再配置 OPENAI_API_KEY。" }
      ],
      health: {
        resources: { count: 236 }
      }
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/readiness") {
    sendJson(response, 401, { error: "Unauthorized" });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

function parseVerifierOutput(stdout: string): VerificationOutput {
  const start = stdout.indexOf("{");
  assert.notEqual(start, -1, `verifier should print JSON output, got: ${stdout}`);
  return JSON.parse(stdout.slice(start)) as VerificationOutput;
}

async function runVerifier(baseUrl: string, extraEnv: Record<string, string | undefined> = {}) {
  return await new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/verify-deployment.ts", baseUrl], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...extraEnv
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("deployment verifier test timed out"));
    }, 30_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (status) => {
      clearTimeout(timeout);
      resolve({ status, stdout, stderr });
    });
  });
}

try {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object", "mock server should listen on a TCP port");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const baseline = await runVerifier(baseUrl);
  assert.equal(baseline.status, 0, baseline.stderr);
  const baselineOutput = parseVerifierOutput(baseline.stdout);
  assert.equal(baselineOutput.summary?.fail, 0);
  assert.equal(baselineOutput.summary?.warn, 8);
  assert.ok((baselineOutput.summary?.pass ?? 0) > 0);
  assert.equal(baselineOutput.results?.find((result) => result.name === "integration:site_url")?.status, "warn");
  assert.equal(baselineOutput.results?.find((result) => result.name === "guard:/api/cron/enrich")?.status, "pass");
  assert.equal(baselineOutput.results?.find((result) => result.name === "guard:/api/admin/readiness")?.status, "pass");
  assert.equal(baselineOutput.results?.find((result) => result.name === "guard:/api/export/resources?upload=1")?.status, "pass");
  assert.equal(baselineOutput.results?.find((result) => result.name === "health:snapshots")?.status, "pass");
  assert.equal(baselineOutput.results?.find((result) => result.name === "api:/api/ai-summaries")?.status, "pass");
  assert.equal(baselineOutput.results?.find((result) => result.name === "api:/api/doctor")?.status, "pass");
  assert.equal(baselineOutput.results?.find((result) => result.name === "api:/api/compare")?.status, "pass");
  assert.equal(baselineOutput.results?.find((result) => result.name === "api:/api/resources/[id]")?.status, "pass");
  assert.equal(baselineOutput.results?.find((result) => result.name === "api:/api/export/resources.json")?.status, "pass");
  assert.equal(baselineOutput.results?.find((result) => result.name === "api:/api/export/resources.csv")?.status, "pass");
  assert.equal(baselineOutput.results?.find((result) => result.name === "seo:/sitemap.xml")?.status, "pass");
  assert.equal(baselineOutput.results?.find((result) => result.name === "seo:/robots.txt")?.status, "pass");

  canonicalOriginOverride = "https://canonical.example.com";
  const detectedCanonical = await runVerifier(baseUrl);
  canonicalOriginOverride = null;
  assert.equal(detectedCanonical.status, 0, detectedCanonical.stderr);
  const detectedCanonicalOutput = parseVerifierOutput(detectedCanonical.stdout);
  assert.equal(detectedCanonicalOutput.summary?.fail, 0);
  assert.equal(detectedCanonicalOutput.results?.find((result) => result.name === "seo:/sitemap.xml")?.status, "pass");
  assert.equal(detectedCanonicalOutput.results?.find((result) => result.name === "seo:/robots.txt")?.status, "pass");

  const strictCanonical = await runVerifier(baseUrl, { EXPECTED_CANONICAL_URL: "https://canonical.example.com" });
  assert.equal(strictCanonical.status, 1, "strict canonical expectation should fail when sitemap and robots use the service origin");
  const strictCanonicalOutput = parseVerifierOutput(strictCanonical.stdout);
  assert.equal(strictCanonicalOutput.summary?.fail, 2);
  assert.equal(strictCanonicalOutput.results?.find((result) => result.name === "seo:/sitemap.xml")?.status, "fail");
  assert.equal(strictCanonicalOutput.results?.find((result) => result.name === "seo:/robots.txt")?.status, "fail");

  const strictDatabase = await runVerifier(baseUrl, { EXPECT_DATABASE: "1" });
  assert.equal(strictDatabase.status, 1, "strict database expectation should fail when health reports no database");
  const strictOutput = parseVerifierOutput(strictDatabase.stdout);
  assert.equal(strictOutput.summary?.fail, 1);
  assert.equal(strictOutput.results?.find((result) => result.name === "integration:database")?.status, "fail");

  const strictSiteUrl = await runVerifier(baseUrl, { EXPECT_SITE_URL: "1" });
  assert.equal(strictSiteUrl.status, 1, "strict site URL expectation should fail when health reports no SITE_URL");
  const strictSiteUrlOutput = parseVerifierOutput(strictSiteUrl.stdout);
  assert.equal(strictSiteUrlOutput.summary?.fail, 1);
  assert.equal(strictSiteUrlOutput.results?.find((result) => result.name === "integration:site_url")?.status, "fail");

  const cronDryRun = await runVerifier(baseUrl, { VERIFY_CRON_SECRET: "verify-cron-secret" });
  assert.equal(cronDryRun.status, 0, cronDryRun.stderr);
  const cronDryRunOutput = parseVerifierOutput(cronDryRun.stdout);
  assert.equal(cronDryRunOutput.summary?.fail, 0);
  assert.equal(cronDryRunOutput.results?.find((result) => result.name === "cron-dry-run:/api/cron/enrich")?.status, "pass");
  assert.equal(cronDryRunOutput.results?.find((result) => result.name === "cron-dry-run:/api/cron/weekly")?.status, "pass");

  const adminReadiness = await runVerifier(baseUrl, { VERIFY_ADMIN_TOKEN: "verify-admin-token" });
  assert.equal(adminReadiness.status, 0, adminReadiness.stderr);
  const adminReadinessOutput = parseVerifierOutput(adminReadiness.stdout);
  assert.equal(adminReadinessOutput.summary?.fail, 0);
  assert.equal(adminReadinessOutput.results?.find((result) => result.name === "admin-readiness:/api/admin/readiness")?.status, "pass");

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        cases: 7,
        assertions: [
          "deployment verifier baseline",
          "detected canonical URL fallback",
          "strict canonical URL expectation",
          "ai summaries probe",
          "compare insights probe",
          "resource detail evidence probe",
          "snapshot health probe",
          "resource export probes",
          "seo probes",
          "resource export snapshot guard",
          "admin readiness guard",
          "doctor summary probe",
          "strict database expectation",
          "strict site URL expectation",
          "authorized enrich cron dry-run",
          "authorized weekly cron dry-run",
          "authorized admin readiness"
        ]
      },
      null,
      2
    )
  );
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
