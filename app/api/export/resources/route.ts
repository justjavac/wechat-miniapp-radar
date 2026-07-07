import { NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import { uploadTextArtifact } from "@/lib/blob-storage";
import { filterResources, getResources, type RadarResource, type RadarStatus, type ResourceType, type RiskLevel } from "@/lib/resources";

function firstParam(url: URL, name: string) {
  const value = url.searchParams.get(name);
  return value && value.trim() ? value.trim() : undefined;
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

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function exportRows(resources: RadarResource[]) {
  return resources.map((resource) => ({
    id: resource.id,
    title: resource.title,
    url: resource.url,
    category: resource.category,
    section: resource.section ?? "",
    type: resource.radar.type,
    status: resource.radar.status,
    maintainStatus: resource.radar.maintainStatus,
    riskLevel: resource.radar.riskLevel,
    summary: resource.radar.summary,
    useCases: resource.radar.useCases,
    alternatives: resource.radar.alternatives,
    evidenceUrls: resource.radar.evidence.map((item) => item.url)
  }));
}

function toCsv(rows: ReturnType<typeof exportRows>) {
  const headers = ["id", "title", "url", "category", "section", "type", "status", "maintainStatus", "riskLevel", "summary", "useCases", "alternatives", "evidenceUrls"];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header as keyof typeof row])).join(","))].join("\n")}\n`;
}

function wantsUpload(url: URL) {
  const value = url.searchParams.get("upload") ?? url.searchParams.get("snapshot");
  return value === "1" || value === "true";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = firstParam(url, "format") ?? "json";
  if (format !== "json" && format !== "csv") {
    return NextResponse.json({ error: "format must be json or csv" }, { status: 400 });
  }
  const uploadRequested = wantsUpload(url);
  if (uploadRequested && !isAdminRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const resources = await getResources();
  const filtered = filterResources(resources, {
    query: firstParam(url, "q"),
    category: firstParam(url, "category"),
    status: parseStatus(firstParam(url, "status")),
    risk: parseRisk(firstParam(url, "risk")),
    type: parseType(firstParam(url, "type")),
    useCase: firstParam(url, "useCase")
  });
  const rows = exportRows(filtered);
  const filename = `miniprogram-radar-resources.${format}`;
  const generatedAt = new Date().toISOString();

  if (format === "csv") {
    const csv = toCsv(rows);
    const blobUrl = uploadRequested ? await uploadTextArtifact(`exports/${Date.now()}-${filename}`, csv, "text/csv; charset=utf-8") : null;
    return new Response(csv, {
      headers: {
        "content-disposition": `attachment; filename="${filename}"`,
        "content-type": "text/csv; charset=utf-8",
        "x-blob-upload-requested": String(uploadRequested),
        ...(blobUrl ? { "x-blob-url": blobUrl } : {})
      }
    });
  }

  const exportPayload = {
    generatedAt,
    total: rows.length,
    filters: {
      q: firstParam(url, "q") ?? null,
      category: firstParam(url, "category") ?? null,
      status: parseStatus(firstParam(url, "status")) ?? null,
      risk: parseRisk(firstParam(url, "risk")) ?? null,
      type: parseType(firstParam(url, "type")) ?? null,
      useCase: firstParam(url, "useCase") ?? null
    },
    resources: rows
  };
  const blobUrl = uploadRequested
    ? await uploadTextArtifact(`exports/${Date.now()}-${filename}`, JSON.stringify(exportPayload, null, 2), "application/json; charset=utf-8")
    : null;

  return NextResponse.json(
    {
      ...exportPayload,
      uploadRequested,
      blobUrl
    },
    {
      headers: {
        "content-disposition": `attachment; filename="${filename}"`
      }
    }
  );
}
