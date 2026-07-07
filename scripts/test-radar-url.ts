import assert from "node:assert/strict";
import { radarFilterSearch } from "@/lib/radar-url";

const empty = radarFilterSearch({
  query: "",
  category: "all",
  useCase: "all",
  status: "all",
  risk: "all",
  type: "all"
});
assert.equal(empty, "", "empty radar filters should not add a query string");

const filtered = radarFilterSearch({
  query: " Taro ",
  category: "tools",
  useCase: "多端应用",
  status: "adopt",
  risk: "low",
  type: "framework"
});
const params = new URLSearchParams(filtered.slice(1));
assert.equal(params.get("q"), "Taro");
assert.equal(params.get("category"), "tools");
assert.equal(params.get("useCase"), "多端应用");
assert.equal(params.get("status"), "adopt");
assert.equal(params.get("risk"), "low");
assert.equal(params.get("type"), "framework");

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      cases: 2,
      assertions: ["empty filters omit URL query", "active filters produce shareable URL query"]
    },
    null,
    2
  )
);
