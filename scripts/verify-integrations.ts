import { getTextArtifact, putTextArtifact } from "@/lib/blob-storage";
import { describeUpstashRedisEnvRequirement, hasUpstashRedis, upstashCommand } from "@/lib/upstash";

type CheckStatus = "pass" | "warn" | "fail";

interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

const checks: CheckResult[] = [];

function record(name: string, status: CheckStatus, detail: string) {
  checks.push({ name, status, detail });
}

function expected(name: string) {
  return process.env[`EXPECT_${name}`] === "1";
}

function missing(name: string, envNames: string[]) {
  record(
    `integration:${name.toLowerCase()}`,
    expected(name) ? "fail" : "warn",
    `${envNames.join(", ")} ${envNames.length === 1 ? "is" : "are"} not configured.`
  );
}

async function verifyBlob() {
  const configured = Boolean(process.env.EDGEONE_PROJECT_ID && process.env.EDGEONE_API_TOKEN);

  if (!configured) {
    missing("BLOB", ["EDGEONE_PROJECT_ID", "EDGEONE_API_TOKEN"]);
    return;
  }

  if (process.env.VERIFY_BLOB_WRITE !== "1") {
    record(
      "integration:blob",
      "pass",
      "EdgeOne Blob credentials are configured. Set VERIFY_BLOB_WRITE=1 to run a write probe."
    );
    return;
  }

  const pathname = `integration-check/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
  const content = `miniprogram-radar integration check ${new Date().toISOString()}\n`;

  await putTextArtifact(pathname, content, "text/plain; charset=utf-8");
  const readBack = await getTextArtifact(pathname);

  record(
    "integration:blob",
    readBack === content ? "pass" : "fail",
    readBack === content
      ? `Blob write/read probe succeeded for ${pathname}.`
      : `Blob write/read probe returned unexpected content for ${pathname}.`
  );
}

async function verifyRedis() {
  if (!hasUpstashRedis()) {
    record(
      "integration:upstash_redis",
      expected("UPSTASH_REDIS") ? "fail" : "warn",
      `Configure ${describeUpstashRedisEnvRequirement()}.`
    );
    return;
  }

  const pong = await upstashCommand<string>(["PING"]);
  record("integration:upstash_redis", pong === "PONG" ? "pass" : "fail", `PING returned ${String(pong)}.`);
}

async function verifyGitHub() {
  if (!process.env.GITHUB_TOKEN) {
    missing("GITHUB", ["GITHUB_TOKEN"]);
    return;
  }

  const response = await fetch("https://api.github.com/rate_limit", {
    headers: {
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "user-agent": "miniprogram-radar"
    },
    signal: AbortSignal.timeout(15_000)
  });

  if (!response.ok) {
    record("integration:github", "fail", `GitHub rate limit probe failed with HTTP ${response.status}.`);
    return;
  }

  const payload = (await response.json()) as {
    rate?: {
      limit?: number;
      remaining?: number;
      reset?: number;
    };
  };
  record(
    "integration:github",
    "pass",
    `GitHub API token is valid. Remaining ${payload.rate?.remaining ?? "unknown"} / ${payload.rate?.limit ?? "unknown"}.`
  );
}

try {
  await verifyGitHub();
} catch (error) {
  record("integration:github", "fail", error instanceof Error ? error.message : String(error));
}

try {
  await verifyBlob();
} catch (error) {
  record("integration:blob", "fail", error instanceof Error ? error.message : String(error));
}

try {
  await verifyRedis();
} catch (error) {
  record("integration:upstash_redis", "fail", error instanceof Error ? error.message : String(error));
}

const summary = {
  pass: checks.filter((check) => check.status === "pass").length,
  warn: checks.filter((check) => check.status === "warn").length,
  fail: checks.filter((check) => check.status === "fail").length
};

console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      summary,
      checks
    },
    null,
    2
  )
);

if (summary.fail > 0) {
  process.exitCode = 1;
}
