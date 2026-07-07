import { NextResponse } from "next/server";
import { filterResources, getResources, type RadarStatus, type ResourceType, type RiskLevel } from "@/lib/resources";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function firstParam(url: URL, name: string) {
  const value = url.searchParams.get(name);
  return value && value.trim() ? value.trim() : undefined;
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clampPageSize(value: string | null) {
  return Math.min(parsePositiveInt(value, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
}

function parseStatus(value: string | undefined): RadarStatus | "all" | undefined {
  if (!value) return undefined;
  return value === "adopt" || value === "trial" || value === "assess" || value === "hold" || value === "all" ? value : undefined;
}

function parseRisk(value: string | undefined): RiskLevel | "all" | undefined {
  if (!value) return undefined;
  return value === "low" || value === "medium" || value === "high" || value === "all" ? value : undefined;
}

function parseType(value: string | undefined): ResourceType | "all" | undefined {
  if (!value) return undefined;
  return value === "framework" || value === "ui" || value === "tooling" || value === "cloud" || value === "sdk" || value === "example" || value === "docs" || value === "all"
    ? value
    : undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const resources = await getResources();
  const filtered = filterResources(resources, {
    query: firstParam(url, "q"),
    category: firstParam(url, "category"),
    status: parseStatus(firstParam(url, "status")),
    risk: parseRisk(firstParam(url, "risk")),
    type: parseType(firstParam(url, "type")),
    useCase: firstParam(url, "useCase")
  });
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const pageSize = clampPageSize(url.searchParams.get("pageSize") ?? url.searchParams.get("limit"));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const offset = (page - 1) * pageSize;
  const pagedResources = filtered.slice(offset, offset + pageSize);

  return NextResponse.json({
    total,
    page,
    pageSize,
    totalPages,
    resources: pagedResources,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && total > 0
    }
  });
}
