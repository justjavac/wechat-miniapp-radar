import { hasUpstashRedis, upstashCommand } from "@/lib/upstash";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function memoryRateLimit({
  key,
  limit,
  windowMs
}: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: bucket.resetAt
    };
  }

  current.count += 1;
  return {
    allowed: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt
  };
}

async function redisRateLimit({
  key,
  limit,
  windowMs
}: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const redisKey = `ratelimit:${key}`;
  const count = Number(await upstashCommand<number>(["INCR", redisKey]));

  if (count === 1) {
    await upstashCommand<string>(["PEXPIRE", redisKey, windowMs]);
  }

  const ttl = Number(await upstashCommand<number>(["PTTL", redisKey]));
  const resetAt = Date.now() + Math.max(ttl, 0);

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt
  };
}

export async function rateLimit(options: { key: string; limit: number; windowMs: number }) {
  if (hasUpstashRedis()) {
    try {
      return await redisRateLimit(options);
    } catch {
      return memoryRateLimit(options);
    }
  }

  return memoryRateLimit(options);
}
