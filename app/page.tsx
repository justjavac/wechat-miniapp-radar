import Link from "next/link";
import { ArrowRight, Bot, Radar, ScanSearch } from "lucide-react";
import { RadarExplorer } from "@/components/radar-explorer";
import { StatStrip } from "@/components/stat-strip";
import { buttonVariants } from "@/components/ui/button";
import { getCategories, getResources, getStats, getUseCases } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const resources = await getResources();
  const stats = getStats(resources);
  const categories = getCategories(resources);
  const useCases = getUseCases(resources);

  return (
    <div className="space-y-8">
      <section className="hero-field relative overflow-hidden rounded-lg border border-border px-4 py-5 shadow-radar sm:px-6 sm:py-7 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-center lg:gap-8 lg:p-8">
        <div className="space-y-6">
          <div className="inline-flex min-h-8 items-center gap-2 rounded-md border border-border bg-surface/80 px-3 text-xs font-semibold text-muted-foreground">
            <Radar aria-hidden="true" className="h-4 w-4 text-primary" />
            AI 驱动的小程序生态选型与风险评估工具
          </div>
          <div className="max-w-3xl">
            <h1 className="text-4xl font-black leading-tight text-foreground sm:text-5xl">
              小程序雷达
              <span className="mt-2 block text-2xl font-black text-primary sm:text-3xl">把链接清单变成技术判断</span>
            </h1>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              面向小程序框架、组件库、SDK 和工程工具，给出推荐状态、风险等级、维护状态、替代方案和证据来源。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className={buttonVariants()} href="/radar">
              查看雷达
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <Link className={buttonVariants({ variant: "secondary" })} href="/advisor">
              <Bot aria-hidden="true" className="h-4 w-4" />
              选型顾问
            </Link>
          </div>
          <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
            {[
              ["资源", stats.total],
              ["推荐", stats.adopt],
              ["高风险", stats.highRisk]
            ].map(([label, value]) => (
              <div className="hero-metric" key={label}>
                <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                <p className="mt-1 font-mono text-2xl font-black text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 lg:mt-0">
          <div className="hero-radar" aria-label="Radar 信号概览">
            <div className="hero-radar-summary">
              <p className="text-xs font-semibold text-muted-foreground">Radar signal</p>
              <h2 className="mt-2 text-xl font-bold">从数据、证据到选型建议</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                每个资源都关联状态、风险、适用场景和替代方案，方便快速定位可采用与需迁移的项目。
              </p>
            </div>
            <div className="hero-radar-stage">
              <div className="hero-sweep" aria-hidden="true" />
              <div className="hero-node">
                <ScanSearch aria-hidden="true" className="h-8 w-8" />
              </div>
              <span className="signal-chip signal-chip-one">推荐方案</span>
              <span className="signal-chip signal-chip-two" data-tone="warn">
                需评估
              </span>
              <span className="signal-chip signal-chip-three" data-tone="danger">
                迁移风险
              </span>
            </div>
          </div>
        </div>
      </section>

      <StatStrip stats={stats} />
      <RadarExplorer categories={categories} limit={12} resources={resources} useCases={useCases} />
    </div>
  );
}
