import { NextResponse } from "next/server";
import { createDoctorReport, renderDoctorReport, uploadDoctorReport } from "@/lib/doctor";
import { getClientIp } from "@/lib/api-security";
import { rateLimit } from "@/lib/rate-limit";

function parseJsonField(value: unknown) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return JSON.parse(trimmed) as unknown;
}

function parseEnvFiles(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const limit = await rateLimit({
    key: `doctor:${clientIp}`,
    limit: 30,
    windowMs: 60 * 60 * 1000
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many doctor requests. Try again later." },
      {
        status: 429,
        headers: {
          "x-ratelimit-remaining": String(limit.remaining),
          "x-ratelimit-reset": String(limit.resetAt)
        }
      }
    );
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) {
    return NextResponse.json({ error: "JSON body is required." }, { status: 400 });
  }

  try {
    const report = await createDoctorReport({
      projectRoot: typeof payload.projectRoot === "string" && payload.projectRoot.trim() ? payload.projectRoot.trim() : "web-input",
      packageJson: parseJsonField(payload.packageJson) as never,
      projectConfig: parseJsonField(payload.projectConfigJson),
      appJson: parseJsonField(payload.appJson),
      envFiles: parseEnvFiles(payload.envFiles),
      gitignoreText: typeof payload.gitignoreText === "string" ? payload.gitignoreText : null
    });

    const markdown = renderDoctorReport(report);
    const uploadRequested = payload.uploadReport === true;
    const blobUrl = uploadRequested ? await uploadDoctorReport(report, markdown) : null;

    return NextResponse.json(
      { report, markdown, blobUrl, uploadRequested },
      {
        headers: {
          "x-ratelimit-remaining": String(limit.remaining),
          "x-ratelimit-reset": String(limit.resetAt)
        }
      }
    );
  } catch {
    return NextResponse.json({ error: "Invalid JSON input." }, { status: 400 });
  }
}
