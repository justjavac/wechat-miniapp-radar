"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Download, Search, SlidersHorizontal } from "lucide-react";
import { ResourceCard } from "@/components/resource-card";
import { statusLabels, riskLabels, typeLabels } from "@/components/resource-labels";
import { Button, buttonVariants } from "@/components/ui/button";
import { buildRadarFilterSearchParams, radarFilterSearch } from "@/lib/radar-url";
import type { RadarResource, RadarStatus, ResourceType, RiskLevel } from "@/lib/resources";
import { cn } from "@/lib/utils";

type Option<T extends string> = { label: string; value: T };

const statusOptions: Option<RadarStatus | "all">[] = [
  { label: "全部状态", value: "all" },
  { label: statusLabels.adopt, value: "adopt" },
  { label: statusLabels.trial, value: "trial" },
  { label: statusLabels.assess, value: "assess" },
  { label: statusLabels.hold, value: "hold" }
];

const riskOptions: Option<RiskLevel | "all">[] = [
  { label: "全部风险", value: "all" },
  { label: riskLabels.low, value: "low" },
  { label: riskLabels.medium, value: "medium" },
  { label: riskLabels.high, value: "high" }
];

const typeOptions: Option<ResourceType | "all">[] = [
  { label: "全部类型", value: "all" },
  { label: typeLabels.framework, value: "framework" },
  { label: typeLabels.ui, value: "ui" },
  { label: typeLabels.tooling, value: "tooling" },
  { label: typeLabels.cloud, value: "cloud" },
  { label: typeLabels.sdk, value: "sdk" },
  { label: typeLabels.example, value: "example" },
  { label: typeLabels.docs, value: "docs" }
];

function parseStatusParam(value: string | null): RadarStatus | "all" {
  return value === "adopt" || value === "trial" || value === "assess" || value === "hold" ? value : "all";
}

function parseRiskParam(value: string | null): RiskLevel | "all" {
  return value === "low" || value === "medium" || value === "high" ? value : "all";
}

function parseTypeParam(value: string | null): ResourceType | "all" {
  return value === "framework" || value === "ui" || value === "tooling" || value === "cloud" || value === "sdk" || value === "example" || value === "docs" ? value : "all";
}

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            className={`focus-ring min-h-10 rounded-md border px-3 text-xs font-semibold transition-colors ${
              value === option.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
            aria-pressed={value === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RadarExplorer({
  resources,
  categories,
  useCases,
  limit
}: {
  resources: RadarResource[];
  categories: Array<{ id: string; name: string }>;
  useCases: string[];
  limit?: number;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [useCase, setUseCase] = useState("all");
  const [status, setStatus] = useState<RadarStatus | "all">("all");
  const [risk, setRisk] = useState<RiskLevel | "all">("all");
  const [type, setType] = useState<ResourceType | "all">("all");
  const [urlReady, setUrlReady] = useState(false);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q") ?? "");
    setCategory(params.get("category") ?? "all");
    setUseCase(params.get("useCase") ?? "all");
    setStatus(parseStatusParam(params.get("status")));
    setRisk(parseRiskParam(params.get("risk")));
    setType(parseTypeParam(params.get("type")));
    setUrlReady(true);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const nextUrl = `${window.location.pathname}${radarFilterSearch({ query, category, useCase, status, risk, type })}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) window.history.replaceState(null, "", nextUrl);
  }, [category, query, risk, status, type, urlReady, useCase]);

  const exportHref = useMemo(() => {
    return (format: "json" | "csv") => {
      const params = buildRadarFilterSearchParams({ query, category, useCase, status, risk, type });
      params.set("format", format);
      return `/api/export/resources?${params.toString()}`;
    };
  }, [category, query, risk, status, type, useCase]);

  const filtered = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    return resources
      .filter((resource) => {
        const haystack = `${resource.title} ${resource.description} ${resource.category} ${resource.section ?? ""} ${resource.metadata.topics.join(" ")}`.toLowerCase();
        if (normalizedQuery && !haystack.includes(normalizedQuery)) return false;
        if (category !== "all" && resource.categoryId !== category) return false;
        if (useCase !== "all" && !resource.radar.useCases.includes(useCase)) return false;
        if (status !== "all" && resource.radar.status !== status) return false;
        if (risk !== "all" && resource.radar.riskLevel !== risk) return false;
        if (type !== "all" && resource.radar.type !== type) return false;
        return true;
      })
      .slice(0, limit ?? resources.length);
  }, [category, deferredQuery, limit, resources, risk, status, type, useCase]);

  function resetFilters() {
    setQuery("");
    setCategory("all");
    setUseCase("all");
    setStatus("all");
    setRisk("all");
    setType("all");
  }

  return (
    <section className="space-y-5" aria-label="资源雷达">
      <div className="radar-grid rounded-lg border border-border p-4 shadow-radar">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Search aria-hidden="true" className="h-4 w-4" />
              搜索资源、框架、场景
            </span>
            <input
              className="focus-ring min-h-11 w-full rounded-md border border-border bg-surface px-3 text-base outline-none placeholder:text-muted-foreground"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如 Taro、组件、云开发、支付"
              type="search"
              value={query}
            />
          </label>
          <Button onClick={resetFilters} type="button" variant="secondary">
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
            重置筛选
          </Button>
        </div>

        <div className="mt-5 grid gap-5">
          <SegmentedControl label="推荐状态" onChange={setStatus} options={statusOptions} value={status} />
          <SegmentedControl label="风险等级" onChange={setRisk} options={riskOptions} value={risk} />
          <SegmentedControl label="资源类型" onChange={setType} options={typeOptions} value={type} />

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="category-filter">
              分类
            </label>
            <select
              className="focus-ring min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
              id="category-filter"
              onChange={(event) => setCategory(event.target.value)}
              value={category}
            >
              <option value="all">全部分类</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="use-case-filter">
              适用场景
            </label>
            <select
              className="focus-ring min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
              id="use-case-filter"
              onChange={(event) => setUseCase(event.target.value)}
              value={useCase}
            >
              <option value="all">全部场景</option>
              {useCases.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          当前匹配 {filtered.length} 个资源
        </p>
        <div className="flex flex-wrap gap-2">
          <a className={cn(buttonVariants({ variant: "secondary", size: "sm" }))} href={exportHref("json")}>
            <Download aria-hidden="true" className="h-4 w-4" />
            JSON
          </a>
          <a className={cn(buttonVariants({ variant: "secondary", size: "sm" }))} href={exportHref("csv")}>
            <Download aria-hidden="true" className="h-4 w-4" />
            CSV
          </a>
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <h2 className="text-lg font-bold">没有匹配的资源</h2>
          <p className="mt-2 text-sm text-muted-foreground">调整关键词或清空筛选条件后再试。</p>
        </div>
      )}
    </section>
  );
}
