import assert from "node:assert/strict";
import { findAlternativeResources, getResources } from "@/lib/resources";

const resources = await getResources();

function byId(id: string) {
  const resource = resources.find((item) => item.id === id);
  assert.ok(resource, `${id} should exist`);
  return resource;
}

const wepy = byId("github-com-tencentwepy");
const wepyAlternatives = findAlternativeResources(resources, wepy);
assert.ok(wepyAlternatives.length >= 2, "WePY should expose concrete migration alternatives");
assert.ok(wepyAlternatives.some((item) => item.title.toLowerCase().includes("taro")), "WePY alternatives should include Taro");
assert.ok(wepyAlternatives.some((item) => item.title.toLowerCase().includes("uni-app")), "WePY alternatives should include uni-app");
assert.equal(wepyAlternatives.some((item) => item.id === wepy.id), false, "alternatives should not include the current resource");

const taro = byId("github-com-nervjstaro");
const taroAlternatives = findAlternativeResources(resources, taro);
assert.ok(taroAlternatives.some((item) => item.title.toLowerCase().includes("uni-app") || item.title.toLowerCase().includes("mpx")), "Taro should link to peer framework alternatives");

const persistedAlternative = findAlternativeResources(resources, {
  ...wepy,
  radar: {
    ...wepy.radar,
    alternatives: ["Persisted migration target"],
    alternativeResourceIds: [taro.id]
  }
});
assert.equal(persistedAlternative[0]?.id, taro.id, "persisted alternative target ids should be used before keyword matching");
assert.equal(persistedAlternative[0]?.label, "Persisted migration target", "persisted alternative labels should be preserved");

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      cases: 3,
      assertions: ["wepy migration links", "taro peer alternatives", "persisted target ids"]
    },
    null,
    2
  )
);
