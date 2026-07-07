import assert from "node:assert/strict";
import { GET } from "@/app/api/resources/[id]/route";

interface ResourceDetailResponse {
  id?: string;
  title?: string;
  aiSummary?: {
    summary?: string;
    useCases?: unknown[];
    notRecommendedFor?: unknown[];
    evidenceRefs?: unknown[];
  } | null;
  scoreTrace?: {
    source?: string;
    reasons?: unknown[];
    evidenceRefs?: unknown[];
  } | null;
  alternativeResources?: Array<{
    id: string;
    title: string;
  }>;
  updateTimeline?: Array<{
    id: string;
    title: string;
    occurredAt: string | null;
    source: string;
  }>;
  error?: string;
}

async function requestResource(id: string) {
  return GET(new Request(`https://example.com/api/resources/${id}`), {
    params: Promise.resolve({ id })
  });
}

const originalDatabaseUrl = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;

try {
  const response = await requestResource("github-com-tencentwepy");
  assert.equal(response.status, 200);

  const detail = (await response.json()) as ResourceDetailResponse;
  assert.equal(detail.id, "github-com-tencentwepy");
  assert.ok(detail.title, "resource detail should include the resource title");
  assert.ok(detail.aiSummary?.summary, "resource detail should include an AI or rule summary");
  assert.ok((detail.aiSummary?.useCases?.length ?? 0) > 0, "AI summary should include use cases");
  assert.ok((detail.aiSummary?.notRecommendedFor?.length ?? 0) > 0, "AI summary should include not recommended conditions for high-risk resources");
  assert.ok((detail.aiSummary?.evidenceRefs?.length ?? 0) > 0, "AI summary should keep evidence references");
  assert.ok(detail.scoreTrace, "resource detail should include score trace");
  assert.equal(detail.scoreTrace?.source, "snapshot");
  assert.ok((detail.scoreTrace?.reasons?.length ?? 0) > 0, "score trace should include reasons");
  assert.ok((detail.scoreTrace?.evidenceRefs?.length ?? 0) > 0, "score trace should include structured evidence references");
  assert.ok((detail.alternativeResources?.length ?? 0) >= 2, "resource detail should include concrete alternatives");
  assert.ok((detail.updateTimeline?.length ?? 0) >= 4, "resource detail should include an update timeline");
  assert.ok(detail.updateTimeline?.some((item) => item.source === "resource"), "update timeline should include the resource snapshot");
  assert.ok(detail.updateTimeline?.some((item) => item.source === "ai-summary"), "update timeline should include the AI summary update");
  assert.ok(detail.updateTimeline?.some((item) => item.source === "score"), "update timeline should include the score update");
  assert.ok(detail.updateTimeline?.some((item) => item.source === "alternatives"), "update timeline should include alternatives matching");
  assert.ok(
    detail.alternativeResources?.some((item) => item.title.toLowerCase().includes("taro")),
    "WePY detail alternatives should include Taro"
  );
  assert.ok(
    detail.alternativeResources?.some((item) => item.title.toLowerCase().includes("uni-app")),
    "WePY detail alternatives should include uni-app"
  );
  assert.equal(detail.alternativeResources?.some((item) => item.id === detail.id), false, "alternatives should not include the current resource");

  const missingResponse = await requestResource("missing-resource");
  assert.equal(missingResponse.status, 404);
  const missing = (await missingResponse.json()) as ResourceDetailResponse;
  assert.equal(missing.error, "Resource not found");

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        cases: 2,
        assertions: ["detail route", "ai summary", "ai summary use cases", "score trace", "score evidence refs", "alternatives", "update timeline", "not found"]
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
