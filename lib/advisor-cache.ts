import { createHash } from "node:crypto";
import type { AdvisorAnswer } from "@/lib/advisor";
import { hasUpstashRedis, upstashCommand } from "@/lib/upstash";

const ADVISOR_CACHE_TTL_SECONDS = 60 * 60 * 24;
const ADVISOR_CACHE_SCHEMA_VERSION = "v3";

function normalizeQuestion(question: string) {
  return question.trim().replace(/\s+/g, " ").toLowerCase();
}

export function createAdvisorCacheKey(question: string, resourceCount: number) {
  const digest = createHash("sha256")
    .update(`${ADVISOR_CACHE_SCHEMA_VERSION}:${normalizeQuestion(question)}:${resourceCount}`)
    .digest("hex");
  return `advisor:${ADVISOR_CACHE_SCHEMA_VERSION}:${digest}`;
}

export async function getCachedAdvisorAnswer(key: string): Promise<AdvisorAnswer | null> {
  if (!hasUpstashRedis()) return null;

  try {
    const cached = await upstashCommand<string>(["GET", key]);
    if (!cached) return null;
    return JSON.parse(cached) as AdvisorAnswer;
  } catch {
    return null;
  }
}

export async function setCachedAdvisorAnswer(key: string, answer: AdvisorAnswer) {
  if (!hasUpstashRedis()) return false;

  try {
    await upstashCommand<string>(["SET", key, JSON.stringify(answer), "EX", ADVISOR_CACHE_TTL_SECONDS]);
    return true;
  } catch {
    return false;
  }
}
