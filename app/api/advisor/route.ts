import { NextResponse } from "next/server";
import { createAdvisorAnswer } from "@/lib/advisor";
import { createAdvisorCacheKey, getCachedAdvisorAnswer, setCachedAdvisorAnswer } from "@/lib/advisor-cache";
import { persistAdvisorSession } from "@/lib/advisor-store";
import { validateAdvisorAnswer } from "@/lib/ai-output-validation";
import { getClientIp } from "@/lib/api-security";
import { rateLimit } from "@/lib/rate-limit";
import { getResources } from "@/lib/resources";

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const limit = await rateLimit({
    key: `advisor:${clientIp}`,
    limit: 20,
    windowMs: 60 * 60 * 1000
  });

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many advisor requests. Try again later." },
      {
        status: 429,
        headers: {
          "x-ratelimit-remaining": String(limit.remaining),
          "x-ratelimit-reset": String(limit.resetAt)
        }
      }
    );
  }

  const payload = (await request.json().catch(() => ({}))) as { question?: unknown };
  const question = typeof payload.question === "string" ? payload.question.trim() : "";

  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const resources = await getResources();
  const cacheKey = createAdvisorCacheKey(question, resources.length);
  const cachedAnswer = await getCachedAdvisorAnswer(cacheKey);

  if (cachedAnswer && validateAdvisorAnswer(cachedAnswer, resources).ok) {
    return NextResponse.json(
      { ...cachedAnswer, cached: true, persisted: false },
      {
        headers: {
          "x-advisor-cache": "hit",
          "x-ratelimit-remaining": String(limit.remaining),
          "x-ratelimit-reset": String(limit.resetAt)
        }
      }
    );
  }

  const answer = createAdvisorAnswer(question, resources);
  const validation = validateAdvisorAnswer(answer, resources);
  if (!validation.ok) {
    return NextResponse.json(
      {
        error: "Advisor answer validation failed.",
        details: validation.errors
      },
      { status: 500 }
    );
  }

  const cacheStored = await setCachedAdvisorAnswer(cacheKey, answer);
  const persisted = await persistAdvisorSession(answer).catch(() => false);

  return NextResponse.json(
    { ...answer, cached: false, cacheStored, persisted },
    {
      headers: {
        "x-advisor-cache": cacheStored ? "stored" : "skip",
        "x-ratelimit-remaining": String(limit.remaining),
        "x-ratelimit-reset": String(limit.resetAt)
      }
    }
  );
}
