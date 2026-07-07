import assert from "node:assert/strict";
import { GET } from "@/app/api/export/resources/route";

interface ExportJsonResponse {
  uploadRequested?: boolean;
  blobUrl?: string | null;
  total: number;
  filters: {
    q: string | null;
    category: string | null;
    status: string | null;
    risk: string | null;
    type: string | null;
    useCase: string | null;
  };
  resources: Array<{
    id: string;
    title: string;
    url: string;
    type: string;
    status: string;
    riskLevel: string;
    summary: string;
    useCases: string[];
    evidenceUrls: string[];
  }>;
}

async function request(path: string, init?: RequestInit) {
  return await GET(new Request(`https://example.com${path}`, init));
}

const jsonResponse = await request("/api/export/resources?format=json&type=framework&status=adopt&useCase=工具");
assert.equal(jsonResponse.status, 200);
assert.match(jsonResponse.headers.get("content-disposition") ?? "", /miniprogram-radar-resources\.json/);
const jsonPayload = (await jsonResponse.json()) as ExportJsonResponse;
assert.equal(jsonPayload.filters.type, "framework");
assert.equal(jsonPayload.filters.status, "adopt");
assert.equal(jsonPayload.filters.useCase, "工具");
assert.ok(jsonPayload.total > 0, "JSON export should include filtered resources");
assert.ok(jsonPayload.resources.every((resource) => resource.type === "framework"), "JSON export should honor type filter");
assert.ok(jsonPayload.resources.every((resource) => resource.status === "adopt"), "JSON export should honor status filter");
assert.ok(jsonPayload.resources.every((resource) => resource.useCases.includes("工具")), "JSON export should honor useCase filter");
assert.ok(jsonPayload.resources.every((resource) => resource.id && resource.title && resource.url && resource.summary), "JSON export rows should include core fields");

const originalEnv = {
  ADMIN_TOKEN: process.env.ADMIN_TOKEN,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  NODE_ENV: process.env.NODE_ENV
};

function setEnv(name: keyof typeof originalEnv, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name as string];
  } else {
    process.env[name as string] = value;
  }
}

setEnv("NODE_ENV", "production");
setEnv("ADMIN_TOKEN", "admin-secret");
setEnv("BLOB_READ_WRITE_TOKEN", undefined);
try {
  const unauthorizedSnapshot = await request("/api/export/resources?format=json&type=framework&upload=1");
  assert.equal(unauthorizedSnapshot.status, 401, "JSON Blob snapshot should require admin authorization");

  const snapshotResponse = await request("/api/export/resources?format=json&type=framework&upload=1", {
    headers: {
      "x-admin-token": "admin-secret"
    }
  });
  assert.equal(snapshotResponse.status, 200);
  const snapshotPayload = (await snapshotResponse.json()) as ExportJsonResponse;
  assert.equal(snapshotPayload.uploadRequested, true, "JSON export should echo snapshot intent");
  assert.equal(snapshotPayload.blobUrl, null, "JSON export should skip Blob upload without BLOB_READ_WRITE_TOKEN");
  assert.ok(snapshotPayload.total > 0, "JSON snapshot export should still include resources");
} finally {
  setEnv("ADMIN_TOKEN", originalEnv.ADMIN_TOKEN);
  setEnv("BLOB_READ_WRITE_TOKEN", originalEnv.BLOB_READ_WRITE_TOKEN);
  setEnv("NODE_ENV", originalEnv.NODE_ENV);
}

const csvResponse = await request("/api/export/resources?format=csv&q=taro&type=framework");
assert.equal(csvResponse.status, 200);
assert.match(csvResponse.headers.get("content-type") ?? "", /text\/csv/);
assert.match(csvResponse.headers.get("content-disposition") ?? "", /miniprogram-radar-resources\.csv/);
const csv = await csvResponse.text();
const [header, firstRow] = csv.trim().split(/\r?\n/);
assert.equal(header, "id,title,url,category,section,type,status,maintainStatus,riskLevel,summary,useCases,alternatives,evidenceUrls");
assert.match(csv.toLowerCase(), /taro/);
assert.ok(firstRow?.startsWith('"'), "CSV rows should be quoted");

setEnv("NODE_ENV", "production");
setEnv("ADMIN_TOKEN", "admin-secret");
setEnv("BLOB_READ_WRITE_TOKEN", undefined);
try {
  const unauthorizedCsvSnapshot = await request("/api/export/resources?format=csv&q=taro&type=framework&upload=1");
  assert.equal(unauthorizedCsvSnapshot.status, 401, "CSV Blob snapshot should require admin authorization");

  const csvSnapshotResponse = await request("/api/export/resources?format=csv&q=taro&type=framework&upload=1", {
    headers: {
      authorization: "Bearer admin-secret"
    }
  });
  assert.equal(csvSnapshotResponse.status, 200);
  assert.equal(csvSnapshotResponse.headers.get("x-blob-upload-requested"), "true", "CSV export should echo snapshot intent in headers");
  assert.equal(csvSnapshotResponse.headers.get("x-blob-url"), null, "CSV export should skip Blob upload without BLOB_READ_WRITE_TOKEN");
} finally {
  setEnv("ADMIN_TOKEN", originalEnv.ADMIN_TOKEN);
  setEnv("BLOB_READ_WRITE_TOKEN", originalEnv.BLOB_READ_WRITE_TOKEN);
  setEnv("NODE_ENV", originalEnv.NODE_ENV);
}

const invalidResponse = await request("/api/export/resources?format=xlsx");
assert.equal(invalidResponse.status, 400);

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      cases: 7,
      assertions: [
        "filtered JSON export",
        "useCase export filter",
        "JSON Blob snapshot authorization",
        "JSON Blob snapshot fallback",
        "filtered CSV export",
        "CSV Blob snapshot authorization",
        "CSV Blob snapshot fallback",
        "invalid format guard"
      ]
    },
    null,
    2
  )
);
