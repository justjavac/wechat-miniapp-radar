import { NextResponse } from "next/server";
import { createAdvisorAnswerWithAi } from "@/lib/ai-advisor";
import { getAiConfig } from "@/lib/ai-config";
import { createAdvisorCacheKey, getCachedAdvisorAnswer, setCachedAdvisorAnswer } from "@/lib/advisor-cache";
import { persistAdvisorSession } from "@/lib/advisor-store";
import { validateAdvisorAnswer } from "@/lib/ai-output-validation";
import { getClientIp } from "@/lib/api-security";
import { rateLimit } from "@/lib/rate-limit";
import { getResources } from "@/lib/resources";

export const preferredRegion = "hkg1";

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
  const aiConfig = getAiConfig();
  const cacheVariant = aiConfig.configured ? `ai:${aiConfig.provider}:${aiConfig.apiUrl}:${aiConfig.model}:${aiConfig.fallbackModel}` : "rules";
  const cacheKey = createAdvisorCacheKey(question, resources.length, cacheVariant);
  const cachedAnswer = await getCachedAdvisorAnswer(cacheKey);

  if (cachedAnswer && validateAdvisorAnswer(cachedAnswer, resources).ok) {
    return NextResponse.json(
      { ...cachedAnswer, source: aiConfig.configured ? "ai" : "rules", cached: true, persisted: false },
      {
        headers: {
          "x-advisor-cache": "hit",
          "x-advisor-source": aiConfig.configured ? "ai" : "rules",
          "x-ratelimit-remaining": String(limit.remaining),
          "x-ratelimit-reset": String(limit.resetAt)
        }
      }
    );
  }

  const generated = await createAdvisorAnswerWithAi(question, resources);
  const answer = generated.answer;
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

  const cacheStored = generated.cacheable ? await setCachedAdvisorAnswer(cacheKey, answer) : false;
  const persisted = await persistAdvisorSession(answer).catch(() => false);

  return NextResponse.json(
    {
      ...answer,
      source: generated.source,
      model: generated.model,
      fallbackUsed: generated.fallbackUsed,
      fallbackReason: generated.fallbackReason,
      cached: false,
      cacheStored,
      persisted
    },
    {
      headers: {
        "x-advisor-cache": cacheStored ? "stored" : "skip",
        "x-advisor-source": generated.source,
        ...(generated.model ? { "x-advisor-model": generated.model } : {}),
        ...(generated.fallbackUsed ? { "x-advisor-fallback": "true" } : {}),
        "x-ratelimit-remaining": String(limit.remaining),
        "x-ratelimit-reset": String(limit.resetAt)
      }
    }
  );
}
