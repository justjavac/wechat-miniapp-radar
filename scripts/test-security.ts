import assert from "node:assert/strict";
import { getAdminTokenFromRequest, isAdminRequestAuthorized, isAdminTokenValid } from "@/lib/admin-auth";
import { getClientIp, isCronAuthorized } from "@/lib/api-security";
import { rateLimit } from "@/lib/rate-limit";

const originalEnv = {
  ADMIN_TOKEN: process.env.ADMIN_TOKEN,
  CRON_SECRET: process.env.CRON_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL
};

function setEnv(name: string, value: string) {
  process.env[name] = value;
}

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

try {
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;

  process.env.CRON_SECRET = "cron-secret";
  setEnv("NODE_ENV", "production");
  assert.equal(isCronAuthorized(new Request("https://example.com/api/cron/enrich")), false);
  assert.equal(
    isCronAuthorized(
      new Request("https://example.com/api/cron/enrich", {
        headers: { authorization: "Bearer cron-secret" }
      })
    ),
    true
  );
  assert.equal(isCronAuthorized(new Request("https://example.com/api/cron/enrich?secret=cron-secret")), true);

  delete process.env.CRON_SECRET;
  setEnv("NODE_ENV", "production");
  assert.equal(
    isCronAuthorized(
      new Request("https://example.com/api/cron/enrich", {
        headers: { "x-vercel-cron": "1" }
      })
    ),
    true
  );
  assert.equal(isCronAuthorized(new Request("https://example.com/api/cron/enrich")), false);

  setEnv("NODE_ENV", "development");
  assert.equal(isCronAuthorized(new Request("https://example.com/api/cron/enrich")), true);

  process.env.ADMIN_TOKEN = "admin-secret";
  setEnv("NODE_ENV", "production");
  assert.equal(isAdminTokenValid("admin-secret"), true);
  assert.equal(isAdminTokenValid("wrong"), false);
  assert.equal(
    getAdminTokenFromRequest(
      new Request("https://example.com/admin", {
        headers: { authorization: "Bearer admin-secret" }
      })
    ),
    "admin-secret"
  );
  assert.equal(
    isAdminRequestAuthorized(
      new Request("https://example.com/admin", {
        headers: { "x-admin-token": "admin-secret" }
      })
    ),
    true
  );
  assert.equal(isAdminRequestAuthorized(new Request("https://example.com/admin?token=admin-secret")), true);

  delete process.env.ADMIN_TOKEN;
  setEnv("NODE_ENV", "production");
  assert.equal(isAdminTokenValid(undefined), false);
  setEnv("NODE_ENV", "development");
  assert.equal(isAdminTokenValid(undefined), true);

  assert.equal(
    getClientIp(
      new Request("https://example.com/api/advisor", {
        headers: {
          "x-forwarded-for": "203.0.113.1, 198.51.100.2",
          "x-real-ip": "198.51.100.3"
        }
      })
    ),
    "203.0.113.1"
  );
  assert.equal(
    getClientIp(
      new Request("https://example.com/api/advisor", {
        headers: {
          "x-real-ip": "198.51.100.3"
        }
      })
    ),
    "198.51.100.3"
  );

  const rateLimitKey = `security-test:${Date.now()}:${Math.random()}`;
  const first = await rateLimit({ key: rateLimitKey, limit: 2, windowMs: 60_000 });
  const second = await rateLimit({ key: rateLimitKey, limit: 2, windowMs: 60_000 });
  const third = await rateLimit({ key: rateLimitKey, limit: 2, windowMs: 60_000 });
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        cases: [
          "cron secret",
          "vercel cron fallback",
          "admin token",
          "client ip",
          "memory rate limit"
        ]
      },
      null,
      2
    )
  );
} finally {
  restoreEnv();
}
