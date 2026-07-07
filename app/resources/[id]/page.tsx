import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { maintainLabels, riskLabels, statusLabels, typeLabels } from "@/components/resource-labels";
import { getResourceAiSummary } from "@/lib/ai-summaries";
import { findAlternativeResources, getResources, type MaintainStatus, type RadarStatus, type RiskLevel } from "@/lib/resources";
import { buildResourceTimeline } from "@/lib/resource-timeline";
import { getResourceScoreTrace } from "@/lib/score-trace";

function isRadarStatus(value: string): value is RadarStatus {
  return value === "adopt" || value === "trial" || value === "assess" || value === "hold";
}

function isRiskLevel(value: string): value is RiskLevel {
  return value === "low" || value === "medium" || value === "high";
}

function isMaintainStatus(value: string): value is MaintainStatus {
  return value === "active" || value === "low" || value === "stale" || value === "deprecated" || value === "unknown";
}

export async function generateStaticParams() {
  const resources = await getResources();
  return resources.map((resource) => ({ id: resource.id }));
}

export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resources = await getResources();
  const resource = resources.find((item) => item.id === id) ?? null;
  if (!resource) notFound();
  const [aiSummary, scoreTrace] = await Promise.all([getResourceAiSummary(resource.id), getResourceScoreTrace(resource.id)]);
  const alternativeResources = findAlternativeResources(resources, resource);
  const updateTimeline = buildResourceTimeline({ resource, aiSummary, scoreTrace, alternatives: alternativeResources });
  const traceStatus = scoreTrace && isRadarStatus(scoreTrace.status) ? scoreTrace.status : null;
  const traceRisk = scoreTrace && isRiskLevel(scoreTrace.riskLevel) ? scoreTrace.riskLevel : null;
  const traceMaintainStatus = scoreTrace && isMaintainStatus(scoreTrace.maintainStatus) ? scoreTrace.maintainStatus : null;

  return (
    <div className="space-y-6">
      <Link className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-semibold text-muted-foreground hover:text-foreground" href="/radar">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        返回雷达
      </Link>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant={resource.radar.status}>{statusLabels[resource.radar.status]}</Badge>
            <Badge variant={`risk-${resource.radar.riskLevel}`}>{riskLabels[resource.radar.riskLevel]}</Badge>
            <Badge>{typeLabels[resource.radar.type]}</Badge>
          </div>
          <div>
            <h1 className="text-3xl font-black leading-tight sm:text-4xl">{resource.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground">{resource.radar.summary}</p>
          </div>
          <a className={buttonVariants({ variant: "secondary" })} href={resource.url} rel="noreferrer" target="_blank">
            打开来源
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </a>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-base font-bold">雷达判断</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">维护状态</span>
              <span className="font-semibold">{maintainLabels[resource.radar.maintainStatus]}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">分类</span>
              <span className="font-semibold">{resource.section ?? resource.category}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">难度</span>
              <span className="font-semibold">{resource.metadata.difficulty}</span>
            </div>
          </CardContent>
        </Card>
      </section>

      {aiSummary ? (
        <Card>
          <CardHeader>
            <h2 className="text-base font-bold">AI 摘要</h2>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">推荐建议</p>
                <p className="mt-2 text-base font-semibold leading-7">{aiSummary.recommendation}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">风险说明</p>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
                  {aiSummary.riskNotes.map((note) => (
                    <li className="rounded-md border border-border bg-muted/50 px-3 py-2" key={note}>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">适用场景</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {aiSummary.useCases.map((item) => (
                      <Badge key={item}>{item}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">不推荐场景</p>
                  {aiSummary.notRecommendedFor.length > 0 ? (
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
                      {aiSummary.notRecommendedFor.map((item) => (
                        <li className="rounded-md border border-border bg-muted/50 px-3 py-2" key={item}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">暂无明确限制，仍需按项目约束验证。</p>
                  )}
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">证据引用</p>
              <div className="mt-2 grid gap-2">
                {aiSummary.evidenceRefs.map((evidence) => (
                  <a
                    className="focus-ring flex min-h-10 items-center justify-between gap-3 rounded-md border border-border px-3 text-sm hover:bg-muted"
                    href={evidence.url}
                    key={`${evidence.type}:${evidence.url}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span>{evidence.label}</span>
                    <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {scoreTrace ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold">评分追踪</h2>
              <span className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground">
                {scoreTrace.source === "database" ? "数据库信号" : "静态快照"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={traceStatus ?? "default"}>{traceStatus ? statusLabels[traceStatus] : scoreTrace.status}</Badge>
                <Badge variant={traceRisk ? `risk-${traceRisk}` : "default"}>{traceRisk ? riskLabels[traceRisk] : scoreTrace.riskLevel}</Badge>
                <Badge>{traceMaintainStatus ? maintainLabels[traceMaintainStatus] : scoreTrace.maintainStatus}</Badge>
              </div>
              <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
                {scoreTrace.reasons.map((reason) => (
                  <li className="rounded-md border border-border bg-muted/50 px-3 py-2" key={reason}>
                    {reason}
                  </li>
                ))}
              </ul>
              {scoreTrace.evidenceRefs.length > 0 ? (
                <div className="pt-1">
                  <p className="text-xs font-semibold text-muted-foreground">评分证据</p>
                  <div className="mt-2 grid gap-2">
                    {scoreTrace.evidenceRefs.map((evidence) => (
                      <a
                        className="focus-ring flex min-h-10 items-center justify-between gap-3 rounded-md border border-border px-3 text-sm hover:bg-muted"
                        href={evidence.url}
                        key={`${evidence.type}:${evidence.url}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <span>{evidence.label}</span>
                        <ExternalLink aria-hidden="true" className="h-4 w-4" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">评分时间</p>
                <p className="mt-1 font-mono">{scoreTrace.scoredAt ? new Date(scoreTrace.scoredAt).toLocaleString("zh-CN") : "未记录"}</p>
              </div>
              {scoreTrace.signal ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">原始信号</p>
                  <a className="focus-ring mt-2 flex min-h-10 items-center justify-between gap-3 rounded-md border border-border px-3 hover:bg-muted" href={scoreTrace.signal.url} rel="noreferrer" target="_blank">
                    <span>{scoreTrace.signal.source}</span>
                    <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  </a>
                </div>
              ) : (
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground">当前使用静态评分快照；配置数据库并运行采集后会显示原始采集信号。</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-base font-bold">更新记录</h2>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {updateTimeline.map((event) => (
              <li className="grid gap-2 rounded-md border border-border bg-muted/40 px-3 py-3 sm:grid-cols-[150px_minmax(0,1fr)]" key={event.id}>
                <time className="text-xs font-semibold text-muted-foreground" dateTime={event.occurredAt ?? undefined}>
                  {event.occurredAt ? new Date(event.occurredAt).toLocaleString("zh-CN") : "静态记录"}
                </time>
                <div>
                  <p className="text-sm font-bold">{event.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{event.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <h2 className="text-base font-bold">适用场景</h2>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {resource.radar.useCases.map((item) => (
                <li className="rounded-md border border-border bg-muted/50 px-3 py-2" key={item}>
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-bold">不推荐场景</h2>
          </CardHeader>
          <CardContent>
            {resource.radar.notRecommendedFor.length > 0 ? (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {resource.radar.notRecommendedFor.map((item) => (
                  <li className="rounded-md border border-border bg-muted/50 px-3 py-2" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">当前没有明确的不推荐场景，仍需结合项目复杂度和团队经验验证。</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-bold">替代方案</h2>
          </CardHeader>
          <CardContent>
            {alternativeResources.length > 0 ? (
              <div className="grid gap-2">
                {alternativeResources.map((item) => (
                  <Link className="focus-ring rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" href={`/resources/${item.id}`} key={item.id}>
                    <span className="font-semibold">{item.label}</span>
                    <span className="mt-1 block text-muted-foreground">{item.title}</span>
                  </Link>
                ))}
              </div>
            ) : resource.radar.alternatives.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {resource.radar.alternatives.map((item) => (
                  <Badge key={item}>{item}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">暂无明确替代方案。</p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <h2 className="text-base font-bold">证据来源</h2>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {resource.radar.evidence.map((evidence) => (
            <a className="focus-ring flex min-h-11 items-center justify-between gap-3 rounded-md border border-border px-3 text-sm hover:bg-muted" href={evidence.url} key={evidence.url} rel="noreferrer" target="_blank">
              <span>{evidence.label}</span>
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
