import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createResourceAiSummaries, persistResourceAiSummaries } from "@/lib/ai-summaries";
import { validateGeneratedAiSummaries } from "@/lib/ai-output-validation";
import { getResources } from "@/lib/resources";

const args = process.argv.slice(2);

function getLimit() {
  const argument = args.find((item) => item.startsWith("--limit="));
  if (!argument) return undefined;

  const value = Number(argument.slice("--limit=".length));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function getOutputFile() {
  const argument = args.find((item) => item.startsWith("--out="));
  return argument ? argument.slice("--out=".length) : "public/api/ai-summaries.json";
}

function printHelp() {
  console.log(`Usage:
  miniprogram-radar ai-summarize [--limit=20] [--dry-run] [--json]
  npm run ai:summarize -- --no-persist

Options:
  --limit=<n>      Limit generated summaries.
  --dry-run        Validate generated summaries without writing files or database rows.
  --no-persist     Do not write summaries to Postgres.
  --no-write       Do not update public/api/ai-summaries.json.
  --out=<file>     Write snapshot to a custom file. Defaults to public/api/ai-summaries.json.
  --json           Print a JSON summary.
  -h, --help       Show this help message.`);
}

if (args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
}

const dryRun = args.includes("--dry-run");
const noPersist = dryRun || args.includes("--no-persist") || process.env.npm_config_persist === "false";
const noWrite = dryRun || args.includes("--no-write");
const outputFile = getOutputFile();
const resources = await getResources();
const summaries = createResourceAiSummaries(resources, getLimit());
const validation = validateGeneratedAiSummaries(summaries, resources);
if (!validation.ok) {
  console.error(JSON.stringify({ error: "AI summary validation failed.", errors: validation.errors }, null, 2));
  process.exit(1);
}
const shouldPersist = !noPersist;
const persistResult = shouldPersist ? await persistResourceAiSummaries(summaries) : { persisted: false, count: 0, error: null };
const payload = {
  generatedAt: new Date().toISOString(),
  mode: "rules",
  count: summaries.length,
  summaries
};

if (!noWrite) {
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

console.log(
  JSON.stringify(
    {
      generatedAt: payload.generatedAt,
      mode: payload.mode,
      count: summaries.length,
      dryRun,
      outputFile: noWrite ? null : outputFile,
      persist: persistResult
    },
    null,
    2
  )
);
