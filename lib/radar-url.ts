import type { RadarStatus, ResourceType, RiskLevel } from "@/lib/resources";

export interface RadarFilterState {
  query: string;
  category: string;
  useCase: string;
  status: RadarStatus | "all";
  risk: RiskLevel | "all";
  type: ResourceType | "all";
}

export function buildRadarFilterSearchParams(filters: RadarFilterState) {
  const params = new URLSearchParams();
  const query = filters.query.trim();

  if (query) params.set("q", query);
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.useCase !== "all") params.set("useCase", filters.useCase);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.risk !== "all") params.set("risk", filters.risk);
  if (filters.type !== "all") params.set("type", filters.type);

  return params;
}

export function radarFilterSearch(filters: RadarFilterState) {
  const search = buildRadarFilterSearchParams(filters).toString();
  return search ? `?${search}` : "";
}
