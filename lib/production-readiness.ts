import type { HealthCheck } from "@/lib/health";

export type ProductionReadinessStatus = "ready" | "missing" | "optional";

export interface ProductionReadinessItem {
  id: string;
  title: string;
  status: ProductionReadinessStatus;
  detail: string;
  action: string;
  command?: string;
}

function item(input: ProductionReadinessItem): ProductionReadinessItem {
  return input;
}

export function buildProductionReadiness(health: HealthCheck): ProductionReadinessItem[] {
  const snapshotsReady =
    health.snapshots.aiSummaries.present &&
    health.snapshots.aiSummaries.count > 0 &&
    health.snapshots.radarScores.present &&
    health.snapshots.radarScores.count > 0 &&
    health.snapshots.weekly.present &&
    health.snapshots.weekly.historyCount > 0;

  return [
    item({
      id: "preview-approval",
      title: "Preview 人工确认",
      status: "optional",
      detail: "PR Preview 需要人工查看页面、交互和移动端表现后再合并到 main。",
      action: "确认 Preview 无误后，将 PR 标记 ready 并合并到 main，再等待 Vercel Production 部署。"
    }),
    item({
      id: "site-url",
      title: "站点 URL",
      status: health.integrations.siteUrl ? "ready" : "missing",
      detail: health.integrations.siteUrl ? "生产 canonical URL 已配置。" : "缺少 SITE_URL 或 NEXT_PUBLIC_SITE_URL。",
      action: "在 Vercel Production 环境变量中配置站点根地址。",
      command: "npm run site-url:test"
    }),
    item({
      id: "database",
      title: "Postgres 主库",
      status: health.database.configured && health.database.connected ? "ready" : "missing",
      detail: health.database.configured
        ? health.database.connected
          ? "数据库已配置且连接正常。"
          : `数据库已配置但连接失败：${health.database.error ?? "unknown error"}`
        : "缺少 DATABASE_URL，当前只能使用静态 JSON 降级。",
      action: "创建 Neon 或 Supabase Postgres，配置 DATABASE_URL 后执行迁移和导入。",
      command: "npm run db:migrate && npm run db:import && EXPECT_DATABASE=1 npm run db:verify"
    }),
    item({
      id: "admin-token",
      title: "Admin 保护",
      status: health.integrations.adminToken ? "ready" : "missing",
      detail: health.integrations.adminToken ? "Admin Token 已配置。" : "缺少 ADMIN_TOKEN，生产后台不能放开访问。",
      action: "配置 ADMIN_TOKEN，并只通过受保护入口访问 /admin。",
      command: "npm run admin-api:test"
    }),
    item({
      id: "cron-secret",
      title: "Cron 保护",
      status: health.integrations.cronSecret ? "ready" : "missing",
      detail: health.integrations.cronSecret ? "Cron Secret 已配置。" : "缺少 CRON_SECRET，无法安全触发采集和周报任务。",
      action: "配置 CRON_SECRET，并用 dry-run 验证 /api/cron/enrich 和 /api/cron/weekly。",
      command: "VERIFY_CRON_SECRET=<CRON_SECRET> npm run deployment:verify -- <production-url>"
    }),
    item({
      id: "github-token",
      title: "GitHub 采集额度",
      status: health.integrations.github ? "ready" : "missing",
      detail: health.integrations.github ? "GitHub Token 已配置。" : "缺少 GITHUB_TOKEN，采集会受匿名额度限制。",
      action: "配置 GITHUB_TOKEN，用于每日 GitHub 信号采集。",
      command: "EXPECT_GITHUB=1 npm run integrations:verify"
    }),
    item({
      id: "redis",
      title: "Redis 缓存和任务锁",
      status: health.integrations.upstashRedis ? "ready" : "missing",
      detail: health.integrations.upstashRedis ? "Upstash Redis 已配置。" : "缺少 Upstash Redis，Advisor 缓存和 Cron 分布式锁只能降级。",
      action: "配置 UPSTASH_REDIS_REST_URL 和 UPSTASH_REDIS_REST_TOKEN。",
      command: "EXPECT_UPSTASH_REDIS=1 npm run integrations:verify"
    }),
    item({
      id: "blob",
      title: "Blob 快照存储",
      status: health.integrations.blob ? "ready" : "missing",
      detail: health.integrations.blob ? "Vercel Blob 已配置。" : "缺少 BLOB_READ_WRITE_TOKEN，周报、Doctor 和导出快照不会上传。",
      action: "创建 Vercel Blob Store 并配置 BLOB_READ_WRITE_TOKEN。",
      command: "EXPECT_BLOB=1 VERIFY_BLOB_WRITE=1 npm run integrations:verify"
    }),
    item({
      id: "snapshots",
      title: "静态降级快照",
      status: snapshotsReady ? "ready" : "missing",
      detail: snapshotsReady ? "资源、AI 摘要、评分和周报快照可用于降级展示。" : "缺少一个或多个静态快照。",
      action: "重新生成资源、AI 摘要、评分和周报快照。",
      command: "npm run generate && npm run ai:summarize -- --no-persist && npm run score -- --write && npm run weekly -- --write"
    }),
    item({
      id: "openai",
      title: "真实 AI",
      status: health.integrations.openai ? "ready" : "optional",
      detail: health.integrations.openai ? "OPENAI_API_KEY 已配置，真实 AI 可进入严格验收。" : "真实 AI 暂未启用，当前使用规则结果和 prompt contract。",
      action: "用户确认启用后，只在服务端环境变量中配置 OPENAI_API_KEY。",
      command: "EXPECT_OPENAI=1 npm run mvp:check -- <production-url>"
    })
  ];
}

export function summarizeProductionReadiness(items: ProductionReadinessItem[]) {
  return {
    ready: items.filter((item) => item.status === "ready").length,
    missing: items.filter((item) => item.status === "missing").length,
    optional: items.filter((item) => item.status === "optional").length,
    total: items.length
  };
}
