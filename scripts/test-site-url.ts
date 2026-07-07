import assert from "node:assert/strict";
import { absoluteUrl, getSiteUrl } from "@/lib/site-url";

const envKeys = [
  "NEXT_PUBLIC_SITE_URL",
  "SITE_URL",
  "DEPLOYMENT_BASE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL"
];

const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function clearSiteUrlEnv() {
  for (const key of envKeys) delete process.env[key];
}

function restoreEnv() {
  clearSiteUrlEnv();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value !== undefined) process.env[key] = value;
  }
}

try {
  clearSiteUrlEnv();
  assert.equal(getSiteUrl(), "https://miniprogram-radar.vercel.app");

  process.env.VERCEL_URL = "preview-miniprogram-radar.vercel.app/";
  assert.equal(getSiteUrl(), "https://preview-miniprogram-radar.vercel.app");

  process.env.VERCEL_PROJECT_PRODUCTION_URL = "miniprogram-radar.example.com/";
  assert.equal(getSiteUrl(), "https://miniprogram-radar.example.com");

  process.env.DEPLOYMENT_BASE_URL = "http://127.0.0.1:3100/";
  assert.equal(getSiteUrl(), "http://127.0.0.1:3100");

  process.env.SITE_URL = "https://radar.example.com/";
  assert.equal(getSiteUrl(), "https://radar.example.com");

  process.env.NEXT_PUBLIC_SITE_URL = "https://public-radar.example.com/";
  assert.equal(getSiteUrl(), "https://public-radar.example.com");
  assert.equal(absoluteUrl("/radar"), "https://public-radar.example.com/radar");
  assert.equal(absoluteUrl("weekly"), "https://public-radar.example.com/weekly");

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        cases: 7,
        assertions: [
          "default site url",
          "vercel url fallback",
          "production url fallback",
          "deployment url precedence",
          "site url precedence",
          "public site url precedence",
          "absolute url joining"
        ]
      },
      null,
      2
    )
  );
} finally {
  restoreEnv();
}
