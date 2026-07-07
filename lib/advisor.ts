import type { RadarResource, ResourceType } from "@/lib/resources";

export interface AdvisorAnswer {
  question: string;
  recommendation: string;
  fitConditions: string[];
  reasons: string[];
  risks: string[];
  alternatives: Array<{ resourceId: string; title: string; url: string; reason: string; status: string; riskLevel: string }>;
  validationChecklist: string[];
  evidence: Array<{ resourceId: string; title: string; url: string; type: string; label: string }>;
}

const statusLabels = {
  adopt: "推荐",
  trial: "可试用",
  assess: "需评估",
  hold: "不建议"
} as const;

const riskLabels = {
  low: "低风险",
  medium: "中风险",
  high: "高风险"
} as const;

const allAdvisorTypes: ResourceType[] = ["framework", "ui", "tooling", "cloud", "sdk", "docs"];

function allowedTypesForQuestion(question: string): ResourceType[] {
  if (/组件|组件库|ui|vant|tdesign|weui|表单|按钮|样式/i.test(question)) return ["ui"];
  if (/云|cloud|serverless|后端|数据库|存储|部署/i.test(question)) return ["cloud", "tooling", "sdk"];
  if (/sdk|支付|地图|登录|im|客服|统计|analytics/i.test(question)) return ["sdk"];
  if (/工具|cli|构建|调试|工程|脚手架|webpack|vite|测试/i.test(question)) return ["tooling"];
  if (/文档|指南|教程|api|规范/i.test(question)) return ["docs"];
  if (/框架|taro|uni-app|原生|mpx|wepy|mpvue|remax|跨端|h5|react|vue/i.test(question)) return ["framework"];
  return allAdvisorTypes;
}

function scoreResource(question: string, resource: RadarResource) {
  const text = `${resource.title} ${resource.description} ${resource.category} ${resource.section ?? ""} ${resource.radar.summary} ${resource.radar.useCases.join(" ")} ${resource.metadata.topics.join(" ")}`.toLowerCase();
  const normalizedQuestion = question.toLowerCase();
  let score = 0;

  const typeIntentWeights: Array<{ pattern: RegExp; type: ResourceType; weight: number }> = [
    { pattern: /组件|组件库|ui|vant|tdesign|weui|表单|按钮|样式/i, type: "ui", weight: 8 },
    { pattern: /云|cloud|cloudbase|serverless|后端|数据库|存储|部署|baas/i, type: "cloud", weight: 10 },
    { pattern: /sdk|支付|地图|登录|im|客服|统计|analytics/i, type: "sdk", weight: 10 },
    { pattern: /工具|cli|构建|调试|工程|脚手架|webpack|vite|测试/i, type: "tooling", weight: 7 },
    { pattern: /文档|指南|教程|api|规范/i, type: "docs", weight: 8 },
    { pattern: /框架|taro|uni-app|原生|mpx|wepy|mpvue|remax|跨端|h5|react|vue/i, type: "framework", weight: 9 }
  ];
  for (const intent of typeIntentWeights) {
    if (intent.pattern.test(question) && resource.radar.type === intent.type) score += intent.weight;
  }

  for (const keyword of [
    "react",
    "vue",
    "taro",
    "uni-app",
    "原生",
    "mpx",
    "wepy",
    "mpvue",
    "remax",
    "组件",
    "ui",
    "云",
    "cloud",
    "sdk",
    "支付",
    "地图",
    "工具",
    "构建",
    "文档",
    "电商",
    "h5",
    "多端"
  ]) {
    if (normalizedQuestion.includes(keyword) && text.includes(keyword)) score += 3;
  }
  for (const namedTechnology of ["wepy", "mpvue", "remax", "kbone", "taro", "uni-app", "mpx"]) {
    if (normalizedQuestion.includes(namedTechnology) && text.includes(namedTechnology)) score += 12;
  }
  if (/云|cloud|cloudbase|serverless|后端|数据库|存储|部署|baas/i.test(question) && /cloudbase|云开发|serverless|后端|数据库|存储|部署|baas/i.test(text)) score += 8;
  if (/sdk|支付|地图|登录|im|客服|统计|analytics/i.test(question) && /sdk|支付|地图|登录|im|客服|统计|analytics/i.test(text)) score += 8;
  if (resource.radar.status === "adopt") score += 4;
  if (resource.radar.status === "trial") score += 2;
  if (resource.radar.status === "hold") score -= 5;
  if (resource.radar.riskLevel === "high") score -= 4;
  if (resource.radar.riskLevel === "low") score += 2;

  return score;
}

function cleanTitle(title: string) {
  return title.replace(/\s*★.*$/, "");
}

function recommendationFor(resource: RadarResource | undefined) {
  if (!resource) return "建议先补充资源库数据，再生成选型结论。";

  const title = cleanTitle(resource.title);
  if (resource.radar.status === "hold") {
    const alternatives = resource.radar.alternatives.length > 0 ? `，优先对比 ${resource.radar.alternatives.join("、")}` : "";
    return `不建议新项目直接采用 ${title}${alternatives}。`;
  }
  if (resource.radar.status === "assess") {
    return `建议谨慎评估 ${title}，先验证维护状态、迁移成本和替代方案。`;
  }
  return `建议优先评估 ${title}。`;
}

function fitConditionsFor(resource: RadarResource | undefined, question: string) {
  if (!resource) return ["资源库暂无可用候选，需要先补充资源和证据。"];

  const conditions = resource.radar.useCases.slice(0, 3).map((useCase) => `适合${useCase}场景。`);
  if (/react|taro/i.test(question)) conditions.push("团队已有 React 或 Taro 经验时，迁移和协作成本更低。");
  if (/vue|uni-app/i.test(question)) conditions.push("团队已有 Vue 或 uni-app 经验时，跨端复用收益更明显。");
  if (/h5|多端|跨端/i.test(question)) conditions.push("业务明确需要 H5 或多端复用时，优先比较跨端框架。");
  if (/企业|生产|长期|团队/i.test(question)) conditions.push("企业项目应优先选择维护状态清晰、替代方案明确的资源。");

  return Array.from(new Set(conditions)).slice(0, 5);
}

function alternativesFor(candidates: Array<{ resource: RadarResource; score: number }>, primary: RadarResource | undefined) {
  return candidates
    .slice(1)
    .map((item) => item.resource)
    .filter((resource) => resource.id !== primary?.id)
    .slice(0, 3)
    .map((resource) => ({
      resourceId: resource.id,
      title: cleanTitle(resource.title),
      url: resource.url,
      reason: `${statusLabels[resource.radar.status]}，${riskLabels[resource.radar.riskLevel]}，适合${resource.radar.useCases.slice(0, 2).join("、")}场景。`,
      status: statusLabels[resource.radar.status],
      riskLevel: riskLabels[resource.radar.riskLevel]
    }));
}

function validationChecklistFor(resource: RadarResource | undefined, alternatives: Array<{ title: string }>) {
  if (!resource) return ["补充资源库数据后重新生成建议。"];

  const title = cleanTitle(resource.title);
  const checklist = [
    `用一个真实页面验证 ${title} 的开发体验、包体积和构建链路。`,
    "检查最近 release、commit、issue 响应和官方文档更新情况。",
    "确认微信原生能力、分包、插件、云开发和 CI/CD 是否满足当前项目。",
    "为复杂页面、首屏性能和低端机兼容性准备验证用例。"
  ];

  if (alternatives.length > 0) {
    checklist.push(`至少用同一组需求对比 ${alternatives.map((item) => item.title).join("、")}。`);
  }

  if (resource.radar.riskLevel === "high" || resource.radar.status === "hold") {
    checklist.push("如果继续采用高风险或不推荐方案，需要准备迁移路径和替代方案。");
  }

  return checklist;
}

export function createAdvisorAnswer(question: string, resources: RadarResource[]): AdvisorAnswer {
  const allowedTypes = allowedTypesForQuestion(question);
  const candidates = resources
    .filter((resource) => allowedTypes.includes(resource.radar.type))
    .map((resource) => ({ resource, score: scoreResource(question, resource) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const primary = candidates[0]?.resource ?? resources[0];
  const alternativeTitles = candidates.slice(1).map((item) => cleanTitle(item.resource.title));
  const alternatives = alternativesFor(candidates, primary);

  return {
    question,
    recommendation: recommendationFor(primary),
    fitConditions: fitConditionsFor(primary, question),
    reasons: primary
      ? [
          `${cleanTitle(primary.title)} 当前状态为「${statusLabels[primary.radar.status]}」，风险等级为「${riskLabels[primary.radar.riskLevel]}」。`,
          `它匹配的适用场景包括：${primary.radar.useCases.join("、")}。`,
          alternativeTitles.length > 0 ? `可同时对比 ${alternativeTitles.join("、")}，避免单一方案锁定。` : "当前没有足够明确的同类替代方案，需要补充对比数据。"
        ]
      : ["资源库暂无可用候选。"],
    risks: primary
      ? [
          "当前建议来自本地资源库和规则评分，还没有接入实时 GitHub/npm 指标。",
          primary.radar.riskLevel === "high" ? "该方案存在较高维护风险，不建议新项目直接采用。" : "复杂页面性能和微信原生能力适配仍需要项目内验证。"
        ]
      : ["缺少资源和证据。"],
    alternatives,
    validationChecklist: validationChecklistFor(primary, alternatives),
    evidence: candidates.map((item) => ({
      resourceId: item.resource.id,
      title: item.resource.title,
      url: item.resource.url,
      type: item.resource.radar.evidence[0]?.type ?? "website",
      label: item.resource.radar.evidence[0]?.label ?? "资源链接"
    }))
  };
}
