import assert from "node:assert/strict";
import { GET } from "@/app/api/resources/route";

interface ResourcesResponse {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  resources: Array<{ id: string; radar: { type: string; useCases: string[] } }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

async function request(path: string) {
  const response = await GET(new Request(`https://example.com${path}`));
  assert.equal(response.status, 200);
  return (await response.json()) as ResourcesResponse;
}

const firstPage = await request("/api/resources?type=framework&page=1&pageSize=5");
assert.equal(firstPage.page, 1);
assert.equal(firstPage.pageSize, 5);
assert.equal(firstPage.resources.length, 5);
assert.ok(firstPage.total > firstPage.resources.length);
assert.ok(firstPage.totalPages > 1);
assert.equal(firstPage.pagination.hasNextPage, true);
assert.equal(firstPage.pagination.hasPreviousPage, false);
assert.ok(firstPage.resources.every((resource) => resource.radar.type === "framework"));

const secondPage = await request("/api/resources?type=framework&page=2&pageSize=5");
assert.equal(secondPage.page, 2);
assert.equal(secondPage.resources.length, 5);
assert.notEqual(secondPage.resources[0]?.id, firstPage.resources[0]?.id);
assert.equal(secondPage.pagination.hasPreviousPage, true);

const limited = await request("/api/resources?risk=high&limit=3");
assert.equal(limited.pageSize, 3);
assert.ok(limited.resources.length <= 3);

const clamped = await request("/api/resources?pageSize=500");
assert.equal(clamped.pageSize, 100);

const searched = await request("/api/resources?q=taro&limit=5");
assert.ok(searched.total > 0);
assert.ok(
  searched.resources.every((resource) => JSON.stringify(resource).toLowerCase().includes("taro")),
  "query search should only return matching resources"
);

const useCaseFiltered = await request("/api/resources?useCase=工具&limit=10");
assert.ok(useCaseFiltered.total > 0, "useCase filter should return matching resources");
assert.ok(
  useCaseFiltered.resources.every((resource) => resource.radar.useCases.includes("工具")),
  "useCase filter should only return resources with the requested use case"
);

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      cases: 6,
      assertions: ["page metadata", "second page", "limit alias", "page size cap", "query search", "useCase filter"]
    },
    null,
    2
  )
);
