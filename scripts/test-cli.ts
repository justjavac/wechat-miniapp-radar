import assert from "node:assert/strict";
import { execFile, type ExecFileException } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const outputDir = resolve(".tmp");
const outputFile = resolve(outputDir, "doctor-cli-report.md");
const jsonOutputFile = resolve(outputDir, "doctor-cli-report.json");
const advisorOutputFile = resolve(outputDir, "advisor-cli-answer.md");
const advisorJsonOutputFile = resolve(outputDir, "advisor-cli-answer.json");
const advisorPromptOutputFile = resolve(outputDir, "advisor-cli-prompt.json");
const compareOutputFile = resolve(outputDir, "compare-cli-report.md");
const compareJsonOutputFile = resolve(outputDir, "compare-cli-report.json");
const healthOutputFile = resolve(outputDir, "health-cli-report.md");
const healthJsonOutputFile = resolve(outputDir, "health-cli-report.json");
const importJsonOutputFile = resolve(outputDir, "import-cli-report.json");
const resourcesOutputFile = resolve(outputDir, "resources-cli-report.md");
const resourcesCsvOutputFile = resolve(outputDir, "resources-cli-report.csv");
const resourcesJsonOutputFile = resolve(outputDir, "resources-cli-report.json");
const scoreOutputFile = resolve(outputDir, "score-cli-report.md");
const scoreJsonOutputFile = resolve(outputDir, "score-cli-report.json");
const weeklyOutputFile = resolve(outputDir, "weekly-cli-report.md");
const weeklyJsonOutputFile = resolve(outputDir, "weekly-cli-report.json");

await mkdir(outputDir, { recursive: true });
await rm(outputFile, { force: true });
await rm(jsonOutputFile, { force: true });
await rm(advisorOutputFile, { force: true });
await rm(advisorJsonOutputFile, { force: true });
await rm(advisorPromptOutputFile, { force: true });
await rm(compareOutputFile, { force: true });
await rm(compareJsonOutputFile, { force: true });
await rm(healthOutputFile, { force: true });
await rm(healthJsonOutputFile, { force: true });
await rm(importJsonOutputFile, { force: true });
await rm(resourcesOutputFile, { force: true });
await rm(resourcesCsvOutputFile, { force: true });
await rm(resourcesJsonOutputFile, { force: true });
await rm(scoreOutputFile, { force: true });
await rm(scoreJsonOutputFile, { force: true });
await rm(weeklyOutputFile, { force: true });
await rm(weeklyJsonOutputFile, { force: true });

const { stdout } = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "doctor",
  "fixtures/doctor-wepy",
  `--out=${outputFile}`
]);

assert.match(stdout, /Doctor report written to/);

const report = await readFile(outputFile, "utf8");
assert.match(report, /WePY/);
assert.match(report, /P0/);

const jsonResult = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "doctor",
  "fixtures/doctor-wepy",
  "--json",
  `--out=${jsonOutputFile}`
]);

assert.match(jsonResult.stdout, /Doctor JSON report written to/);
const jsonReport = JSON.parse(await readFile(jsonOutputFile, "utf8")) as {
  report?: {
    projectType?: string;
    findings?: unknown[];
    recommendedResources?: unknown[];
  };
  markdown?: string;
  blobUrl?: string | null;
};
assert.equal(jsonReport.report?.projectType, "WePY");
assert.ok((jsonReport.report?.findings?.length ?? 0) > 0, "doctor json should include findings");
assert.ok((jsonReport.report?.recommendedResources?.length ?? 0) > 0, "doctor json should include recommended resources");
assert.match(jsonReport.markdown ?? "", /小程序项目体检报告/);
assert.equal(jsonReport.blobUrl, null);

const jsonStdout = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "doctor",
  "fixtures/doctor-wepy",
  "--json",
  "--upload"
]);
const stdoutPayload = JSON.parse(jsonStdout.stdout) as {
  report?: {
    projectType?: string;
  };
  blobUrl?: string | null;
};
assert.equal(stdoutPayload.report?.projectType, "WePY");
assert.equal(stdoutPayload.blobUrl, null);

let failedOnP0: { stdout: string; stderr: string; code?: string | number | null } | null = null;
try {
  await execFileAsync(process.execPath, [
    "bin/miniprogram-radar.mjs",
    "doctor",
    "fixtures/doctor-wepy",
    "--json",
    "--fail-on=p0"
  ]);
} catch (error) {
  const execError = error as ExecFileException & { stdout?: string; stderr?: string };
  failedOnP0 = {
    stdout: execError.stdout ?? "",
    stderr: execError.stderr ?? "",
    code: execError.code
  };
}
assert.ok(failedOnP0, "doctor cli should fail when --fail-on=p0 finds P0 findings");
assert.equal(Number(failedOnP0.code), 2);
const failedPayload = JSON.parse(failedOnP0.stdout) as {
  report?: {
    findings?: Array<{ priority?: string }>;
  };
};
assert.ok(failedPayload.report?.findings?.some((finding) => finding.priority === "P0"), "failed JSON should still include P0 findings");
assert.match(failedOnP0.stderr, /P0 finding/);

const aiSummarizeHelp = await execFileAsync(process.execPath, ["bin/miniprogram-radar.mjs", "ai-summarize", "--help"]);
assert.match(aiSummarizeHelp.stdout, /miniprogram-radar ai-summarize/);
assert.match(aiSummarizeHelp.stdout, /--dry-run/);

const aiSummarizeDryRun = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "ai-summarize",
  "--limit=3",
  "--dry-run",
  "--json"
]);
const aiSummarizeDryRunPayload = JSON.parse(aiSummarizeDryRun.stdout) as {
  mode?: string;
  count?: number;
  dryRun?: boolean;
  outputFile?: string | null;
  persist?: { persisted?: boolean; count?: number };
};
assert.equal(aiSummarizeDryRunPayload.mode, "rules");
assert.equal(aiSummarizeDryRunPayload.count, 3);
assert.equal(aiSummarizeDryRunPayload.dryRun, true);
assert.equal(aiSummarizeDryRunPayload.outputFile, null);
assert.equal(aiSummarizeDryRunPayload.persist?.persisted, false);

const advisorMarkdown = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "advisor",
  "React 团队做电商小程序，后续可能上 H5，应该选 Taro 还是原生？",
  `--out=${advisorOutputFile}`
]);
assert.match(advisorMarkdown.stdout, /Advisor answer written to/);
const advisorReport = await readFile(advisorOutputFile, "utf8");
assert.match(advisorReport, /小程序选型建议/);
assert.match(advisorReport, /推荐结论/);
assert.match(advisorReport, /证据来源/);

const advisorJson = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "advisor",
  "现在还建议新项目继续使用 WePY 吗？",
  "--json",
  `--out=${advisorJsonOutputFile}`
]);
assert.match(advisorJson.stdout, /Advisor JSON answer written to/);
const advisorJsonPayload = JSON.parse(await readFile(advisorJsonOutputFile, "utf8")) as {
  recommendation?: string;
  evidence?: unknown[];
  validationChecklist?: unknown[];
};
assert.match(advisorJsonPayload.recommendation ?? "", /不建议/);
assert.ok((advisorJsonPayload.evidence?.length ?? 0) > 0, "advisor json should include evidence");
assert.ok((advisorJsonPayload.validationChecklist?.length ?? 0) > 0, "advisor json should include validation checklist");

const advisorPrompt = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "advisor",
  "React 团队做电商小程序，后续可能上 H5，应该选 Taro 还是原生？",
  "--prompt",
  `--out=${advisorPromptOutputFile}`
]);
assert.match(advisorPrompt.stdout, /Advisor prompt contract written to/);
const advisorPromptPayload = JSON.parse(await readFile(advisorPromptOutputFile, "utf8")) as {
  task?: string;
  mode?: string;
  allowedResourceIds?: unknown[];
  allowedEvidenceUrls?: unknown[];
  messages?: Array<{ role?: string; content?: string }>;
  outputSchema?: unknown;
};
assert.equal(advisorPromptPayload.task, "advisor");
assert.equal(advisorPromptPayload.mode, "model-ready");
assert.ok((advisorPromptPayload.allowedResourceIds?.length ?? 0) > 0, "advisor prompt should include resource allow-list");
assert.ok((advisorPromptPayload.allowedEvidenceUrls?.length ?? 0) > 0, "advisor prompt should include evidence allow-list");
assert.ok(advisorPromptPayload.messages?.some((message) => message.role === "system"), "advisor prompt should include a system message");
assert.ok(JSON.stringify(advisorPromptPayload.outputSchema).includes("validationChecklist"), "advisor prompt should include the Advisor output schema");

const compareMarkdown = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "compare",
  "--ids=github-com-nervjstaro,github-com-dcloudiouni-app,missing-resource",
  `--out=${compareOutputFile}`
]);
assert.match(compareMarkdown.stdout, /Compare report written to/);
const compareReport = await readFile(compareOutputFile, "utf8");
assert.match(compareReport, /小程序方案对比/);
assert.match(compareReport, /对比矩阵/);
assert.match(compareReport, /缺失资源：missing-resource/);
assert.match(compareReport, /Taro/);
assert.match(compareReport, /uni-app/);

const compareJson = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "compare",
  "github-com-nervjstaro",
  "github-com-dcloudiouni-app",
  "--json",
  `--out=${compareJsonOutputFile}`
]);
assert.match(compareJson.stdout, /Compare JSON report written to/);
const compareJsonPayload = JSON.parse(await readFile(compareJsonOutputFile, "utf8")) as {
  resources?: Array<{ id?: string }>;
  matrix?: unknown[];
  insights?: Array<{ recommendation?: string; evidence?: unknown[] }>;
  requestedIds?: string[];
  missingIds?: string[];
};
assert.deepEqual(compareJsonPayload.requestedIds, ["github-com-nervjstaro", "github-com-dcloudiouni-app"]);
assert.deepEqual(compareJsonPayload.missingIds, []);
assert.equal(compareJsonPayload.resources?.length, 2);
assert.equal(compareJsonPayload.matrix?.length, 2);
assert.equal(compareJsonPayload.insights?.length, 2);
assert.ok(compareJsonPayload.insights?.every((insight) => insight.recommendation && (insight.evidence?.length ?? 0) > 0), "compare json should include recommendations and evidence");

const enrichHelp = await execFileAsync(process.execPath, ["bin/miniprogram-radar.mjs", "enrich", "--help"]);
assert.match(enrichHelp.stdout, /miniprogram-radar enrich/);
assert.match(enrichHelp.stdout, /--dry-run/);

const healthMarkdown = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "health",
  `--out=${healthOutputFile}`
]);
assert.match(healthMarkdown.stdout, /Health report written to/);
const healthReport = await readFile(healthOutputFile, "utf8");
assert.match(healthReport, /小程序雷达健康检查/);
assert.match(healthReport, /静态快照/);
assert.match(healthReport, /集成/);

const healthJson = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "health",
  "--json",
  `--out=${healthJsonOutputFile}`
]);
assert.match(healthJson.stdout, /Health JSON report written to/);
const healthJsonPayload = JSON.parse(await readFile(healthJsonOutputFile, "utf8")) as {
  ok?: boolean;
  resources?: { count?: number };
  snapshots?: { aiSummaries?: { count?: number }; radarScores?: { count?: number }; weekly?: { historyCount?: number } };
  integrations?: { openai?: boolean; ai?: { provider?: string } };
};
assert.equal(healthJsonPayload.ok, true);
assert.ok((healthJsonPayload.resources?.count ?? 0) > 0, "health json should include resource count");
assert.ok((healthJsonPayload.snapshots?.aiSummaries?.count ?? 0) > 0, "health json should include AI summary snapshot count");
assert.ok((healthJsonPayload.snapshots?.radarScores?.count ?? 0) > 0, "health json should include radar score snapshot count");
assert.ok((healthJsonPayload.snapshots?.weekly?.historyCount ?? 0) > 0, "health json should include weekly history count");
assert.equal(healthJsonPayload.integrations?.openai, false);
assert.equal(healthJsonPayload.integrations?.ai?.provider, "openai");

const importHelp = await execFileAsync(process.execPath, ["bin/miniprogram-radar.mjs", "import", "--help"]);
assert.match(importHelp.stdout, /miniprogram-radar import/);
assert.match(importHelp.stdout, /--dry-run/);

const importDryRun = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "import",
  "--dry-run",
  "--json"
]);
const importDryRunPayload = JSON.parse(importDryRun.stdout) as {
  resources?: number;
  alternativeLinks?: number;
  dryRun?: boolean;
};
assert.ok((importDryRunPayload.resources ?? 0) > 0, "import dry run should map resources");
assert.ok((importDryRunPayload.alternativeLinks ?? 0) > 0, "import dry run should map alternative links");
assert.equal(importDryRunPayload.dryRun, true);

const resourcesMarkdown = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "resources",
  "--type=framework",
  "--status=adopt",
  "--useCase=工具",
  "--limit=5",
  `--out=${resourcesOutputFile}`
]);
assert.match(resourcesMarkdown.stdout, /Resources MD export written to/);
const resourcesReport = await readFile(resourcesOutputFile, "utf8");
assert.match(resourcesReport, /小程序雷达资源筛选/);
assert.match(resourcesReport, /匹配资源：/);
assert.match(resourcesReport, /Taro|uni-app|MPX/);

const resourcesCsv = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "resources",
  "--q=taro",
  "--type=framework",
  "--format=csv",
  "--limit=3",
  `--out=${resourcesCsvOutputFile}`
]);
assert.match(resourcesCsv.stdout, /Resources CSV export written to/);
const resourcesCsvReport = await readFile(resourcesCsvOutputFile, "utf8");
assert.match(resourcesCsvReport.split(/\r?\n/)[0] ?? "", /id,title,url,category/);
assert.match(resourcesCsvReport.toLowerCase(), /taro/);

const resourcesJson = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "resources",
  "--q=taro",
  "--format=json",
  "--limit=2",
  "--upload",
  `--out=${resourcesJsonOutputFile}`
]);
assert.match(resourcesJson.stdout, /Resources JSON export written to/);
assert.match(resourcesJson.stdout, /Blob snapshot skipped/);
const resourcesJsonReport = JSON.parse(await readFile(resourcesJsonOutputFile, "utf8")) as {
  uploadRequested?: boolean;
  blobUrl?: string | null;
  resources?: unknown[];
};
assert.equal(resourcesJsonReport.uploadRequested, true);
assert.equal(resourcesJsonReport.blobUrl, null);
assert.equal(resourcesJsonReport.resources?.length, 2);

const scoreMarkdown = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "score",
  "--limit=5",
  `--out=${scoreOutputFile}`
]);
assert.match(scoreMarkdown.stdout, /Score report written to/);
const scoreReport = await readFile(scoreOutputFile, "utf8");
assert.match(scoreReport, /小程序雷达评分报告/);
assert.match(scoreReport, /高风险资源/);
assert.match(scoreReport, /需要评估资源/);

const scoreJson = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "score",
  "--json",
  `--out=${scoreJsonOutputFile}`
]);
assert.match(scoreJson.stdout, /Score JSON report written to/);
const scoreJsonPayload = JSON.parse(await readFile(scoreJsonOutputFile, "utf8")) as {
  stats?: { total?: number; highRisk?: number };
  scores?: Array<{ id?: string; status?: string; riskLevel?: string; reasons?: unknown[]; evidenceRefs?: unknown[] }>;
};
assert.ok((scoreJsonPayload.stats?.total ?? 0) > 0, "score json should include stats");
assert.ok((scoreJsonPayload.stats?.highRisk ?? 0) > 0, "score json should include high risk count");
assert.ok((scoreJsonPayload.scores?.length ?? 0) > 0, "score json should include score rows");
assert.ok(
  scoreJsonPayload.scores?.every((score) => score.id && score.status && score.riskLevel && (score.reasons?.length ?? 0) > 0 && (score.evidenceRefs?.length ?? 0) > 0),
  "score rows should include status, risk, reasons and structured evidence refs"
);

const verifyJson = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "verify",
  "--json"
]);
assert.equal(verifyJson.stderr, "");
const verifyJsonPayload = JSON.parse(verifyJson.stdout) as {
  productionUrl?: string | null;
  summary?: { fail?: number; skipped?: number };
  steps?: Array<{ name?: string; status?: string }>;
};
assert.equal(verifyJsonPayload.productionUrl, null);
assert.equal(verifyJsonPayload.summary?.fail, 0);
assert.equal(verifyJsonPayload.summary?.skipped, 1);
assert.ok(verifyJsonPayload.steps?.some((step) => step.name === "mvp"));
assert.ok(verifyJsonPayload.steps?.some((step) => step.name === "deployment" && step.status === "skipped"));

const weeklyMarkdown = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "weekly",
  `--out=${weeklyOutputFile}`
]);
assert.match(weeklyMarkdown.stdout, /Weekly report written to/);
const weeklyReport = await readFile(weeklyOutputFile, "utf8");
assert.match(weeklyReport, /小程序生态周报/);
assert.match(weeklyReport, /## Signal Digest/);
assert.match(weeklyReport, /## 风险提醒/);

const weeklyJson = await execFileAsync(process.execPath, [
  "bin/miniprogram-radar.mjs",
  "weekly",
  "--json",
  `--out=${weeklyJsonOutputFile}`
]);
assert.match(weeklyJson.stdout, /Weekly JSON report written to/);
const weeklyJsonPayload = JSON.parse(await readFile(weeklyJsonOutputFile, "utf8")) as {
  id?: string;
  stats?: { total?: number };
  signalDigest?: { signals?: unknown[] };
  persisted?: boolean;
  blobUrl?: string | null;
  files?: string[];
  markdown?: string;
};
assert.match(weeklyJsonPayload.id ?? "", /^\d{4}-\d{2}-\d{2}$/);
assert.ok((weeklyJsonPayload.stats?.total ?? 0) > 0, "weekly json should include resource stats");
assert.ok((weeklyJsonPayload.signalDigest?.signals?.length ?? 0) > 0, "weekly json should include signal digest");
assert.equal(weeklyJsonPayload.persisted, false);
assert.equal(weeklyJsonPayload.blobUrl, null);
assert.deepEqual(weeklyJsonPayload.files, []);
assert.match(weeklyJsonPayload.markdown ?? "", /小程序生态周报/);

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      cases: 24,
      assertions: [
        "doctor cli markdown report",
        "doctor cli json report",
        "doctor cli stdout json",
        "doctor cli fail on P0",
        "ai summarize cli help",
        "ai summarize cli dry run",
        "advisor cli markdown answer",
        "advisor cli json answer",
        "advisor cli prompt contract",
        "compare cli markdown report",
        "compare cli json report",
        "enrich cli help",
        "health cli markdown report",
        "health cli json report",
        "import cli help",
        "import cli dry run",
        "resources cli markdown report",
        "resources cli csv export",
        "resources cli json upload fallback",
        "score cli markdown report",
        "score cli json report",
        "verify cli local json",
        "weekly cli markdown report",
        "weekly cli json report"
      ]
    },
    null,
    2
  )
);
