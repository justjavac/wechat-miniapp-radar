import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderDoctorReport, scanProject, uploadDoctorReport } from "@/lib/doctor";

const args = process.argv.slice(2);
const targetArg = args.find((arg) => !arg.startsWith("--"));
const outArg = args.find((arg) => arg.startsWith("--out="));
const jsonOutput = args.includes("--json") || process.env.npm_config_json === "true";
const failOnArg = args.find((arg) => arg.startsWith("--fail-on="));
const failOn = failOnArg?.slice("--fail-on=".length).toLowerCase() || process.env.npm_config_fail_on?.toLowerCase();
if (failOn && failOn !== "p0") {
  console.error(`Unsupported --fail-on value: ${failOn}. Supported values: p0.`);
  process.exit(1);
}

const projectRoot = resolve(targetArg ?? ".");
const report = await scanProject(projectRoot);
const markdown = renderDoctorReport(report);
const upload = process.argv.includes("--upload") || process.env.npm_config_upload === "true";
const blobUrl = upload ? await uploadDoctorReport(report, markdown) : null;
const renderedOutput = jsonOutput
  ? `${JSON.stringify({ report, markdown, blobUrl }, null, 2)}\n`
  : markdown;

if (outArg) {
  const outFile = resolve(outArg.slice("--out=".length));
  await writeFile(outFile, renderedOutput, "utf8");
  console.log(jsonOutput ? `Doctor JSON report written to ${outFile}` : `Doctor report written to ${outFile}`);
} else {
  process.stdout.write(renderedOutput);
}

if (upload && (!jsonOutput || outArg)) {
  console.log(blobUrl ? `Doctor report uploaded to ${blobUrl}` : "Doctor report upload skipped: BLOB_READ_WRITE_TOKEN is not configured.");
}

if (failOn === "p0") {
  const p0Findings = report.findings.filter((finding) => finding.priority === "P0");
  if (p0Findings.length > 0) {
    console.error(`Doctor found ${p0Findings.length} P0 finding(s): ${p0Findings.map((finding) => finding.title).join("；")}`);
    process.exitCode = 2;
  }
}
