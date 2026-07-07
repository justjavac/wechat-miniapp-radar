import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createWeeklyReport, persistWeeklyReport, uploadWeeklyReport, writeWeeklyFiles } from "@/lib/weekly";

const args = process.argv.slice(2);
const outArg = args.find((arg) => arg.startsWith("--out="));
const jsonOutput = args.includes("--json") || process.env.npm_config_json === "true";
const persist = args.includes("--persist") || process.env.npm_config_persist === "true";
const upload = args.includes("--upload") || process.env.npm_config_upload === "true";
const writeFiles = args.includes("--write") || process.env.npm_config_write === "true";

if (args.includes("-h") || args.includes("--help")) {
  console.log(`Usage:
  miniprogram-radar weekly [--json] [--out=weekly.md]
  miniprogram-radar weekly --json [--out=weekly.json]
  miniprogram-radar weekly --write
  miniprogram-radar weekly --persist --upload

Options:
  --json     Print structured JSON instead of Markdown.
  --out      Write output to a file.
  --write    Update public weekly snapshot files.
  --persist  Persist the report to Postgres when DATABASE_URL is configured.
  --upload   Upload the Markdown report to Vercel Blob when BLOB_READ_WRITE_TOKEN is configured.`);
  process.exit(0);
}

const report = await createWeeklyReport();
const persisted = persist ? await persistWeeklyReport(report) : false;
const blobUrl = upload ? await uploadWeeklyReport(report) : null;
const files = writeFiles ? await writeSnapshotFiles() : [];
const payload = {
  id: report.id,
  title: report.title,
  generatedAt: report.generatedAt,
  stats: report.stats,
  signalDigest: report.signalDigest,
  persisted,
  blobUrl,
  files,
  markdown: report.markdown
};
const renderedOutput = jsonOutput ? `${JSON.stringify(payload, null, 2)}\n` : report.markdown;

if (outArg) {
  const outFile = resolve(outArg.slice("--out=".length));
  await writeFile(outFile, renderedOutput, "utf8");
  console.log(jsonOutput ? `Weekly JSON report written to ${outFile}` : `Weekly report written to ${outFile}`);
} else {
  process.stdout.write(renderedOutput);
}

if (!jsonOutput || outArg) {
  if (persist) console.log(persisted ? "Weekly report persisted." : "Weekly report persistence skipped: DATABASE_URL is not configured.");
  if (upload) console.log(blobUrl ? `Weekly report uploaded to ${blobUrl}` : "Weekly report upload skipped: BLOB_READ_WRITE_TOKEN is not configured.");
  if (writeFiles) console.log(`Weekly snapshot files written: ${files.join(", ")}`);
}

async function writeSnapshotFiles() {
  await writeWeeklyFiles(report);
  return [`public/api/weekly/latest.json`, `public/api/weekly/index.json`, `public/weekly/${report.id}.md`];
}
