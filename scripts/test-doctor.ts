import assert from "node:assert/strict";
import { resolve } from "node:path";
import { POST as doctorApi } from "@/app/api/doctor/route";
import { analyzeProject, renderDoctorReport, scanProject } from "@/lib/doctor";

const cases = [
  { fixture: "doctor-taro", expected: "Taro" },
  { fixture: "doctor-uni", expected: "uni-app" },
  { fixture: "doctor-mpx", expected: "MPX" },
  { fixture: "doctor-wepy", expected: "WePY", expectDanger: true }
];

for (const testCase of cases) {
  const report = await scanProject(resolve("fixtures", testCase.fixture));
  assert.equal(
    report.detected.includes(testCase.expected),
    true,
    `${testCase.fixture} should be detected as ${testCase.expected}; got ${report.projectType}`
  );
  assert.equal(report.files.packageJson, true, `${testCase.fixture} should include package.json`);
  assert.equal(report.files.projectConfig, true, `${testCase.fixture} should include project.config.json`);
  assert.ok(report.summary.conclusion.length > 0, `${testCase.fixture} should include a doctor summary conclusion`);
  assert.ok(report.summary.nextActions.length > 0, `${testCase.fixture} should include summary next actions`);

  if (testCase.expectDanger) {
    const dangerFinding = report.findings.find((finding) => finding.severity === "danger");
    assert.equal(
      Boolean(dangerFinding),
      true,
      `${testCase.fixture} should report a high-risk dependency`
    );
    assert.equal(dangerFinding?.priority, "P0", `${testCase.fixture} high-risk dependency should be P0`);
    assert.ok((dangerFinding?.evidence.length ?? 0) > 0, `${testCase.fixture} high-risk dependency should include evidence`);
    assert.match(dangerFinding?.recommendation ?? "", /迁移|Taro|uni-app|原生/, `${testCase.fixture} high-risk dependency should include a fix recommendation`);
    assert.ok(report.recommendedResources.length > 0, `${testCase.fixture} should include recommended radar resources`);
    assert.ok(
      report.recommendedResources.some((resource) => /Taro|uni-app|小程序/.test(`${resource.title} ${resource.reason}`)),
      `${testCase.fixture} should recommend concrete migration resources`
    );

    const markdown = renderDoctorReport(report);
    assert.match(report.summary.title, /P0|风险/, `${testCase.fixture} summary should flag P0 or risk`);
    assert.match(report.summary.conclusion, /P0|迁移|高风险/, `${testCase.fixture} summary should explain the high-risk path`);
    assert.ok(markdown.includes("## 总结"), `${testCase.fixture} markdown should include summary`);
    assert.ok(markdown.includes("优先级：P0"), `${testCase.fixture} markdown should include priority`);
    assert.ok(markdown.includes("证据"), `${testCase.fixture} markdown should include evidence`);
    assert.ok(markdown.includes("## 推荐资源"), `${testCase.fixture} markdown should include recommended resources`);
  }
}

const baseInput = {
  projectRoot: "inline-doctor-test",
  packageJson: {
    dependencies: {
      "@tarojs/taro": "^4.0.0"
    },
    scripts: {
      build: "taro build --type weapp"
    }
  },
  projectConfig: { appid: "touristappid" },
  appJson: null,
  envFiles: [".env.local"]
};

const uncoveredEnvReport = analyzeProject({
  ...baseInput,
  gitignoreText: "node_modules/\n"
});
const uncoveredEnvFinding = uncoveredEnvReport.findings.find((finding) => finding.title === "环境变量文件可能进入版本库");
assert.equal(uncoveredEnvFinding?.severity, "danger", "unignored env files should be reported as danger");
assert.equal(uncoveredEnvFinding?.priority, "P0", "unignored env files should be P0");
assert.match(uncoveredEnvFinding?.recommendation ?? "", /\.gitignore|历史提交/, "unignored env recommendation should include gitignore and history guidance");

const coveredEnvReport = analyzeProject({
  ...baseInput,
  gitignoreText: ".env\n.env.local\n.env*.local\n"
});
assert.equal(
  coveredEnvReport.findings.some((finding) => finding.title === "环境变量文件可能进入版本库"),
  false,
  "ignored env files should not be reported as possible repository exposure"
);
assert.equal(
  coveredEnvReport.findings.some((finding) => finding.title === "发现本地环境变量文件" && finding.priority === "P1"),
  true,
  "ignored env files should keep a warning reminder"
);

const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.BLOB_READ_WRITE_TOKEN;
try {
  const apiResponse = await doctorApi(
    new Request("https://example.com/api/doctor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        packageJson: JSON.stringify({
          dependencies: {
            wepy: "^2.0.0"
          },
          scripts: {
            build: "wepy build"
          }
        }),
        projectConfigJson: JSON.stringify({
          appid: "touristappid"
        }),
        uploadReport: true
      })
    })
  );
  const apiPayload = (await apiResponse.json()) as {
    report?: { projectType?: string; findings?: unknown[]; summary?: { conclusion?: string; nextActions?: unknown[] } };
    markdown?: string;
    blobUrl?: string | null;
    uploadRequested?: boolean;
  };
  assert.equal(apiResponse.status, 200, "doctor api should accept valid input");
  assert.equal(apiPayload.report?.projectType, "WePY", "doctor api should return the detected project type");
  assert.ok((apiPayload.report?.findings?.length ?? 0) > 0, "doctor api should return findings");
  assert.match(apiPayload.report?.summary?.conclusion ?? "", /P0|迁移|高风险/, "doctor api should return summary conclusion");
  assert.ok((apiPayload.report?.summary?.nextActions?.length ?? 0) > 0, "doctor api should return summary next actions");
  assert.match(apiPayload.markdown ?? "", /小程序项目体检报告/, "doctor api should return markdown");
  assert.match(apiPayload.markdown ?? "", /## 总结/, "doctor api markdown should include summary");
  assert.equal(apiPayload.uploadRequested, true, "doctor api should echo upload intent");
  assert.equal(apiPayload.blobUrl, null, "doctor api should skip Blob upload without BLOB_READ_WRITE_TOKEN");
} finally {
  if (originalBlobToken === undefined) {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  } else {
    process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken;
  }
}

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      cases: cases.length + 3,
      detected: cases.map((testCase) => testCase.expected),
      assertions: [
        "framework detection",
        "deprecated dependency risk",
        "doctor summary",
        "doctor recommended resources",
        "env file repository exposure",
        "ignored env reminder",
        "doctor api optional Blob upload fallback"
      ]
    },
    null,
    2
  )
);
