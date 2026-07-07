"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ClipboardCheck, ExternalLink, LoaderCircle, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DoctorFinding {
  severity: "info" | "warning" | "danger";
  priority: "P0" | "P1" | "P2";
  title: string;
  detail: string;
  evidence: Array<{ label: string; value: string }>;
  recommendation: string;
}

interface DoctorRecommendedResource {
  id: string;
  title: string;
  url: string;
  reason: string;
  status: "adopt" | "trial" | "assess" | "hold";
  maintainStatus: "active" | "low" | "stale" | "deprecated" | "unknown";
  riskLevel: "low" | "medium" | "high";
  summary: string;
}

interface DoctorSummary {
  title: string;
  conclusion: string;
  nextActions: string[];
}

interface DoctorResponse {
  report: {
    projectType: string;
    score: number;
    detected: string[];
    findings: DoctorFinding[];
    summary: DoctorSummary;
    recommendedResources: DoctorRecommendedResource[];
    files: {
      packageJson: boolean;
      projectConfig: boolean;
      appJson: boolean;
      gitignore: boolean;
    };
  };
  markdown: string;
  blobUrl: string | null;
  uploadRequested?: boolean;
}

const samplePackageJson = `{
  "dependencies": {
    "wepy": "^2.0.0"
  },
  "scripts": {
    "build": "wepy build"
  }
}`;

const sampleProjectConfig = `{
  "appid": "touristappid"
}`;

const sampleGitignore = `.env
.env.local
.env*.local`;

function severityVariant(severity: DoctorFinding["severity"]) {
  if (severity === "danger") return "hold";
  if (severity === "warning") return "assess";
  return "default";
}

function statusText(status: DoctorRecommendedResource["status"]) {
  const labels = {
    adopt: "推荐",
    trial: "试用",
    assess: "评估",
    hold: "暂缓"
  };
  return labels[status];
}

function riskText(risk: DoctorRecommendedResource["riskLevel"]) {
  const labels = {
    low: "低风险",
    medium: "中风险",
    high: "高风险"
  };
  return labels[risk];
}

export function DoctorForm() {
  const [packageJson, setPackageJson] = useState(samplePackageJson);
  const [projectConfigJson, setProjectConfigJson] = useState(sampleProjectConfig);
  const [appJson, setAppJson] = useState("");
  const [envFiles, setEnvFiles] = useState("");
  const [gitignoreText, setGitignoreText] = useState(sampleGitignore);
  const [uploadReport, setUploadReport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DoctorResponse | null>(null);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");
    setResult(null);

    const response = await fetch("/api/doctor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        packageJson,
        projectConfigJson,
        appJson,
        envFiles,
        gitignoreText,
        uploadReport
      })
    }).catch(() => null);

    setLoading(false);

    if (!response) {
      setError("体检请求失败。");
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as DoctorResponse & { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "体检输入无效。");
      return;
    }

    setResult(payload);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <section className="rounded-lg border border-border bg-surface p-4 shadow-radar">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <ClipboardCheck aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="font-bold">项目输入</h2>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block text-sm font-semibold" htmlFor="doctor-package">
            package.json
            <textarea
              className="focus-ring mt-2 min-h-44 w-full resize-y rounded-md border border-border bg-background px-3 py-3 font-mono text-xs leading-5 outline-none"
              id="doctor-package"
              onChange={(event) => setPackageJson(event.target.value)}
              value={packageJson}
            />
          </label>

          <label className="block text-sm font-semibold" htmlFor="doctor-project-config">
            project.config.json
            <textarea
              className="focus-ring mt-2 min-h-24 w-full resize-y rounded-md border border-border bg-background px-3 py-3 font-mono text-xs leading-5 outline-none"
              id="doctor-project-config"
              onChange={(event) => setProjectConfigJson(event.target.value)}
              value={projectConfigJson}
            />
          </label>

          <label className="block text-sm font-semibold" htmlFor="doctor-app-json">
            app.json
            <textarea
              className="focus-ring mt-2 min-h-24 w-full resize-y rounded-md border border-border bg-background px-3 py-3 font-mono text-xs leading-5 outline-none"
              id="doctor-app-json"
              onChange={(event) => setAppJson(event.target.value)}
              value={appJson}
            />
          </label>

          <label className="block text-sm font-semibold" htmlFor="doctor-env-files">
            环境文件名
            <input
              className="focus-ring mt-2 min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none"
              id="doctor-env-files"
              onChange={(event) => setEnvFiles(event.target.value)}
              placeholder=".env.local, .env.production"
              value={envFiles}
            />
          </label>

          <label className="block text-sm font-semibold" htmlFor="doctor-gitignore">
            .gitignore
            <textarea
              className="focus-ring mt-2 min-h-24 w-full resize-y rounded-md border border-border bg-background px-3 py-3 font-mono text-xs leading-5 outline-none"
              id="doctor-gitignore"
              onChange={(event) => setGitignoreText(event.target.value)}
              value={gitignoreText}
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="doctor-upload-report">
            <input
              checked={uploadReport}
              className="h-4 w-4 rounded border-border accent-primary"
              id="doctor-upload-report"
              onChange={(event) => setUploadReport(event.target.checked)}
              type="checkbox"
            />
            上传报告快照到 Blob
          </label>

          {error ? <p className="text-sm font-medium text-danger" role="alert">{error}</p> : null}
          <Button disabled={loading} onClick={submit} type="button" aria-busy={loading}>
            {loading ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Send aria-hidden="true" className="h-4 w-4" />}
            {loading ? "体检中" : "开始体检"}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-radar" aria-live="polite">
        <div className="border-b border-border pb-3">
          <h2 className="font-bold">体检结果</h2>
        </div>
        {result ? (
          <div className="mt-4 space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">评分</p>
                <p className="mt-1 text-2xl font-black">{result.report.score}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">类型</p>
                <p className="mt-1 text-sm font-bold">{result.report.projectType}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">风险数</p>
                <p className="mt-1 text-2xl font-black">{result.report.findings.length}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {result.report.detected.map((item) => (
                <Badge key={item}>{item}</Badge>
              ))}
            </div>

            {result.blobUrl ? (
              <a
                className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold hover:bg-muted"
                href={result.blobUrl}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
                查看报告快照
              </a>
            ) : result.uploadRequested ? (
              <p className="rounded-md border border-dashed border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                已生成报告；当前未配置 Blob 写入凭据，未上传快照。
              </p>
            ) : null}

            <div className="rounded-md border border-border bg-muted/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={result.report.findings.some((finding) => finding.priority === "P0") ? "hold" : "default"}>
                  总结
                </Badge>
                <h3 className="font-bold">{result.report.summary.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.report.summary.conclusion}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
                {result.report.summary.nextActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              {result.report.findings.length > 0 ? (
                result.report.findings.map((finding) => (
                  <div className="rounded-md border border-border p-3" key={`${finding.severity}:${finding.title}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={severityVariant(finding.severity)}>{finding.severity}</Badge>
                      <Badge variant={finding.priority === "P0" ? "hold" : finding.priority === "P1" ? "assess" : "default"}>
                        {finding.priority}
                      </Badge>
                      <h3 className="font-bold">{finding.title}</h3>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{finding.detail}</p>
                    {finding.evidence.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                        {finding.evidence.map((item) => (
                          <li key={`${finding.title}:${item.label}:${item.value}`}>
                            <span className="font-semibold text-foreground">{item.label}：</span>
                            {item.value}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="mt-2 text-sm leading-6">{finding.recommendation}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">未发现明显风险。</p>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="font-bold">推荐资源</h3>
              {result.report.recommendedResources.length > 0 ? (
                <div className="grid gap-3">
                  {result.report.recommendedResources.map((resource) => (
                    <Link
                      className="focus-ring rounded-md border border-border p-3 outline-none transition hover:border-primary/40 hover:bg-muted/40"
                      href={`/resources/${resource.id}`}
                      key={resource.id}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={resource.status}>{statusText(resource.status)}</Badge>
                        <Badge variant={`risk-${resource.riskLevel}`}>{riskText(resource.riskLevel)}</Badge>
                        <span className="font-bold">{resource.title}</span>
                        <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{resource.reason}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{resource.summary}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无匹配的推荐资源。</p>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm leading-6 text-muted-foreground">提交配置后生成项目类型、健康评分和风险建议。</p>
        )}
      </section>
    </div>
  );
}
