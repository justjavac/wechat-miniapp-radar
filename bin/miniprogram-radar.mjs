#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [command, ...args] = process.argv.slice(2);

function printHelp() {
  console.log(`Usage:
  miniprogram-radar doctor <project-root> [--out=report.md] [--upload]
  miniprogram-radar doctor <project-root> --json [--out=report.json]
  miniprogram-radar doctor <project-root> --fail-on=p0
  miniprogram-radar ai-summarize [--limit=20] [--dry-run] [--json]
  miniprogram-radar advisor "<question>" [--json|--prompt] [--out=answer.md]
  miniprogram-radar compare [--ids=id1,id2] [--json] [--out=compare.md]
  miniprogram-radar enrich [--limit=30] [--dry-run]
  miniprogram-radar health [--json] [--fail-on-unhealthy]
  miniprogram-radar import [--dry-run] [--json]
  miniprogram-radar resources [--q=taro] [--type=framework] [--format=md|json|csv]
  miniprogram-radar score [--json] [--write]
  miniprogram-radar tracker [--json] [--fail-on-open]
  miniprogram-radar verify [production-url] [--json] [--strict]
  miniprogram-radar weekly [--json] [--out=weekly.md] [--write]

Commands:
  doctor   Scan a WeChat Mini Program project and print a risk report.
  ai-summarize  Generate rule-based AI summaries with evidence validation.
  advisor  Generate a local rule-based Mini Program technology selection answer or model-ready prompt contract.
  compare  Compare Mini Program technology options with evidence and tradeoffs.
  enrich   Collect GitHub, npm, and website signals for radar resources.
  health   Print local Mini Program Radar health and integration status.
  import   Import YAML radar resources into Postgres with idempotent upserts.
  resources  Filter and export Mini Program radar resources.
  score    Score radar resources and optionally update the static score snapshot.
  tracker  Read the implementation tracker and print progress, issues, risks, and evidence.
  verify   Run local MVP readiness checks and optional production deployment probes.
  weekly   Generate a Mini Program ecosystem weekly report.`);
}

if (!command || command === "-h" || command === "--help") {
  printHelp();
  process.exit(0);
}

if (!["doctor", "ai-summarize", "advisor", "compare", "enrich", "health", "import", "resources", "score", "tracker", "verify", "weekly"].includes(command)) {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

const script =
  command === "doctor"
    ? "doctor.ts"
    : command === "ai-summarize"
      ? "ai-summarize.ts"
    : command === "advisor"
      ? "advisor.ts"
      : command === "compare"
        ? "compare.ts"
        : command === "enrich"
          ? "enrich-resources.ts"
          : command === "health"
            ? "health.ts"
            : command === "import"
              ? "import-yaml-to-db.ts"
              : command === "resources"
              ? "resources.ts"
              : command === "score"
                ? "score-cli.ts"
                : command === "tracker"
                  ? "tracker.ts"
                  : command === "verify"
                    ? "verify.ts"
                    : "weekly-cli.ts";
const result = spawnSync(process.execPath, ["--import", "tsx", resolve(root, "scripts", script), ...args], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
