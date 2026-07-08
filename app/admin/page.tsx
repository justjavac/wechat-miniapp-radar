import Link from "next/link";
import { cookies } from "next/headers";
import { Activity, AlertTriangle, CheckCircle2, Database, FileClock, KeyRound, ListChecks, Lock, Radio, ScrollText, ShieldCheck, UploadCloud, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ResourceMaintenanceForm, type EditableResource } from "@/app/admin/resource-maintenance-form";
import { ADMIN_SESSION_COOKIE, isAdminConfigured, isAdminTokenValid } from "@/lib/admin-auth";
import { getHealthCheck } from "@/lib/health";
import { getRecentOperationLogs } from "@/lib/operation-log";
import { buildProductionReadiness, summarizeProductionReadiness, type ProductionReadinessStatus } from "@/lib/production-readiness";
import { getCategories, getResources, getStats } from "@/lib/resources";
import { getScoreSnapshot } from "@/lib/score-snapshot";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams?: Promise<{
    auth?: string | string[];
  }>;
};

const adminEndpoints = [
  { method: "GET", path: "/api/health", purpose: "部署健康检查" },
  { method: "GET", path: "/api/resources", purpose: "资源列表 API" },
  { method: "GET", path: "/api/export/resources?upload=1", purpose: "受保护资源快照上传" },
  { method: "GET", path: "/api/weekly", purpose: "生态周报 API" },
  { method: "GET", path: "/weekly.xml", purpose: "生态周报 RSS" },
  { method: "GET", path: "/api/admin/readiness", purpose: "受保护生产就绪清单" },
  { method: "PATCH", path: "/api/admin/resources/[id]", purpose: "资源雷达字段维护" },
  { method: "GET", path: "/api/cron/enrich", purpose: "每日采集任务" },
  { method: "GET", path: "/api/cron/weekly", purpose: "每周周报任务" }
];

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return <Badge variant={enabled ? "adopt" : "assess"}>{enabled ? "已配置" : "未配置"}</Badge>;
}

function HealthBadge({ ok }: { ok: boolean }) {
  return <Badge variant={ok ? "adopt" : "hold"}>{ok ? "正常" : "异常"}</Badge>;
}

function ReadinessBadge({ status }: { status: ProductionReadinessStatus }) {
  const labels: Record<ProductionReadinessStatus, string> = {
    ready: "就绪",
    missing: "待配置",
    optional: "可选"
  };
  const variants: Record<ProductionReadinessStatus, "adopt" | "assess" | "hold"> = {
    ready: "adopt",
    missing: "hold",
    optional: "assess"
  };
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

function maintenanceHref(resourceId: string) {
  const params = new URLSearchParams();
  params.set("resource", resourceId);
  return `/admin?${params.toString()}#resource-maintenance`;
}

function exportSnapshotHref() {
  const params = new URLSearchParams({
    format: "json",
    upload: "1"
  });
  return `/api/export/resources?${params.toString()}`;
}

function UnauthorizedAdmin({ authFailed }: { authFailed: boolean }) {
  return (
    <div className="mx-auto max-w-2xl space-y-5 py-12">
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Lock aria-hidden="true" className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-3xl font-black">Admin 需要授权</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          生产环境需要配置 `ADMIN_TOKEN` 并通过受保护入口访问。当前页面不会暴露运维数据。
        </p>
        {authFailed ? <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">Admin token 无效。</p> : null}
      </div>
      <form action="/api/admin/session" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row" method="post">
        <label className="sr-only" htmlFor="admin-token">
          Admin token
        </label>
        <input
          className="focus-ring min-h-11 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none"
          id="admin-token"
          name="token"
          placeholder="ADMIN_TOKEN"
          type="password"
        />
        <button className={buttonVariants()} type="submit">
          验证
        </button>
      </form>
    </div>
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const authFailed = firstValue(params?.auth) === "failed";
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!isAdminTokenValid(token)) {
    return <UnauthorizedAdmin authFailed={authFailed} />;
  }

  const [health, resources, operationLogs, scoreSnapshot] = await Promise.all([
    getHealthCheck(),
    getResources(),
    getRecentOperationLogs(12),
    getScoreSnapshot()
  ]);
  const stats = getStats(resources);
  const categories = getCategories(resources);
  const configuredIntegrations =
    Number(health.integrations.openai) +
    Number(health.integrations.github) +
    Number(health.integrations.cronSecret) +
    Number(health.integrations.adminToken) +
    Number(health.integrations.blob) +
    Number(health.integrations.upstashRedis) +
    Number(health.integrations.siteUrl) +
    Number(health.database.configured);
  const productionReadiness = buildProductionReadiness(health);
  const readinessSummary = summarizeProductionReadiness(productionReadiness);
  const scoreReviewItems =
    scoreSnapshot?.scores
      .filter((score) => score.riskLevel === "high" || score.status === "hold" || score.status === "assess")
      .sort((a, b) => {
        const priority = (score: (typeof scoreSnapshot.scores)[number]) =>
          Number(score.riskLevel === "high") * 4 + Number(score.status === "hold") * 3 + Number(score.status === "assess");
        return priority(b) - priority(a) || a.title.localeCompare(b.title, "zh-CN");
      })
      .slice(0, 8) ?? [];
  const editableResources: EditableResource[] = resources
    .map((resource) => ({
      id: resource.id,
      title: resource.title,
      status: resource.radar.status,
      maintainStatus: resource.radar.maintainStatus,
      riskLevel: resource.radar.riskLevel,
      summary: resource.radar.summary
    }))
    .sort((a, b) => {
      const priority = (resource: EditableResource) => Number(resource.riskLevel === "high") * 2 + Number(resource.status === "assess");
      return priority(b) - priority(a) || a.title.localeCompare(b.title, "zh-CN");
    });

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex min-h-8 items-center gap-2 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-primary" />
            Admin Console
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">运维控制台</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            查看部署健康、资源规模、集成配置和关键任务入口，并在数据库环境下维护资源雷达字段。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className={buttonVariants({ variant: "secondary", size: "sm" })} href={exportSnapshotHref()}>
            <UploadCloud aria-hidden="true" className="h-4 w-4" />
            资源快照
          </a>
          <HealthBadge ok={health.ok} />
          <Badge>{isAdminConfigured() ? "Token 保护" : "本地开发模式"}</Badge>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <span className="text-sm font-semibold text-muted-foreground">资源总数</span>
            <Database aria-hidden="true" className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{stats.total}</p>
            <p className="mt-1 text-xs text-muted-foreground">{categories.length} 个分类</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <span className="text-sm font-semibold text-muted-foreground">推荐资源</span>
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{stats.adopt}</p>
            <p className="mt-1 text-xs text-muted-foreground">可优先评估</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <span className="text-sm font-semibold text-muted-foreground">高风险资源</span>
            <AlertTriangle aria-hidden="true" className="h-4 w-4 text-danger" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{stats.highRisk}</p>
            <p className="mt-1 text-xs text-muted-foreground">需要迁移或谨慎使用</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <span className="text-sm font-semibold text-muted-foreground">集成配置</span>
            <KeyRound aria-hidden="true" className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{configuredIntegrations}/8</p>
            <p className="mt-1 text-xs text-muted-foreground">AI、GitHub、Cron、Admin、Blob、Redis、站点 URL、数据库</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <h2 className="font-bold">服务健康</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">资源读取</span>
              <HealthBadge ok={health.resources.count > 0} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">数据库连接</span>
              <HealthBadge ok={!health.database.configured || health.database.connected} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">数据库配置</span>
              <StatusBadge enabled={health.database.configured} />
            </div>
            {health.database.error ? (
              <p className="rounded-md bg-danger/10 px-3 py-2 text-xs leading-5 text-danger">{health.database.error}</p>
            ) : null}
            <p className="pt-2 text-xs text-muted-foreground">检查时间：{new Date(health.checkedAt).toLocaleString("zh-CN")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-bold">外部集成</h2>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <span>AI Provider</span>
              <StatusBadge enabled={health.integrations.openai} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <span>GitHub Token</span>
              <StatusBadge enabled={health.integrations.github} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <span>Cron Secret</span>
              <StatusBadge enabled={health.integrations.cronSecret} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <span>Admin Token</span>
              <StatusBadge enabled={health.integrations.adminToken} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <span>Vercel Blob</span>
              <StatusBadge enabled={health.integrations.blob} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 sm:col-span-2">
              <span>Upstash Redis</span>
              <StatusBadge enabled={health.integrations.upstashRedis} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 sm:col-span-2">
              <span>Site URL</span>
              <StatusBadge enabled={health.integrations.siteUrl} />
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListChecks aria-hidden="true" className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-bold">生产就绪清单</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  按 Vercel 上线顺序汇总缺失配置、验证命令和降级状态。真实 AI 保持可选，用户确认后再进入严格验收。
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={readinessSummary.missing === 0 ? "adopt" : "assess"}>
                {readinessSummary.ready}/{readinessSummary.total} 就绪
              </Badge>
              {readinessSummary.missing > 0 ? <Badge variant="hold">{readinessSummary.missing} 待配置</Badge> : null}
              {readinessSummary.optional > 0 ? <Badge variant="assess">{readinessSummary.optional} 可选</Badge> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-3">
            {productionReadiness.map((item) => (
              <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm" key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                  <ReadinessBadge status={item.status} />
                </div>
                <p className="mt-3 text-xs leading-5">{item.action}</p>
                {item.command ? <code className="mt-2 block break-all rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{item.command}</code> : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileClock aria-hidden="true" className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-bold">静态快照</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                检查规则摘要、评分快照和周报索引是否已生成。数据库或外部服务不可用时，这些快照用于降级展示。
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-md border border-border px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">AI 摘要</span>
              <StatusBadge enabled={health.snapshots.aiSummaries.present && health.snapshots.aiSummaries.count > 0} />
            </div>
            <p className="mt-2 text-2xl font-black">{health.snapshots.aiSummaries.count}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {health.snapshots.aiSummaries.mode ?? "unknown"} ·{" "}
              {health.snapshots.aiSummaries.generatedAt ? new Date(health.snapshots.aiSummaries.generatedAt).toLocaleString("zh-CN") : "未生成"}
            </p>
          </div>
          <div className="rounded-md border border-border px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">评分快照</span>
              <StatusBadge enabled={health.snapshots.radarScores.present && health.snapshots.radarScores.count > 0} />
            </div>
            <p className="mt-2 text-2xl font-black">{health.snapshots.radarScores.count}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {health.snapshots.radarScores.generatedAt ? new Date(health.snapshots.radarScores.generatedAt).toLocaleString("zh-CN") : "未生成"}
            </p>
          </div>
          <div className="rounded-md border border-border px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">周报索引</span>
              <StatusBadge enabled={health.snapshots.weekly.present && health.snapshots.weekly.historyCount > 0} />
            </div>
            <p className="mt-2 text-2xl font-black">{health.snapshots.weekly.historyCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {health.snapshots.weekly.latestId ?? "no latest"} ·{" "}
              {health.snapshots.weekly.generatedAt ? new Date(health.snapshots.weekly.generatedAt).toLocaleString("zh-CN") : "未生成"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">评分复核</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                展示自动评分中最需要人工复核的高风险和需评估资源。进入生产数据库后，维护表单可用于修正这些结论。
              </p>
            </div>
            {scoreSnapshot ? (
              <span className="font-mono text-xs text-muted-foreground">{new Date(scoreSnapshot.generatedAt).toLocaleString("zh-CN")}</span>
            ) : (
              <Badge variant="assess">无快照</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {scoreReviewItems.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border">
              {scoreReviewItems.map((score) => (
                <div
                  className="grid gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0 lg:grid-cols-[minmax(0,1fr)_180px_minmax(0,1.4fr)_88px]"
                  key={score.id}
                >
                  <Link className="focus-ring rounded-sm font-semibold hover:text-primary" href={`/resources/${score.id}`}>
                    {score.title}
                  </Link>
                  <span className="flex flex-wrap gap-2">
                    <Badge variant={score.status === "hold" ? "hold" : score.status === "assess" ? "assess" : score.status === "trial" ? "trial" : "adopt"}>
                      {score.status}
                    </Badge>
                    <Badge variant={score.riskLevel === "high" ? "risk-high" : score.riskLevel === "medium" ? "risk-medium" : "risk-low"}>
                      {score.riskLevel}
                    </Badge>
                  </span>
                  <span className="min-w-0 text-xs leading-5 text-muted-foreground">
                    {score.reasons.length > 0 ? score.reasons.slice(0, 2).join("；") : "暂无评分理由"}
                  </span>
                  <Link className={buttonVariants({ variant: "secondary", size: "sm" })} href={maintenanceHref(score.id)}>
                    <Wrench aria-hidden="true" className="h-4 w-4" />
                    维护
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-6 text-sm text-muted-foreground">
              暂无可复核的评分项。运行 `npm run score` 后会生成 `public/api/radar-scores.json`。
            </p>
          )}
        </CardContent>
      </Card>

      <Card id="resource-maintenance">
        <CardHeader>
          <div>
            <h2 className="font-bold">资源维护</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              人工复核自动评分结果。保存会调用受保护 API；未配置数据库时会返回不可用提示，不会修改 YAML。
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <ResourceMaintenanceForm resources={editableResources} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ScrollText aria-hidden="true" className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-bold">运行记录</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                数据库环境下会记录采集、周报和后台任务结果；未配置数据库时这里保持为空。
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {operationLogs.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border">
              {operationLogs.map((entry) => (
                <div className="grid gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0 lg:grid-cols-[150px_120px_minmax(0,1fr)]" key={entry.id}>
                  <span className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString("zh-CN")}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant={entry.level === "error" ? "hold" : entry.level === "warn" ? "assess" : "adopt"}>{entry.level}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">{entry.scope}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{entry.message}</span>
                    {Object.keys(entry.metadata).length > 0 ? (
                      <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                        {JSON.stringify(entry.metadata)}
                      </code>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-6 text-sm text-muted-foreground">
              暂无运行记录。配置 `DATABASE_URL` 后，Cron 和后台任务会写入这里。
            </p>
          )}
        </CardContent>
      </Card>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Radio aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-black">运维端点</h2>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-radar">
          <div className="grid grid-cols-[88px_minmax(0,1fr)_minmax(0,1fr)] border-b border-border bg-muted px-4 py-3 text-xs font-semibold text-muted-foreground">
            <span>方法</span>
            <span>路径</span>
            <span>用途</span>
          </div>
          {adminEndpoints.map((endpoint) => (
            <div className="grid grid-cols-[88px_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0" key={endpoint.path}>
              <span className="font-mono text-xs font-bold text-primary">{endpoint.method}</span>
              <code className="break-all rounded bg-muted px-2 py-1 text-xs">{endpoint.path}</code>
              <span className="text-muted-foreground">{endpoint.purpose}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm leading-6 text-muted-foreground">
          <p className="font-semibold text-foreground">资源维护 API</p>
          <p className="mt-2">
            `PATCH /api/admin/resources/[id]` 需要 `Authorization: Bearer ADMIN_TOKEN` 或 `x-admin-token`，并且仅在配置 `DATABASE_URL`
            后生效。当前支持维护 `status`、`maintainStatus`、`riskLevel` 和 `summary`，用于人工复核自动评分结果。
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">可试用</p>
            <p className="mt-2 text-2xl font-black">{stats.trial}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">需评估</p>
            <p className="mt-2 text-2xl font-black">{stats.assess}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">不建议</p>
            <p className="mt-2 text-2xl font-black">{stats.hold}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">健康状态</p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-black">
              <Activity aria-hidden="true" className="h-5 w-5 text-primary" />
              {health.ok ? "OK" : "FAIL"}
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
