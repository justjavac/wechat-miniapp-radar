import assert from "node:assert/strict";
import { mapResourceToDbInsert, mapResourcesToAlternativeDbInserts, mapResourceToDbUpdate } from "@/lib/resource-db-mapping";
import { getResources } from "@/lib/resources";

const resources = await getResources();
assert.ok(resources.length > 0, "resources should be available for database import mapping");

const rows = resources.map(mapResourceToDbInsert);
assert.equal(rows.length, resources.length);
assert.equal(new Set(rows.map((row) => row.id)).size, rows.length, "database insert ids should be unique");

function hasLanguageMetadata(value: unknown): value is { language: unknown[] } {
  return typeof value === "object" && value !== null && Array.isArray((value as { language?: unknown }).language);
}

for (const row of rows) {
  assert.ok(row.id, "id is required");
  assert.ok(row.title, `${row.id}: title is required`);
  assert.ok(row.url.startsWith("http://") || row.url.startsWith("https://"), `${row.id}: url must be http(s)`);
  assert.ok(row.categoryId, `${row.id}: categoryId is required`);
  assert.ok(row.categoryName, `${row.id}: categoryName is required`);
  assert.ok(row.resourceType, `${row.id}: resourceType is required`);
  assert.ok(row.status, `${row.id}: status is required`);
  assert.ok(row.maintainStatus, `${row.id}: maintainStatus is required`);
  assert.ok(row.riskLevel, `${row.id}: riskLevel is required`);
  assert.ok(row.summary, `${row.id}: summary is required`);
  assert.ok(hasLanguageMetadata(row.metadata), `${row.id}: metadata.language is required`);
}

const update = mapResourceToDbUpdate(resources[0]);
assert.ok(update.updatedAt instanceof Date, "database update payload should refresh updatedAt");

const alternativeRows = mapResourcesToAlternativeDbInserts(resources);
const resourceIds = new Set(rows.map((row) => row.id));
assert.ok(alternativeRows.length > 0, "database import should generate alternative links");
assert.equal(new Set(alternativeRows.map((row) => row.id)).size, alternativeRows.length, "alternative link ids should be unique");

for (const row of alternativeRows) {
  assert.ok(resourceIds.has(row.sourceResourceId), `${row.id}: source resource should exist`);
  assert.ok(resourceIds.has(row.targetResourceId), `${row.id}: target resource should exist`);
  assert.notEqual(row.sourceResourceId, row.targetResourceId, `${row.id}: alternative link should not point to itself`);
  assert.ok(row.label, `${row.id}: label is required`);
  assert.ok(Number.isInteger(row.rank) && row.rank >= 0, `${row.id}: rank should be a non-negative integer`);
}

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      resources: rows.length,
      alternativeLinks: alternativeRows.length,
      assertions: ["insert mapping", "unique ids", "required fields", "update timestamp", "alternative links"]
    },
    null,
    2
  )
);
