import type { GeneratedAiSummary } from "@/lib/ai-summaries";
import type { AlternativeResource, RadarResource } from "@/lib/resources";
import type { ResourceScoreTrace } from "@/lib/score-trace";

export interface ResourceTimelineEvent {
  id: string;
  title: string;
  detail: string;
  occurredAt: string | null;
  source: "resource" | "ai-summary" | "score" | "signal" | "alternatives";
}

function sortTimeline(events: ResourceTimelineEvent[]) {
  return events.sort((a, b) => {
    if (a.occurredAt && b.occurredAt) return b.occurredAt.localeCompare(a.occurredAt);
    if (a.occurredAt) return -1;
    if (b.occurredAt) return 1;
    return a.title.localeCompare(b.title, "zh-CN");
  });
}

export function buildResourceTimeline({
  resource,
  aiSummary,
  scoreTrace,
  alternatives
}: {
  resource: RadarResource;
  aiSummary: GeneratedAiSummary | null;
  scoreTrace: ResourceScoreTrace | null;
  alternatives: AlternativeResource[];
}): ResourceTimelineEvent[] {
  const events: ResourceTimelineEvent[] = [
    {
      id: "resource-snapshot",
      title: "资源快照生成",
      detail: `来自 ${resource.section ?? resource.category}，当前证据来源：${resource.radar.evidence.map((item) => item.label).join("、")}。`,
      occurredAt: null,
      source: "resource"
    }
  ];

  if (aiSummary) {
    events.push({
      id: "ai-summary",
      title: "AI 摘要更新",
      detail: aiSummary.source === "database" ? "读取数据库中的 AI 摘要和风险说明。" : "读取静态规则摘要快照。",
      occurredAt: aiSummary.updatedAt ?? null,
      source: "ai-summary"
    });
  }

  if (scoreTrace) {
    events.push({
      id: "score-trace",
      title: "雷达评分更新",
      detail: scoreTrace.source === "database" ? "基于数据库采集信号生成状态、维护和风险判断。" : "基于静态评分快照生成状态、维护和风险判断。",
      occurredAt: scoreTrace.scoredAt,
      source: "score"
    });
  }

  if (scoreTrace?.signal) {
    events.push({
      id: "signal",
      title: "采集信号更新",
      detail: `${scoreTrace.signal.source} 信号已采集，可追溯到原始来源。`,
      occurredAt: scoreTrace.signal.collectedAt,
      source: "signal"
    });
  }

  if (alternatives.length > 0) {
    events.push({
      id: "alternatives",
      title: "替代方案匹配",
      detail: `已匹配 ${alternatives.map((item) => item.title).slice(0, 3).join("、")} 等迁移或对比候选。`,
      occurredAt: null,
      source: "alternatives"
    });
  }

  return sortTimeline(events);
}
