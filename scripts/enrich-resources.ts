import { runEnrichment } from "@/lib/enrichment";

if (process.argv.includes("-h") || process.argv.includes("--help")) {
  console.log(`Usage:
  miniprogram-radar enrich [--limit=30] [--dry-run]
  npm run enrich -- -- --limit=30 --no-persist

Options:
  --limit       Maximum resources to collect. Default: 30.
  --dry-run     Collect and score without persisting to Postgres.
  --no-persist  Alias for --dry-run.`);
  process.exit(0);
}

const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.slice("--limit=".length)) : Number(process.env.npm_config_limit ?? "30");
const persist = !process.argv.includes("--no-persist") && !process.argv.includes("--dry-run") && process.env.npm_config_persist !== "false";

const result = await runEnrichment({
  limit: Number.isFinite(limit) && limit > 0 ? limit : 30,
  persist
});

console.log(JSON.stringify(result, null, 2));
