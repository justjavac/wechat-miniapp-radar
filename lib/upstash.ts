interface UpstashResponse<T> {
  result?: T;
  error?: string;
}

export const UPSTASH_REDIS_ENV_PAIRS = [
  {
    label: "Upstash Redis REST",
    url: "UPSTASH_REDIS_REST_URL",
    token: "UPSTASH_REDIS_REST_TOKEN"
  }
] as const;

export function describeUpstashRedisEnvRequirement() {
  return UPSTASH_REDIS_ENV_PAIRS.map((pair) => `${pair.url}/${pair.token}`).join(" or ");
}

export function getUpstashRedisConfig() {
  for (const pair of UPSTASH_REDIS_ENV_PAIRS) {
    const url = process.env[pair.url];
    const token = process.env[pair.token];
    if (url && token) return { ...pair, url, token };
  }

  return null;
}

export function hasUpstashRedis() {
  return Boolean(getUpstashRedisConfig());
}

export async function upstashCommand<T>(command: Array<string | number>): Promise<T | null> {
  const config = getUpstashRedisConfig();
  if (!config) return null;

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(command)
  });

  if (!response.ok) {
    throw new Error(`Upstash request failed with ${response.status}`);
  }

  const payload = (await response.json()) as UpstashResponse<T>;
  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload.result ?? null;
}
