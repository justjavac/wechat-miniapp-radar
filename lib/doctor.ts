import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { uploadTextArtifact } from "@/lib/blob-storage";
import {
  findAlternativeResources,
  getResources,
  type MaintainStatus,
  type RadarResource,
  type RadarStatus,
  type RiskLevel
} from "@/lib/resources";

export type DoctorSeverity = "info" | "warning" | "danger";
export type DoctorPriority = "P0" | "P1" | "P2";

export interface DoctorEvidence {
  label: string;
  value: string;
}

export interface DoctorFinding {
  severity: DoctorSeverity;
  priority: DoctorPriority;
  title: string;
  detail: string;
  evidence: DoctorEvidence[];
  recommendation: string;
}

export interface DoctorRecommendedResource {
  id: string;
  title: string;
  url: string;
  reason: string;
  status: RadarStatus;
  maintainStatus: MaintainStatus;
  riskLevel: RiskLevel;
  summary: string;
}

export interface DoctorSummary {
  title: string;
  conclusion: string;
  nextActions: string[];
}

export interface DoctorReport {
  projectRoot: string;
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
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export interface DoctorProjectInput {
  projectRoot: string;
  packageJson: PackageJson | null;
  projectConfig: unknown | null;
  appJson: unknown | null;
  envFiles?: string[];
  gitignoreText?: string | null;
}

const frameworkMatchers = [
  { name: "Taro", keywords: ["@tarojs/taro", "@tarojs/cli"] },
  { name: "uni-app", keywords: ["@dcloudio/uni-app", "uni-app"] },
  { name: "MPX", keywords: ["@mpxjs/core", "@mpxjs/webpack-plugin"] },
  { name: "WePY", keywords: ["wepy", "@wepy/core"] },
  { name: "mpvue", keywords: ["mpvue"] },
  { name: "Remax", keywords: ["remax", "remax-cli"] }
];

const deprecatedDependencies = [
  { name: "wepy", replacement: "Taro、uni-app 或原生小程序" },
  { name: "@wepy/core", replacement: "Taro、uni-app 或原生小程序" },
  { name: "mpvue", replacement: "Taro、uni-app 或原生小程序" },
  { name: "remax", replacement: "Taro 或原生小程序" }
];

const dependencyResourceIds: Record<string, string[]> = {
  wepy: ["github-com-tencentwepy-2", "github-com-tencentwepy"],
  "@wepy/core": ["github-com-tencentwepy-2", "github-com-tencentwepy"],
  mpvue: ["github-com-meituan-dianpingmpvue"],
  remax: ["github-com-remaxjsremax"],
  "@tarojs/taro": ["github-com-nervjstaro"],
  "@tarojs/cli": ["github-com-nervjstaro"],
  "@dcloudio/uni-app": ["github-com-dcloudiouni-app"],
  "uni-app": ["github-com-dcloudiouni-app"],
  "@mpxjs/core": ["github-com-didimpx"],
  "@mpxjs/webpack-plugin": ["github-com-didimpx"]
};

const frameworkResourceIds: Record<string, string[]> = {
  Taro: ["github-com-nervjstaro"],
  "uni-app": ["github-com-dcloudiouni-app"],
  MPX: ["github-com-didimpx"],
  Remax: ["github-com-remaxjsremax"],
  WePY: ["github-com-tencentwepy-2", "github-com-tencentwepy"],
  mpvue: ["github-com-meituan-dianpingmpvue"],
  原生小程序: ["developers-weixin-qq-com-miniprogramdevframework"]
};

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function dependencyNames(pkg: PackageJson | null) {
  return new Set([...Object.keys(pkg?.dependencies ?? {}), ...Object.keys(pkg?.devDependencies ?? {})]);
}

function detectFrameworks(deps: Set<string>, hasProjectConfig: boolean) {
  const detected = frameworkMatchers
    .filter((matcher) => matcher.keywords.some((keyword) => deps.has(keyword)))
    .map((matcher) => matcher.name);

  if (detected.length === 0 && hasProjectConfig) detected.push("原生小程序");
  return detected;
}

function findResourceByIds(resources: RadarResource[], ids: string[]) {
  return ids.map((id) => resources.find((resource) => resource.id === id)).find((resource): resource is RadarResource => Boolean(resource));
}

function toRecommendedResource(resource: RadarResource, reason: string): DoctorRecommendedResource {
  return {
    id: resource.id,
    title: resource.title,
    url: resource.url,
    reason,
    status: resource.radar.status,
    maintainStatus: resource.radar.maintainStatus,
    riskLevel: resource.radar.riskLevel,
    summary: resource.radar.summary
  };
}

function addRecommendedResource(
  recommendations: DoctorRecommendedResource[],
  resource: RadarResource,
  reason: string,
  limit = 6
) {
  if (recommendations.length >= limit) return;
  if (recommendations.some((item) => item.id === resource.id)) return;
  recommendations.push(toRecommendedResource(resource, reason));
}

function buildDoctorSummary(input: {
  projectType: string;
  score: number;
  detected: string[];
  findings: DoctorFinding[];
  recommendedResources: DoctorRecommendedResource[];
}): DoctorSummary {
  const dangerCount = input.findings.filter((finding) => finding.severity === "danger").length;
  const warningCount = input.findings.filter((finding) => finding.severity === "warning").length;
  const p0Count = input.findings.filter((finding) => finding.priority === "P0").length;
  const hasMigrationRisk = input.findings.some((finding) => /高风险依赖|迁移|停维|WePY|mpvue|Remax/i.test(`${finding.title} ${finding.detail}`));
  const hasSecurityRisk = input.findings.some((finding) => /环境变量|密钥|AppSecret|Token|私钥/.test(`${finding.title} ${finding.detail}`));
  const frameworkText = input.detected.join("、") || input.projectType || "未知项目";
  const recommendedTitles = input.recommendedResources.slice(0, 3).map((resource) => resource.title).join("、");

  if (dangerCount > 0) {
    const focus = hasSecurityRisk ? "密钥暴露" : hasMigrationRisk ? "框架迁移" : "高风险项";
    return {
      title: "需要立即处理 P0 风险",
      conclusion: `Doctor 识别为 ${frameworkText}，当前评分 ${input.score}。报告中有 ${dangerCount} 个高风险项，其中 ${p0Count} 个为 P0，优先方向是${focus}处置，再评估推荐资源作为替代或修复路径。`,
      nextActions: [
        "先处理 P0 风险，避免继续扩大安全或维护风险。",
        recommendedTitles ? `对照推荐资源验证迁移路线：${recommendedTitles}。` : "补充资源证据后再确定迁移路线。",
        "修复后重新运行 Doctor，确认评分和风险项下降。"
      ]
    };
  }

  if (warningCount > 0) {
    return {
      title: "存在需要复核的工程风险",
      conclusion: `Doctor 识别为 ${frameworkText}，当前评分 ${input.score}。未发现 P0 高风险项，但有 ${warningCount} 个配置或工程实践问题，适合在上线前完成复核。`,
      nextActions: [
        "优先处理 P1 提醒，补齐配置、依赖和构建脚本信息。",
        recommendedTitles ? `参考推荐资源校准当前技术栈：${recommendedTitles}。` : "用官方文档校准项目结构和运行方式。",
        "把 Doctor 检查加入发布前或迁移前的固定步骤。"
      ]
    };
  }

  return {
    title: "未发现明显阻断风险",
    conclusion: `Doctor 识别为 ${frameworkText}，当前评分 ${input.score}。本次扫描没有发现明显高风险依赖或配置阻断项，后续可继续结合 Radar 资源证据复核维护状态。`,
    nextActions: [
      "定期重新运行 Doctor，关注依赖和框架维护状态变化。",
      recommendedTitles ? `保留推荐资源作为后续升级参考：${recommendedTitles}。` : "补充更多项目配置后获得更精准建议。",
      "上线前继续检查真实密钥、构建产物和 CI 配置。"
    ]
  };
}

async function buildRecommendedResources(report: DoctorReport, input: DoctorProjectInput) {
  const resources = await getResources();
  const deps = dependencyNames(input.packageJson);
  const recommendations: DoctorRecommendedResource[] = [];

  for (const dependency of deprecatedDependencies) {
    if (!deps.has(dependency.name)) continue;
    const source = findResourceByIds(resources, dependencyResourceIds[dependency.name] ?? []);
    if (!source) continue;

    for (const alternative of findAlternativeResources(resources, source, 4)) {
      const target = resources.find((resource) => resource.id === alternative.id);
      if (!target) continue;
      addRecommendedResource(recommendations, target, `作为 ${dependency.name} 的迁移候选：${alternative.label}`);
    }
  }

  for (const dependency of deps) {
    if (deprecatedDependencies.some((item) => item.name === dependency)) continue;
    const resource = findResourceByIds(resources, dependencyResourceIds[dependency] ?? []);
    if (!resource) continue;
    addRecommendedResource(recommendations, resource, `已在项目依赖中识别到 ${dependency}，可查看该资源的维护状态和适用场景。`);
  }

  for (const framework of report.detected) {
    const resource = findResourceByIds(resources, frameworkResourceIds[framework] ?? []);
    if (!resource) continue;
    addRecommendedResource(recommendations, resource, `项目识别为 ${framework}，建议对照该资源的风险、证据和替代方案。`);
  }

  if (recommendations.length === 0) {
    const nativeDocs = findResourceByIds(resources, ["developers-weixin-qq-com-miniprogramdevframework"]);
    if (nativeDocs) addRecommendedResource(recommendations, nativeDocs, "未识别到明确框架时，可先用官方框架文档校准项目结构。");
  }

  return recommendations;
}

async function hasFile(root: string, file: string) {
  return existsSync(join(root, file));
}

async function findSuspiciousEnvFiles(root: string) {
  const entries = await readdir(root).catch(() => []);
  return entries.filter((entry) => /^\.env(\.|$)/.test(entry) && !/example|template|sample/i.test(entry));
}

async function readText(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

function gitignorePatternMatches(pattern: string, file: string) {
  const normalized = pattern.trim().replace(/\\/g, "/").replace(/^\//, "");
  if (!normalized || normalized.includes("/")) return false;
  const escaped = normalized.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(file);
}

function isIgnoredByGitignore(file: string, gitignoreText: string | null | undefined) {
  if (!gitignoreText) return false;

  let ignored = false;
  for (const rawLine of gitignoreText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const negated = line.startsWith("!");
    const pattern = negated ? line.slice(1) : line;
    if (!gitignorePatternMatches(pattern, file)) continue;
    ignored = !negated;
  }

  return ignored;
}

export function analyzeProject(input: DoctorProjectInput): DoctorReport {
  const pkg = input.packageJson;
  const deps = dependencyNames(pkg);
  const hasProjectConfig = Boolean(input.projectConfig);
  const hasAppJson = Boolean(input.appJson);
  const detected = detectFrameworks(deps, hasProjectConfig);
  const findings: DoctorFinding[] = [];

  if (!pkg) {
    findings.push({
      severity: "warning",
      priority: "P1",
      title: "缺少 package.json",
      detail: "无法识别依赖、构建脚本和框架包。",
      evidence: [{ label: "文件检查", value: "package.json 未发现" }],
      recommendation: "如果这是完整项目，请在项目根目录运行 Doctor；如果是原生小程序，也建议补充依赖说明。"
    });
  }

  if (!hasProjectConfig && !hasAppJson) {
    findings.push({
      severity: "warning",
      priority: "P1",
      title: "未发现小程序配置文件",
      detail: "未找到 project.config.json 或 app.json。",
      evidence: [{ label: "文件检查", value: "project.config.json 与 app.json 均未发现" }],
      recommendation: "确认扫描路径是否为小程序项目根目录。"
    });
  }

  if (detected.length === 0) {
    findings.push({
      severity: "warning",
      priority: "P2",
      title: "未识别出明确框架",
      detail: "依赖中没有匹配 Taro、uni-app、MPX、WePY、mpvue 或 Remax。",
      evidence: [{ label: "依赖扫描", value: `依赖数量：${deps.size}` }],
      recommendation: "补充框架配置或检查是否为非标准目录结构。"
    });
  }

  for (const dependency of deprecatedDependencies) {
    if (!deps.has(dependency.name)) continue;
    findings.push({
      severity: "danger",
      priority: "P0",
      title: `发现高风险依赖 ${dependency.name}`,
      detail: `${dependency.name} 在新项目中需要谨慎使用，存在维护和迁移风险。`,
      evidence: [
        { label: "依赖命中", value: dependency.name },
        { label: "迁移候选", value: dependency.replacement }
      ],
      recommendation: `评估迁移到 ${dependency.replacement}。`
    });
  }

  if (pkg?.scripts && !Object.keys(pkg.scripts).some((script) => /build|dev|serve|start/.test(script))) {
    findings.push({
      severity: "info",
      priority: "P2",
      title: "构建脚本不明确",
      detail: "package.json scripts 中没有常见的 build/dev/start 命令。",
      evidence: [{ label: "scripts", value: Object.keys(pkg.scripts).join("、") || "无脚本" }],
      recommendation: "补充标准化脚本，方便 CI 和团队成员启动项目。"
    });
  }

  const envFiles = input.envFiles ?? [];
  if (envFiles.length > 0) {
    const uncoveredEnvFiles = envFiles.filter((file) => !isIgnoredByGitignore(file, input.gitignoreText));
    const coveredEnvFiles = envFiles.filter((file) => isIgnoredByGitignore(file, input.gitignoreText));

    if (uncoveredEnvFiles.length > 0) {
      findings.push({
        severity: "danger",
        priority: "P0",
        title: "环境变量文件可能进入版本库",
        detail: `检测到 ${uncoveredEnvFiles.join("、")}，但 .gitignore 未覆盖这些文件。Doctor 不读取密钥内容，但这类文件可能包含 AppSecret、Token 或私钥。`,
        evidence: [
          ...uncoveredEnvFiles.map((file) => ({ label: "未忽略环境文件", value: file })),
          { label: ".gitignore", value: input.gitignoreText ? "未匹配这些环境文件" : "未提供或未发现" }
        ],
        recommendation: "立即把对应 .env* 文件加入 .gitignore，并确认历史提交中没有泄露 AppSecret、Token 或私钥。"
      });
    }

    if (coveredEnvFiles.length > 0) {
      findings.push({
        severity: "warning",
        priority: "P1",
        title: "发现本地环境变量文件",
        detail: `检测到 ${coveredEnvFiles.join("、")}，且已被 .gitignore 覆盖。Doctor 不读取密钥内容，但这些文件仍需谨慎管理。`,
        evidence: coveredEnvFiles.map((file) => ({ label: "已忽略环境文件", value: file })),
        recommendation: "继续保持 .env* 不入库，并定期轮换 AppSecret、Token 或私钥。"
      });
    }
  }

  const dangerCount = findings.filter((finding) => finding.severity === "danger").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;
  const score = Math.max(0, 100 - dangerCount * 25 - warningCount * 10);
  const projectType = detected.join(" + ") || "未知";

  return {
    projectRoot: input.projectRoot,
    projectType,
    score,
    detected,
    findings,
    summary: buildDoctorSummary({
      projectType,
      score,
      detected,
      findings,
      recommendedResources: []
    }),
    recommendedResources: [],
    files: {
      packageJson: Boolean(pkg),
      projectConfig: hasProjectConfig,
      appJson: hasAppJson,
      gitignore: Boolean(input.gitignoreText)
    }
  };
}

export async function createDoctorReport(input: DoctorProjectInput): Promise<DoctorReport> {
  const report = analyzeProject(input);

  try {
    const recommendedResources = await buildRecommendedResources(report, input);
    return {
      ...report,
      recommendedResources,
      summary: buildDoctorSummary({
        projectType: report.projectType,
        score: report.score,
        detected: report.detected,
        findings: report.findings,
        recommendedResources
      })
    };
  } catch {
    return report;
  }
}

export async function scanProject(projectRoot: string): Promise<DoctorReport> {
  const packageJsonPath = join(projectRoot, "package.json");
  const projectConfigPath = join(projectRoot, "project.config.json");
  const appJsonPath = join(projectRoot, "app.json");
  const gitignorePath = join(projectRoot, ".gitignore");

  return createDoctorReport({
    projectRoot,
    packageJson: await readJson<PackageJson>(packageJsonPath),
    projectConfig: await readJson<unknown>(projectConfigPath),
    appJson: await readJson<unknown>(appJsonPath),
    envFiles: await findSuspiciousEnvFiles(projectRoot),
    gitignoreText: await readText(gitignorePath)
  });
}

export function renderDoctorReport(report: DoctorReport) {
  const lines = [
    "# 小程序项目体检报告",
    "",
    `- 项目路径：${report.projectRoot}`,
    `- 项目类型：${report.projectType}`,
    `- 健康评分：${report.score}`,
    `- 识别结果：${report.detected.join("、") || "未识别"}`,
    "",
    "## 总结",
    "",
    `### ${report.summary.title}`,
    "",
    report.summary.conclusion,
    "",
    "### 下一步",
    "",
    ...report.summary.nextActions.map((action) => `- ${action}`),
    "",
    "## 文件检查",
    "",
    `- package.json：${report.files.packageJson ? "已发现" : "未发现"}`,
    `- project.config.json：${report.files.projectConfig ? "已发现" : "未发现"}`,
    `- app.json：${report.files.appJson ? "已发现" : "未发现"}`,
    `- .gitignore：${report.files.gitignore ? "已发现" : "未发现"}`,
    "",
    "## 风险与建议",
    ""
  ];

  if (report.findings.length === 0) {
    lines.push("未发现明显风险。");
  } else {
    for (const finding of report.findings) {
      lines.push(
        `### ${finding.title}`,
        "",
        `- 等级：${finding.severity}`,
        `- 优先级：${finding.priority}`,
        `- 说明：${finding.detail}`,
        "- 证据：",
        ...finding.evidence.map((item) => `  - ${item.label}：${item.value}`),
        `- 建议：${finding.recommendation}`,
        ""
      );
    }
  }

  lines.push("", "## 推荐资源", "");
  if (report.recommendedResources.length === 0) {
    lines.push("暂无匹配的推荐资源。");
  } else {
    for (const resource of report.recommendedResources) {
      lines.push(
        `- [${resource.title}](${resource.url})`,
        `  - 状态：${resource.status}；风险：${resource.riskLevel}；维护：${resource.maintainStatus}`,
        `  - 推荐原因：${resource.reason}`,
        `  - 摘要：${resource.summary}`
      );
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

export async function uploadDoctorReport(report: DoctorReport, markdown: string) {
  const safeProjectType = report.projectType
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";

  return uploadTextArtifact(`doctor/${Date.now()}-${safeProjectType}.md`, markdown, "text/markdown; charset=utf-8");
}
