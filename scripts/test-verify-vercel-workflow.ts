import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): UnknownRecord {
  assert.ok(isRecord(value), `${label} should be an object`);
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${label} should be a string`);
  }
  return value;
}

function assertIncludes(value: string, expected: string, label: string) {
  assert.ok(value.includes(expected), `${label} should include ${expected}`);
}

const source = await readFile(".github/workflows/verify-vercel.yml", "utf8");
const workflow = requireRecord(parse(source), "workflow");

assert.equal(workflow.name, "Verify Vercel Production");

const triggers = requireRecord(workflow.on, "workflow.on");
const workflowDispatch = requireRecord(triggers.workflow_dispatch, "workflow_dispatch");
const inputs = requireRecord(workflowDispatch.inputs, "workflow_dispatch.inputs");

const expectedInputs = [
  "production_url",
  "expect_vercel_deploy",
  "expect_mvp",
  "expect_database",
  "expect_github",
  "expect_blob",
  "expect_upstash_redis",
  "expect_site_url",
  "expect_openai"
];
for (const inputName of expectedInputs) {
  assert.ok(inputs[inputName], `workflow_dispatch should expose ${inputName}`);
}

const productionUrlInput = requireRecord(inputs.production_url, "production_url input");
assert.equal(productionUrlInput.required, true);
assert.equal(productionUrlInput.type, "string");

for (const inputName of expectedInputs.filter((name) => name !== "production_url")) {
  const input = requireRecord(inputs[inputName], `${inputName} input`);
  assert.equal(input.required, false, `${inputName} should be optional`);
  assert.equal(input.default, false, `${inputName} should default to false`);
  assert.equal(input.type, "boolean", `${inputName} should be a boolean input`);
}

assert.ok(Object.hasOwn(triggers, "deployment_status"), "workflow should react to deployment_status events");

const jobs = requireRecord(workflow.jobs, "jobs");
const verifyJob = requireRecord(jobs.verify, "jobs.verify");
const verifyCondition = requireString(verifyJob.if, "jobs.verify.if");
assertIncludes(verifyCondition, "github.event_name == 'workflow_dispatch'", "verify condition");
assertIncludes(verifyCondition, "github.event.deployment_status.state == 'success'", "verify condition");
assertIncludes(verifyCondition, "github.event.deployment.environment", "verify condition");
assertIncludes(verifyCondition, "Production", "verify condition");
assertIncludes(verifyCondition, "production", "verify condition");

const steps = assertSteps(verifyJob.steps);
assert.ok(steps.some((step) => step.uses === "actions/checkout@v4"), "workflow should check out the repository");

const setupNode = steps.find((step) => step.uses === "actions/setup-node@v4");
assert.ok(setupNode, "workflow should set up Node.js");
const setupNodeWith = requireRecord(setupNode.with, "actions/setup-node.with");
assert.equal(setupNodeWith["node-version"], 20);
assert.equal(setupNodeWith.cache, "npm");

assert.ok(steps.some((step) => step.run === "npm ci"), "workflow should install dependencies with npm ci");

const verifyStep = steps.find((step) => step.name === "Verify production deployment");
assert.ok(verifyStep, "workflow should have a production verification step");
const env = requireRecord(verifyStep.env, "Verify production deployment env");
for (const envName of [
  "INPUT_PRODUCTION_URL",
  "DEPLOYMENT_STATUS_URL",
  "INPUT_EXPECT_VERCEL_DEPLOY",
  "INPUT_EXPECT_MVP",
  "INPUT_EXPECT_DATABASE",
  "INPUT_EXPECT_GITHUB",
  "INPUT_EXPECT_BLOB",
  "INPUT_EXPECT_UPSTASH_REDIS",
  "INPUT_EXPECT_SITE_URL",
  "INPUT_EXPECT_OPENAI",
  "VAR_EXPECT_VERCEL_DEPLOY",
  "VAR_EXPECT_MVP",
  "VAR_EXPECT_DATABASE",
  "VAR_EXPECT_GITHUB",
  "VAR_EXPECT_BLOB",
  "VAR_EXPECT_UPSTASH_REDIS",
  "VAR_EXPECT_SITE_URL",
  "VAR_EXPECT_OPENAI",
  "SITE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "OPENAI_API_KEY",
  "OPENAI_API_URL",
  "VERIFY_CRON_SECRET",
  "VERIFY_ADMIN_TOKEN",
  "GITHUB_TOKEN",
  "BLOB_READ_WRITE_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "VERCEL_TOKEN",
  "VERCEL_PROJECT_ID",
  "VERCEL_ORG_ID"
]) {
  assert.ok(Object.hasOwn(env, envName), `verification env should include ${envName}`);
}

assert.equal(env.GITHUB_TOKEN, "${{ secrets.RADAR_GITHUB_TOKEN || github.token }}");
assert.equal(env.OPENAI_API_KEY, "${{ secrets.OPENAI_API_KEY }}");
assert.equal(env.OPENAI_API_URL, "${{ vars.OPENAI_API_URL }}");
assert.equal(env.VERIFY_CRON_SECRET, "${{ secrets.CRON_SECRET }}");
assert.equal(env.VERIFY_ADMIN_TOKEN, "${{ secrets.ADMIN_TOKEN }}");

const run = requireString(verifyStep.run, "Verify production deployment run");
assertIncludes(run, "set -euo pipefail", "verification script");
assertIncludes(run, 'DEFAULT_PRODUCTION_URL="https://wechat-miniapp-radar.vercel.app"', "verification script");
assertIncludes(run, 'BASE_URL="${INPUT_PRODUCTION_URL:-${SITE_URL:-${NEXT_PUBLIC_SITE_URL:-$DEFAULT_PRODUCTION_URL}}}"', "verification script");
assertIncludes(run, 'BASE_URL="$DEPLOYMENT_STATUS_URL"', "verification script");
assertIncludes(run, "No production URL was provided", "verification script");

for (const expectation of [
  "EXPECT_VERCEL_DEPLOY",
  "EXPECT_MVP",
  "EXPECT_DATABASE",
  "EXPECT_GITHUB",
  "EXPECT_BLOB",
  "EXPECT_UPSTASH_REDIS",
  "EXPECT_SITE_URL",
  "EXPECT_OPENAI"
]) {
  assertIncludes(run, `export ${expectation}=1`, "verification script");
}

const expectedCommands = [
  'npm run vercel:preflight -- "$BASE_URL"',
  'npm run mvp:check -- "$BASE_URL"',
  "npm run integrations:verify",
  'EXPECTED_CANONICAL_URL="$BASE_URL" npm run deployment:verify -- "$BASE_URL"'
];
let previousIndex = -1;
for (const command of expectedCommands) {
  const index = run.indexOf(command);
  assert.ok(index > previousIndex, `verification command should appear in order: ${command}`);
  previousIndex = index;
}

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      assertions: [
        "workflow dispatch inputs",
        "production deployment_status trigger",
        "production-only deployment condition",
        "Node.js setup and npm ci",
        "verification env mapping",
        "canonical production URL fallback",
        "expectation flag exports",
        "production verification command order"
      ]
    },
    null,
    2
  )
);

function assertSteps(value: unknown): Array<UnknownRecord> {
  assert.ok(Array.isArray(value), "jobs.verify.steps should be an array");
  for (const step of value) {
    assert.ok(isRecord(step), "each workflow step should be an object");
  }
  return value;
}
