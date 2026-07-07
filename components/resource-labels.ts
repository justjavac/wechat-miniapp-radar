import type { MaintainStatus, RadarStatus, ResourceType, RiskLevel } from "@/lib/resources";

export const statusLabels: Record<RadarStatus, string> = {
  adopt: "推荐",
  trial: "可试用",
  assess: "需评估",
  hold: "不建议"
};

export const riskLabels: Record<RiskLevel, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险"
};

export const maintainLabels: Record<MaintainStatus, string> = {
  active: "活跃",
  low: "低频维护",
  stale: "维护放缓",
  deprecated: "疑似停维",
  unknown: "待确认"
};

export const typeLabels: Record<ResourceType, string> = {
  framework: "框架",
  ui: "组件",
  tooling: "工具",
  cloud: "云服务",
  sdk: "SDK",
  example: "示例",
  docs: "文档"
};
