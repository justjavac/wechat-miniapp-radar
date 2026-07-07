import assert from "node:assert/strict";
import { execFile, type ExecFileException } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const outputDir = resolve(".tmp");
const markdownOutputFile = resolve(outputDir, "tracker-report.md");
const jsonOutputFile = resolve(outputDir, "tracker-report.json");
const trackerFixtureFile = resolve(outputDir, "tracker-fixture.md");

await mkdir(outputDir, { recursive: true });
await rm(markdownOutputFile, { force: true });
await rm(jsonOutputFile, { force: true });
await rm(trackerFixtureFile, { force: true });
await writeFile(
  trackerFixtureFile,
  `# 小程序雷达实施追踪表

更新时间：2026-07-07

## 2. 进度总览

| 阶段 | 状态 | 当前证据 | 下一步 |
| --- | --- | --- | --- |
| P1 本地 MVP | 已完成 | npm run check 通过 | 保持验证 |
| P5 Redis 缓存/限流/任务锁 | 进行中 | KV env 兼容中 | 合并后复验 |

## 3. 当前问题清单

| ID | 问题 | 影响 | 状态 | 处理方案 |
| --- | --- | --- | --- | --- |
| I-006 | Production Redis 待复验 | 缓存和锁未完全收口 | 打开 | 合并后复验 |

## 4. 风险清单

| ID | 风险 | 触发信号 | 应对 |
| --- | --- | --- | --- |
| R-001 | 免费额度不够 | 用量接近上限 | 限流 |

## 5. 验证记录

| 日期 | 范围 | 命令/证据 | 结果 | 备注 |
| --- | --- | --- | --- | --- |
| 2026-07-07 | 本地检查 | npm run check | 通过 | fixture |
`,
  "utf8"
);

const trackerEnv = {
  env: {
    ...process.env,
    TRACKER_PATH: trackerFixtureFile
  }
};

const markdown = await execFileAsync(process.execPath, ["bin/miniprogram-radar.mjs", "tracker", `--out=${markdownOutputFile}`], trackerEnv);
assert.match(markdown.stdout, /Tracker report written to/);
const markdownReport = await readFile(markdownOutputFile, "utf8");
assert.match(markdownReport, /小程序雷达实施追踪状态/);
assert.match(markdownReport, /打开问题/);
assert.match(markdownReport, /进行中/);

const json = await execFileAsync(process.execPath, ["bin/miniprogram-radar.mjs", "tracker", "--json", `--out=${jsonOutputFile}`], trackerEnv);
assert.match(json.stdout, /Tracker JSON report written to/);
const payload = JSON.parse(await readFile(jsonOutputFile, "utf8")) as {
  available?: boolean;
  summary?: {
    phases?: number;
    completed?: number;
    inProgress?: number;
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
assert.equal(payload.available, true, "tracker json should report the fixture as available");
assert.ok((payload.summary?.phases ?? 0) > 0, "tracker json should include phase count");
assert.ok((payload.summary?.completed ?? 0) > 0, "tracker json should include completed phase count");
assert.ok((payload.summary?.inProgress ?? 0) > 0, "tracker json should expose in-progress phases");
assert.ok((payload.summary?.openIssues ?? 0) > 0, "tracker json should expose open issues");
assert.ok((payload.summary?.risks ?? 0) > 0, "tracker json should include risks");
assert.ok((payload.summary?.verifications ?? 0) > 0, "tracker json should include verification records");
assert.ok((payload.progress?.length ?? 0) > 0, "tracker json should include progress rows");
assert.ok((payload.issues?.length ?? 0) > 0, "tracker json should include issue rows");
assert.ok((payload.risks?.length ?? 0) > 0, "tracker json should include risk rows");
assert.ok((payload.verifications?.length ?? 0) > 0, "tracker json should include verification rows");

let failOnOpen: { code?: string | number | null; stderr?: string } | null = null;
try {
  await execFileAsync(process.execPath, ["bin/miniprogram-radar.mjs", "tracker", "--fail-on-open", "--json"], trackerEnv);
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

const missingDocs = await execFileAsync(process.execPath, ["bin/miniprogram-radar.mjs", "tracker", "--json"], {
  env: {
    ...process.env,
    TRACKER_PATH: resolve(outputDir, "missing-tracker.md")
  }
});
const missingDocsPayload = JSON.parse(missingDocs.stdout) as {
  available?: boolean;
  summary?: { phases?: number; openIssues?: number };
};
assert.equal(missingDocsPayload.available, false, "tracker should tolerate local-only docs being absent");
assert.equal(missingDocsPayload.summary?.phases, 0);
assert.equal(missingDocsPayload.summary?.openIssues, 0);

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      cases: 4,
      assertions: ["tracker markdown report", "tracker json report", "tracker fail on open issues", "tracker missing local docs fallback"]
    },
    null,
    2
  )
);
