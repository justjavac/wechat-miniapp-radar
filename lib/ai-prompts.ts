import type { GeneratedAiSummary } from "@/lib/ai-summaries";
import type { AdvisorAnswer } from "@/lib/advisor";
import type { RadarResource } from "@/lib/resources";

export type AiPromptRole = "system" | "user";

export interface AiPromptMessage {
  role: AiPromptRole;
  content: string;
}

export interface AiPromptContract {
  task: "resource-summary" | "advisor";
  mode: "model-ready";
  messages: AiPromptMessage[];
  outputSchema: Record<string, unknown>;
  allowedResourceIds: string[];
  allowedEvidenceUrls: string[];
}

function cleanTitle(title: string) {
  return title.replace(/\s*★.*$/, "").trim();
}

function evidenceUrlsFor(resource: RadarResource) {
  return [resource.url, ...resource.radar.evidence.map((evidence) => evidence.url)];
}

function compactResource(resource: RadarResource) {
  return {
    id: resource.id,
    title: cleanTitle(resource.title),
    type: resource.radar.type,
    status: resource.radar.status,
    riskLevel: resource.radar.riskLevel,
    maintainStatus: resource.radar.maintainStatus,
    summary: resource.radar.summary,
    useCases: resource.radar.useCases,
    notRecommendedFor: resource.radar.notRecommendedFor,
    alternatives: resource.radar.alternatives,
    evidence: [
      {
        type: "homepage",
        label: "资源主页",
        url: resource.url
      },
      ...resource.radar.evidence.map((evidence) => ({
        type: evidence.type,
        label: evidence.label,
        url: evidence.url
      }))
    ]
  };
}

const sharedSystemPrompt = [
  "你是小程序雷达的 AI 分析器。",
  "你只能基于输入的资源库、评分字段和 evidence URL 输出结论。",
  "不要编造不存在的资源、链接、维护状态、下载量或仓库指标。",
  "如果证据不足，必须明确写出需要人工验证的内容。",
  "输出必须是严格 JSON，不能包含 Markdown 代码块。"
].join("\n");

const advisorOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["question", "recommendation", "fitConditions", "reasons", "risks", "alternatives", "validationChecklist", "evidence"],
  properties: {
    question: { type: "string" },
    recommendation: { type: "string" },
    fitConditions: { type: "array", items: { type: "string" }, minItems: 1 },
    reasons: { type: "array", items: { type: "string" }, minItems: 1 },
    risks: { type: "array", items: { type: "string" }, minItems: 1 },
    alternatives: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["resourceId", "title", "url", "reason", "status", "riskLevel"],
        properties: {
          resourceId: { type: "string" },
          title: { type: "string" },
          url: { type: "string" },
          reason: { type: "string" },
          status: { type: "string" },
          riskLevel: { type: "string" }
        }
      }
    },
    validationChecklist: { type: "array", items: { type: "string" }, minItems: 1 },
    evidence: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["resourceId", "title", "url", "type", "label"],
        properties: {
          resourceId: { type: "string" },
          title: { type: "string" },
          url: { type: "string" },
          type: { type: "string" },
          label: { type: "string" }
        }
      }
    }
  }
} as const;

const resourceSummaryOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["resourceId", "title", "summary", "recommendation", "riskNotes", "useCases", "notRecommendedFor", "evidenceRefs"],
  properties: {
    resourceId: { type: "string" },
    title: { type: "string" },
    summary: { type: "string" },
    recommendation: { type: "string" },
    riskNotes: { type: "array", items: { type: "string" }, minItems: 1 },
    useCases: { type: "array", items: { type: "string" }, minItems: 1 },
    notRecommendedFor: { type: "array", items: { type: "string" } },
    evidenceRefs: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "label", "url"],
        properties: {
          type: { type: "string" },
          label: { type: "string" },
          url: { type: "string" }
        }
      }
    }
  }
} as const;

export function buildAdvisorPromptContract(question: string, answer: AdvisorAnswer, resources: RadarResource[]): AiPromptContract {
  const selectedIds = new Set([...answer.evidence.map((item) => item.resourceId), ...answer.alternatives.map((item) => item.resourceId)]);
  const selectedResources = resources.filter((resource) => selectedIds.has(resource.id));
  const allowedEvidenceUrls = Array.from(new Set(selectedResources.flatMap(evidenceUrlsFor)));

  return {
    task: "advisor",
    mode: "model-ready",
    allowedResourceIds: selectedResources.map((resource) => resource.id),
    allowedEvidenceUrls,
    outputSchema: advisorOutputSchema,
    messages: [
      {
        role: "system",
        content: sharedSystemPrompt
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            task: "answer_miniprogram_stack_advisor_question",
            question,
            draftAnswer: answer,
            resources: selectedResources.map(compactResource),
            constraints: [
              "recommendation 必须回答用户问题，不能只复述资源字段。",
              "alternatives 和 evidence 只能引用 resources 中存在的 resourceId。",
              "evidence.url 只能使用 allowedEvidenceUrls 中的 URL。",
              "如果输出中需要新增风险或理由，必须能从 summary、status、riskLevel、maintainStatus 或 evidence 推导。"
            ],
            allowedEvidenceUrls
          },
          null,
          2
        )
      }
    ]
  };
}

export function buildResourceSummaryPromptContract(resource: RadarResource, draftSummary?: GeneratedAiSummary): AiPromptContract {
  const allowedEvidenceUrls = Array.from(new Set(evidenceUrlsFor(resource)));

  return {
    task: "resource-summary",
    mode: "model-ready",
    allowedResourceIds: [resource.id],
    allowedEvidenceUrls,
    outputSchema: resourceSummaryOutputSchema,
    messages: [
      {
        role: "system",
        content: sharedSystemPrompt
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            task: "summarize_miniprogram_ecosystem_resource",
            resource: compactResource(resource),
            draftSummary,
            constraints: [
              "resourceId 必须等于输入 resource.id。",
              "evidenceRefs.url 只能使用 allowedEvidenceUrls 中的 URL。",
              "summary 用一句话说明资源解决什么问题。",
              "recommendation 必须结合 status、riskLevel、maintainStatus 和 useCases。",
              "riskNotes 至少包含维护状态或风险等级。",
              "useCases 只能使用输入 resource.useCases 中已有的值。",
              "notRecommendedFor 只能使用输入 resource.notRecommendedFor 或从 status、riskLevel、maintainStatus 推导出的限制条件。"
            ],
            allowedEvidenceUrls
          },
          null,
          2
        )
      }
    ]
  };
}
