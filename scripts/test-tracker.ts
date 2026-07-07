import assert from "node:assert/strict";
import { execFile, type ExecFileException } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const outputDir = resolve(".tmp");
const markdownOutputFile = resolve(outputDir, "tracker-report.md");
const jsonOutputFile = resolve(outputDir, "tracker-report.json");

await mkdir(outputDir, { recursive: true });
await rm(markdownOutputFile, { force: true });
await rm(jsonOutputFile, { force: true });

const markdown = await execFileAsync(process.execPath, ["bin/miniprogram-radar.mjs", "tracker", `--out=${markdownOutputFile}`]);
assert.match(markdown.stdout, /Tracker report written to/);
const markdownReport = await readFile(markdownOutputFile, "utf8");
assert.match(markdownReport, /小程序雷达实施追踪状态/);
assert.match(markdownReport, /打开问题/);
assert.match(markdownReport, /待生产配置/);

const json = await execFileAsync(process.execPath, ["bin/miniprogram-radar.mjs", "tracker", "--json", `--out=${jsonOutputFile}`]);
assert.match(json.stdout, /Tracker JSON report written to/);
const payload = JSON.parse(await readFile(jsonOutputFile, "utf8")) as {
  summary?: {
    phases?: number;
    completed?: number;
    pendingProduction?: number;
    openIssues?: number;
    risks?: number;
    verifications?: number;
  };
  progress?: unknown[];
  issues?: unknown[];
  risks?: unknown[];
  verifications?: unknown[];
};
assert.ok((payload.summary?.phases ?? 0) > 0, "tracker json should include phase count");
assert.ok((payload.summary?.completed ?? 0) > 0, "tracker json should include completed phase count");
assert.ok((payload.summary?.pendingProduction ?? 0) > 0, "tracker json should expose production pending phases");
assert.ok((payload.summary?.openIssues ?? 0) > 0, "tracker json should expose open issues");
assert.ok((payload.summary?.risks ?? 0) > 0, "tracker json should include risks");
assert.ok((payload.summary?.verifications ?? 0) > 0, "tracker json should include verification records");
assert.ok((payload.progress?.length ?? 0) > 0, "tracker json should include progress rows");
assert.ok((payload.issues?.length ?? 0) > 0, "tracker json should include issue rows");
assert.ok((payload.risks?.length ?? 0) > 0, "tracker json should include risk rows");
assert.ok((payload.verifications?.length ?? 0) > 0, "tracker json should include verification rows");

let failOnOpen: { code?: string | number | null; stderr?: string } | null = null;
try {
  await execFileAsync(process.execPath, ["bin/miniprogram-radar.mjs", "tracker", "--fail-on-open", "--json"]);
} catch (error) {
  const execError = error as ExecFileException & { stderr?: string };
  failOnOpen = {
    code: execError.code,
    stderr: execError.stderr ?? ""
  };
}
assert.ok(failOnOpen, "tracker should fail with --fail-on-open while production issues remain open");
assert.equal(Number(failOnOpen.code), 2);
assert.match(failOnOpen.stderr ?? "", /open tracker issues remain/);

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      cases: 3,
      assertions: ["tracker markdown report", "tracker json report", "tracker fail on open issues"]
    },
    null,
    2
  )
);
