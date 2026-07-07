import { randomUUID } from "node:crypto";
import { hasUpstashRedis, upstashCommand } from "@/lib/upstash";

export interface TaskLock {
  acquired: boolean;
  enabled: boolean;
  key: string;
  error?: string;
  release: () => Promise<void>;
}

export async function acquireTaskLock(key: string, ttlMs: number): Promise<TaskLock> {
  const redisKey = `lock:${key}`;
  if (!hasUpstashRedis()) {
    return {
      acquired: true,
      enabled: false,
      key: redisKey,
      release: async () => {}
    };
  }

  const token = randomUUID();

  try {
    const result = await upstashCommand<string>(["SET", redisKey, token, "NX", "PX", ttlMs]);

    if (result !== "OK") {
      return {
        acquired: false,
        enabled: true,
        key: redisKey,
        release: async () => {}
      };
    }

    return {
      acquired: true,
      enabled: true,
      key: redisKey,
      release: async () => {
        await upstashCommand<number>([
          "EVAL",
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          redisKey,
          token
        ]).catch(() => null);
      }
    };
  } catch (error) {
    return {
      acquired: true,
      enabled: false,
      key: redisKey,
      error: error instanceof Error ? error.message : String(error),
      release: async () => {}
    };
  }
}
