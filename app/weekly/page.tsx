import Link from "next/link";
import { ArrowRight, Rss } from "lucide-react";
import { ResourceCard } from "@/components/resource-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCount } from "@/lib/utils";
import { getScoreSnapshot } from "@/lib/score-snapshot";
import { createWeeklyReport, getWeeklyHistory, readLatestWeeklyReport } from "@/lib/weekly";

export const metadata = {
  title: "Weekly | 小程序雷达"
};

export const dynamic = "force-dynamic";

export default async function WeeklyPage() {
  const snapshot = (await readLatestWeeklyReport()) ?? (await createWeeklyReport());
  const [scoreSnapshot, weeklyHistory] = await Promise.all([getScoreSnapshot(), getWeeklyHistory(12)]);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold text-primary">Weekly</p>
          <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">生态周报</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            周报基于资源库、评分结果和采集信号生成 Markdown 与 JSON 快照。Vercel Cron 可定期触发生成，并在配置数据库后写入 `weekly_reports`。
          </p>
        </div>
        <Link className={buttonVariants({ variant: "secondary" })} href="/weekly.xml">
          <Rss aria-hidden="true" className="h-4 w-4" />
          RSS
        </Link>
      </section>

      <section className="grid gap-5">
        <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
          <h2 className="text-xl font-bold">推荐关注</h2>
          <span className="font-mono text-xs text-muted-foreground">{new Date(snapshot.generatedAt).toLocaleString("zh-CN")}</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.highlights.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      </section>

      {snapshot.signalDigest ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Signal Digest</h2>
              <span className="font-mono text-xs text-muted-foreground">{snapshot.signalDigest.source}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {snapshot.signalDigest.signals.slice(0, 8).map((signal) => (
                <Link
                  className="focus-ring grid gap-2 rounded-md border border-border px-4 py-3 text-sm hover:bg-muted md:grid-cols-[110px_minmax(0,1fr)]"
                  href={`/resources/${signal.resourceId}`}
                  key={`${signal.kind}-${signal.resourceId}`}
                >
                  <span className="font-mono text-xs font-semibold uppercase text-primary">{signal.kind}</span>
                  <span>
                    <span className="block font-semibold">{signal.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{signal.message}</span>
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xl font-bold">风险提醒</h2>
          <div className="grid gap-3">
            {snapshot.risks.map((resource) => (
              <Link className="focus-ring flex min-h-12 items-center justify-between rounded-md border border-border bg-surface px-4 text-sm font-semibold hover:bg-muted" href={`/resources/${resource.id}`} key={resource.id}>
                {resource.title}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-xl font-bold">需要评估</h2>
          <div className="grid gap-3">
            {snapshot.needsAssessment.map((resource) => (
              <Link className="focus-ring flex min-h-12 items-center justify-between rounded-md border border-border bg-surface px-4 text-sm font-semibold hover:bg-muted" href={`/resources/${resource.id}`} key={resource.id}>
                {resource.title}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">历史周报</h2>
            <span className="text-xs text-muted-foreground">{weeklyHistory.length} 份快照</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {weeklyHistory.map((report) => (
              <Link
                className="focus-ring grid gap-3 rounded-md border border-border px-4 py-3 text-sm hover:bg-muted md:grid-cols-[minmax(0,1fr)_auto]"
                href={`/weekly/${report.id}.md`}
                key={report.id}
              >
                <span>
                  <span className="block font-semibold">{report.title}</span>
                  <span className="mt-1 block font-mono text-xs text-muted-foreground">{new Date(report.generatedAt).toLocaleString("zh-CN")}</span>
                </span>
                <span className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                  <span>总量 {formatCount(report.stats.total)}</span>
                  <span>推荐 {formatCount(report.stats.adopt)}</span>
                  <span>评估 {formatCount(report.stats.assess)}</span>
                  <span>高风险 {formatCount(report.stats.highRisk)}</span>
                </span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {scoreSnapshot ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">评分快照</h2>
              <span className="font-mono text-xs text-muted-foreground">{new Date(scoreSnapshot.generatedAt).toLocaleString("zh-CN")}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border border-border bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">资源总量</div>
                <div className="mt-2 font-mono text-2xl font-semibold">{formatCount(scoreSnapshot.stats.total)}</div>
              </div>
              <div className="rounded-md border border-border bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">推荐采用</div>
                <div className="mt-2 font-mono text-2xl font-semibold">{formatCount(scoreSnapshot.stats.adopt)}</div>
              </div>
              <div className="rounded-md border border-border bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">需要评估</div>
                <div className="mt-2 font-mono text-2xl font-semibold">{formatCount(scoreSnapshot.stats.assess)}</div>
              </div>
              <div className="rounded-md border border-border bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">高风险</div>
                <div className="mt-2 font-mono text-2xl font-semibold">{formatCount(scoreSnapshot.stats.highRisk)}</div>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {scoreSnapshot.scores
                .filter((score) => score.riskLevel === "high")
                .slice(0, 5)
                .map((score) => (
                  <Link className="focus-ring flex min-h-11 items-center justify-between gap-3 rounded-md border border-border px-3 text-sm hover:bg-muted" href={`/resources/${score.id}`} key={score.id}>
                    <span className="font-semibold">{score.title}</span>
                    <span className="text-xs text-muted-foreground">{score.reasons[0] ?? "需要复核"}</span>
                  </Link>
                ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
