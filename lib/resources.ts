import { readFile } from "node:fs/promises";
import { createDb } from "@/db/client";
import { resourceAlternatives, resources as databaseResources } from "@/db/schema";
import { parse } from "yaml";

export type Difficulty = "beginner" | "intermediate" | "advanced" | "unknown";
export type ResourceType = "framework" | "ui" | "tooling" | "cloud" | "sdk" | "example" | "docs";
export type RadarStatus = "adopt" | "trial" | "assess" | "hold";
export type MaintainStatus = "active" | "low" | "stale" | "deprecated" | "unknown";
export type RiskLevel = "low" | "medium" | "high";

export interface Metadata {
  language: string[];
  difficulty: Difficulty;
  topics: string[];
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  description: string;
  note?: string;
  metadata: Metadata;
}

interface Section {
  id: string;
  name: string;
  resources: Resource[];
}

interface Category {
  id: string;
  name: string;
  resources?: Resource[];
  sections?: Section[];
}

interface Catalog {
  name: string;
  title: string;
  description: string;
  generatedFrom: string;
  categories: Category[];
}

export interface Evidence {
  type: "github" | "npm" | "docs" | "website";
  label: string;
  url: string;
}

export interface RadarProfile {
  type: ResourceType;
  status: RadarStatus;
  maintainStatus: MaintainStatus;
  riskLevel: RiskLevel;
  summary: string;
  useCases: string[];
  notRecommendedFor: string[];
  alternatives: string[];
  alternativeResourceIds?: string[];
  evidence: Evidence[];
}

export interface RadarResource extends Resource {
  category: string;
  categoryId: string;
  section: string | null;
  sectionId: string | null;
  radar: RadarProfile;
}

export interface ResourceStats {
  total: number;
  adopt: number;
  trial: number;
  assess: number;
  hold: number;
  highRisk: number;
  categories: number;
}

export interface AlternativeResource {
  label: string;
  id: string;
  title: string;
  status: RadarStatus;
  maintainStatus: MaintainStatus;
  riskLevel: RiskLevel;
  summary: string;
  url: string;
}

const DATA_FILE = "data/resources.yaml";

let cachedCatalog: Catalog | null = null;

async function readCatalog(): Promise<Catalog> {
  if (cachedCatalog) return cachedCatalog;
  cachedCatalog = parse(await readFile(DATA_FILE, "utf8")) as Catalog;
  return cachedCatalog;
}

function normalizeMetadata(value: unknown): Metadata {
  const metadata = value as Partial<Metadata> | null;
  return {
    language: Array.isArray(metadata?.language) ? metadata.language : ["zh-CN"],
    difficulty:
      metadata?.difficulty === "beginner" ||
      metadata?.difficulty === "intermediate" ||
      metadata?.difficulty === "advanced" ||
      metadata?.difficulty === "unknown"
        ? metadata.difficulty
        : "unknown",
    topics: Array.isArray(metadata?.topics) ? metadata.topics : []
  };
}

function includesAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value.toLowerCase()));
}

function inferType(resource: Resource, categoryId: string): ResourceType {
  const text = `${resource.title} ${resource.description} ${resource.metadata.topics.join(" ")}`.toLowerCase();
  if (categoryId === "official-docs" || includesAny(text, ["文档", "指南", "教程", "api"])) return "docs";
  if (includesAny(text, ["taro", "uni-app", "wepy", "mpvue", "remax", "mpx", "kbone", "框架"])) return "framework";
  if (includesAny(text, ["vant", "tdesign", "weui", "wux", "组件", "ui"])) return "ui";
  if (includesAny(text, ["云开发", "serverless", "cloud", "后端"])) return "cloud";
  if (includesAny(text, ["sdk", "支付", "地图", "im", "登录"])) return "sdk";
  if (includesAny(text, ["demo", "模板", "example", "商城", "实战"])) return "example";
  return "tooling";
}

function inferStatus(resource: Resource): Pick<RadarProfile, "status" | "maintainStatus" | "riskLevel"> {
  const text = `${resource.id} ${resource.title} ${resource.description} ${resource.metadata.topics.join(" ")}`.toLowerCase();

  if (includesAny(text, ["wepy", "mpvue"])) {
    return { status: "hold", maintainStatus: "deprecated", riskLevel: "high" };
  }
  if (includesAny(text, ["chameleon", "remax", "kbone", "wept"])) {
    return { status: "assess", maintainStatus: "stale", riskLevel: "medium" };
  }
  if (includesAny(text, ["taro", "uni-app", "vant", "tdesign", "weui", "miniprogram dev", "官方"])) {
    return { status: "adopt", maintainStatus: "active", riskLevel: "low" };
  }
  if (resource.metadata.difficulty === "beginner" || includesAny(text, ["教程", "指南", "文档"])) {
    return { status: "trial", maintainStatus: "unknown", riskLevel: "low" };
  }
  return { status: "assess", maintainStatus: "unknown", riskLevel: "medium" };
}

function evidenceFor(resource: Resource): Evidence[] {
  let type: Evidence["type"] = "website";
  if (resource.url.includes("github.com")) type = "github";
  if (resource.url.includes("npmjs.com")) type = "npm";
  if (resource.url.includes("developers.weixin.qq.com") || resource.url.includes("docs")) type = "docs";

  return [{ type, label: type === "github" ? "GitHub" : type === "docs" ? "官方文档" : type === "npm" ? "npm" : "官网", url: resource.url }];
}

function alternativesFor(resource: Resource): string[] {
  const text = `${resource.id} ${resource.title} ${resource.description}`.toLowerCase();
  if (includesAny(text, ["wepy", "mpvue", "remax", "chameleon"])) return ["Taro", "uni-app", "原生小程序"];
  if (includesAny(text, ["taro"])) return ["uni-app", "MPX", "原生小程序"];
  if (includesAny(text, ["uni-app"])) return ["Taro", "原生小程序"];
  if (includesAny(text, ["组件", "ui", "weui", "vant", "tdesign"])) return ["TDesign WeChat", "Vant Weapp", "WeUI"];
  return [];
}

function buildSummary(resource: Resource, type: ResourceType, status: RadarStatus): string {
  const subject = resource.description || resource.title.replace(/\s*★.*$/, "");
  const statusText: Record<RadarStatus, string> = {
    adopt: "适合优先评估",
    trial: "适合试用验证",
    assess: "需要结合项目约束评估",
    hold: "不建议新项目直接采用"
  };
  const typeText: Record<ResourceType, string> = {
    framework: "框架方案",
    ui: "组件与 UI 方案",
    tooling: "工程工具",
    cloud: "云服务方案",
    sdk: "SDK 资源",
    example: "示例项目",
    docs: "文档资源"
  };

  return `${subject}。作为${typeText[type]}，当前${statusText[status]}。`;
}

function deriveRadar(resource: Resource, categoryId: string, categoryName: string): RadarProfile {
  const type = inferType(resource, categoryId);
  const status = inferStatus(resource);
  const useCases = [categoryName, ...resource.metadata.topics]
    .filter((item, index, array) => item && array.indexOf(item) === index)
    .slice(0, 4);

  return {
    type,
    ...status,
    summary: buildSummary(resource, type, status.status),
    useCases,
    notRecommendedFor: status.status === "hold" ? ["新项目技术选型", "长期维护成本敏感的团队"] : [],
    alternatives: alternativesFor(resource),
    evidence: evidenceFor(resource)
  };
}

async function getYamlResources(): Promise<RadarResource[]> {
  const catalog = await readCatalog();
  const rows: RadarResource[] = [];

  for (const category of catalog.categories) {
    for (const resource of category.resources ?? []) {
      rows.push({
        ...resource,
        category: category.name,
        categoryId: category.id,
        section: null,
        sectionId: null,
        radar: deriveRadar(resource, category.id, category.name)
      });
    }

    for (const section of category.sections ?? []) {
      for (const resource of section.resources ?? []) {
        rows.push({
          ...resource,
          category: category.name,
          categoryId: category.id,
          section: section.name,
          sectionId: section.id,
          radar: deriveRadar(resource, category.id, category.name)
        });
      }
    }
  }

  return rows;
}

async function getDatabaseResources(): Promise<RadarResource[] | null> {
  if (!process.env.DATABASE_URL) return null;

  try {
    const db = createDb();
    const [rows, alternativeRows] = await Promise.all([db.select().from(databaseResources), db.select().from(resourceAlternatives)]);
    if (rows.length === 0) return null;
    const alternativesBySource = new Map<string, typeof alternativeRows>();
    for (const row of alternativeRows) {
      const current = alternativesBySource.get(row.sourceResourceId) ?? [];
      current.push(row);
      alternativesBySource.set(row.sourceResourceId, current);
    }

    return rows.map((row) => {
      const resource = {
        id: row.id,
        title: row.title,
        url: row.url,
        description: row.description,
        note: row.note ?? undefined,
        metadata: normalizeMetadata(row.metadata)
      };
      const alternatives = (alternativesBySource.get(row.id) ?? []).sort((a, b) => a.rank - b.rank);

      return {
        ...resource,
        category: row.categoryName,
        categoryId: row.categoryId,
        section: row.sectionName,
        sectionId: row.sectionId,
        radar: {
          type: row.resourceType as ResourceType,
          status: row.status as RadarStatus,
          maintainStatus: row.maintainStatus as MaintainStatus,
          riskLevel: row.riskLevel as RiskLevel,
          summary: row.summary,
          useCases: [row.categoryName, ...resource.metadata.topics].filter((item, index, array) => item && array.indexOf(item) === index).slice(0, 4),
          notRecommendedFor: row.status === "hold" ? ["新项目技术选型", "长期维护成本敏感的团队"] : [],
          alternatives: alternatives.length > 0 ? alternatives.map((alternative) => alternative.label) : alternativesFor(resource),
          alternativeResourceIds: alternatives.map((alternative) => alternative.targetResourceId),
          evidence: evidenceFor(resource)
        }
      };
    });
  } catch (error) {
    console.warn(`Falling back to YAML resources: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export async function getResources(): Promise<RadarResource[]> {
  return (await getDatabaseResources()) ?? (await getYamlResources());
}

export async function getResource(id: string) {
  const resources = await getResources();
  return resources.find((resource) => resource.id === id) ?? null;
}

function alternativeKeywords(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("taro")) return ["taro"];
  if (normalized.includes("uni-app")) return ["uni-app", "uniapp"];
  if (normalized.includes("mpx")) return ["mpx"];
  if (normalized.includes("tdesign")) return ["tdesign"];
  if (normalized.includes("vant")) return ["vant"];
  if (normalized.includes("weui")) return ["weui"];
  if (label.includes("原生小程序")) return ["developers.weixin.qq.com/miniprogram/dev/framework", "小程序开发教程", "小程序框架"];
  return [normalized];
}

function preferredAlternativeIds(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("taro")) return ["github-com-nervjstaro"];
  if (normalized.includes("uni-app")) return ["github-com-dcloudiouni-app"];
  if (normalized.includes("mpx")) return ["github-com-didimpx"];
  if (label.includes("原生小程序")) return ["developers-weixin-qq-com-miniprogramdevframework"];
  if (normalized.includes("tdesign")) return ["github-com-tencenttdesign-miniprogram"];
  if (normalized.includes("vant")) return ["github-com-youzanvant-weapp"];
  if (normalized.includes("weui")) return ["github-com-tencentweui-wxss"];
  return [];
}

function alternativeScore(resource: RadarResource, keywords: string[], preferredIds: string[]) {
  const haystack = `${resource.id} ${resource.title} ${resource.description} ${resource.url}`.toLowerCase();
  let score = 0;
  if (preferredIds.includes(resource.id)) score += 100;
  for (const keyword of keywords) {
    if (haystack.includes(keyword.toLowerCase())) score += 10;
  }
  if (resource.radar.status === "adopt") score += 4;
  if (resource.radar.status === "trial") score += 2;
  if (resource.radar.riskLevel === "low") score += 2;
  if (resource.radar.riskLevel === "high") score -= 4;
  return score;
}

export function findAlternativeResources(resources: RadarResource[], resource: RadarResource, limit = 4): AlternativeResource[] {
  const alternatives: AlternativeResource[] = [];
  const usedIds = new Set([resource.id]);
  const persistedIds = resource.radar.alternativeResourceIds ?? [];

  for (const [index, targetId] of persistedIds.entries()) {
    const candidate = resources.find((item) => item.id === targetId && !usedIds.has(item.id));
    if (!candidate) continue;
    usedIds.add(candidate.id);
    alternatives.push({
      label: resource.radar.alternatives[index] ?? candidate.title,
      id: candidate.id,
      title: candidate.title,
      status: candidate.radar.status,
      maintainStatus: candidate.radar.maintainStatus,
      riskLevel: candidate.radar.riskLevel,
      summary: candidate.radar.summary,
      url: candidate.url
    });

    if (alternatives.length >= limit) return alternatives;
  }

  for (const label of resource.radar.alternatives) {
    const keywords = alternativeKeywords(label);
    const preferredIds = preferredAlternativeIds(label);
    const candidate = resources
      .filter((item) => !usedIds.has(item.id))
      .map((item) => ({ resource: item, score: alternativeScore(item, keywords, preferredIds) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.resource.title.localeCompare(b.resource.title, "zh-CN"))[0]?.resource;

    if (!candidate) continue;
    usedIds.add(candidate.id);
    alternatives.push({
      label,
      id: candidate.id,
      title: candidate.title,
      status: candidate.radar.status,
      maintainStatus: candidate.radar.maintainStatus,
      riskLevel: candidate.radar.riskLevel,
      summary: candidate.radar.summary,
      url: candidate.url
    });

    if (alternatives.length >= limit) break;
  }

  return alternatives;
}

export function getStats(resources: RadarResource[]): ResourceStats {
  return {
    total: resources.length,
    adopt: resources.filter((resource) => resource.radar.status === "adopt").length,
    trial: resources.filter((resource) => resource.radar.status === "trial").length,
    assess: resources.filter((resource) => resource.radar.status === "assess").length,
    hold: resources.filter((resource) => resource.radar.status === "hold").length,
    highRisk: resources.filter((resource) => resource.radar.riskLevel === "high").length,
    categories: new Set(resources.map((resource) => resource.categoryId)).size
  };
}

export function getCategories(resources: RadarResource[]) {
  const categories = new Map<string, string>();
  for (const resource of resources) categories.set(resource.categoryId, resource.category);
  return [...categories.entries()].map(([id, name]) => ({ id, name }));
}

export function getUseCases(resources: RadarResource[]) {
  return Array.from(new Set(resources.flatMap((resource) => resource.radar.useCases)))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function filterResources(
  resources: RadarResource[],
  filters: {
    query?: string;
    category?: string;
    status?: RadarStatus | "all";
    risk?: RiskLevel | "all";
    type?: ResourceType | "all";
    useCase?: string;
  }
) {
  const query = filters.query?.trim().toLowerCase();
  const useCase = filters.useCase?.trim();

  return resources.filter((resource) => {
    const haystack = `${resource.title} ${resource.description} ${resource.category} ${resource.section ?? ""} ${resource.metadata.topics.join(" ")}`.toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (filters.category && filters.category !== "all" && resource.categoryId !== filters.category) return false;
    if (filters.status && filters.status !== "all" && resource.radar.status !== filters.status) return false;
    if (filters.risk && filters.risk !== "all" && resource.radar.riskLevel !== filters.risk) return false;
    if (filters.type && filters.type !== "all" && resource.radar.type !== filters.type) return false;
    if (useCase && useCase !== "all" && !resource.radar.useCases.includes(useCase)) return false;
    return true;
  });
}

export interface CompareMatrixRow {
  id: string;
  title: string;
  type: ResourceType;
  status: RadarStatus;
  maintainStatus: MaintainStatus;
  riskLevel: RiskLevel;
  useCases: string[];
  notRecommendedFor: string[];
  alternatives: string[];
  evidenceCount: number;
  summary: string;
}

export interface CompareInsight {
  id: string;
  title: string;
  recommendation: string;
  bestFor: string[];
  tradeoffs: string[];
  validationChecklist: string[];
  evidence: Evidence[];
}

export function buildCompareMatrix(resources: RadarResource[]): CompareMatrixRow[] {
  return resources.map((resource) => ({
    id: resource.id,
    title: resource.title,
    type: resource.radar.type,
    status: resource.radar.status,
    maintainStatus: resource.radar.maintainStatus,
    riskLevel: resource.radar.riskLevel,
    useCases: resource.radar.useCases,
    notRecommendedFor: resource.radar.notRecommendedFor,
    alternatives: resource.radar.alternatives,
    evidenceCount: resource.radar.evidence.length,
    summary: resource.radar.summary
  }));
}

function compareRecommendationFor(resource: RadarResource) {
  const title = resource.title.replace(/\s*★.*$/, "");
  if (resource.radar.status === "adopt") return `${title} 适合作为新项目优先评估方案。`;
  if (resource.radar.status === "trial") return `${title} 适合作为特定场景下的试用方案。`;
  if (resource.radar.status === "assess") return `${title} 需要先验证维护状态、工程成本和替代方案。`;
  return `${title} 不建议新项目直接采用，主要用于老项目维护或迁移评估。`;
}

function compareTradeoffsFor(resource: RadarResource) {
  const tradeoffs = [
    `推荐状态为「${resource.radar.status}」，风险等级为「${resource.radar.riskLevel}」。`,
    `维护状态为「${resource.radar.maintainStatus}」，需要结合最近 release、commit 和 issue 响应复核。`
  ];

  if (resource.radar.alternatives.length > 0) {
    tradeoffs.push(`可对比替代方案：${resource.radar.alternatives.join("、")}。`);
  }
  if (resource.radar.notRecommendedFor.length > 0) {
    tradeoffs.push(`不推荐场景：${resource.radar.notRecommendedFor.join("、")}。`);
  }
  if (resource.radar.riskLevel === "high" || resource.radar.status === "hold") {
    tradeoffs.push("如果继续使用，需要先准备迁移路径和回退方案。");
  }

  return tradeoffs;
}

function compareValidationChecklistFor(resource: RadarResource) {
  const title = resource.title.replace(/\s*★.*$/, "");
  const checklist = [
    `用同一组真实页面验证 ${title} 的开发体验、构建速度和包体积。`,
    "检查微信原生能力、分包、插件、云开发和 CI/CD 是否能覆盖项目需求。",
    "复核最近 release、commit、issue 响应和官方文档更新。",
    "对复杂页面、首屏性能、低端机兼容性和线上回滚准备验证用例。"
  ];

  if (resource.radar.status === "hold" || resource.radar.riskLevel === "high") {
    checklist.push("确认老项目维护成本和迁移成本，并预留替代方案验证时间。");
  }

  return checklist;
}

export function buildCompareInsights(resources: RadarResource[]): CompareInsight[] {
  return resources.map((resource) => ({
    id: resource.id,
    title: resource.title,
    recommendation: compareRecommendationFor(resource),
    bestFor: resource.radar.useCases.length > 0 ? resource.radar.useCases : [resource.category],
    tradeoffs: compareTradeoffsFor(resource),
    validationChecklist: compareValidationChecklistFor(resource),
    evidence: resource.radar.evidence
  }));
}

export async function getCompareResources(options: { ids?: string[]; limit?: number } = {}) {
  const resources = await getResources();
  const ids = (options.ids && options.ids.length > 0
    ? options.ids
    : [
        "github-com-nervjstaro",
        "github-com-dcloudiouni-app",
        "github-com-didimpx",
        "github-com-tencentwepy-2",
        "github-com-meituan-dianpingmpvue",
        "developers-weixin-qq-com-miniprogramdevframework"
      ]
  )
    .map((id) => id.trim())
    .filter(Boolean)
    .filter((id, index, array) => array.indexOf(id) === index)
    .slice(0, options.limit ?? 8);

  const selected = ids
    .map((id) => resources.find((resource) => resource.id === id))
    .filter((resource): resource is RadarResource => Boolean(resource));

  return selected.length > 0 ? selected : resources.filter((resource) => resource.radar.type === "framework").slice(0, options.limit ?? 6);
}

export async function getWeeklySnapshot() {
  const resources = await getResources();
  return {
    generatedAt: new Date().toISOString(),
    highlights: resources.filter((resource) => resource.radar.status === "adopt").slice(0, 5),
    risks: resources.filter((resource) => resource.radar.riskLevel === "high").slice(0, 5),
    needsAssessment: resources.filter((resource) => resource.radar.status === "assess").slice(0, 5)
  };
}
