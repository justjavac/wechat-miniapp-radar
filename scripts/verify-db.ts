import postgres from "postgres";

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

if (!process.env.DATABASE_URL) {
  record(
    "env:DATABASE_URL",
    process.env.EXPECT_DATABASE === "1" ? "fail" : "warn",
    "DATABASE_URL is not configured."
  );
} else {
  record("env:DATABASE_URL", "pass", "DATABASE_URL is configured.");
  const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

  try {
    async function countTable(tableName: string) {
      const [row] = await client.unsafe<{ count: number }[]>(`select count(*)::int as count from ${tableName}`);
      return Number(row?.count ?? 0);
    }

    async function checkTableExists(tableName: string) {
      const count = await countTable(tableName);
      record(`table:${tableName}`, "pass", `${count} rows.`);
      return count;
    }

    const resourceCount = await checkTableExists("resources");
    record(
      "data:resources-imported",
      resourceCount > 0 ? "pass" : "fail",
      `${resourceCount} resources found. Run npm run db:import after migrations if this is 0.`
    );

    await checkTableExists("resource_alternatives");
    await checkTableExists("resource_signals");
    await checkTableExists("resource_scores");
    await checkTableExists("resource_ai_summaries");
    await checkTableExists("weekly_reports");
    await checkTableExists("advisor_sessions");
    await checkTableExists("operation_logs");
  } catch (error) {
    record("database:query", "fail", error instanceof Error ? error.message : String(error));
  } finally {
    await client.end();
  }
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
