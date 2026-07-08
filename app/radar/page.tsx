import { RadarExplorer } from "@/components/radar-explorer";
import { StatStrip } from "@/components/stat-strip";
import { getCategories, getResources, getStats, getUseCases } from "@/lib/resources";

export const metadata = {
  title: "Radar | 小程序雷达"
};

export const dynamic = "force-dynamic";

export default async function RadarPage() {
  const resources = await getResources();
  const categories = getCategories(resources);
  const useCases = getUseCases(resources);
  const stats = getStats(resources);

  return (
    <div className="space-y-8">
      <section className="max-w-4xl">
        <p className="text-sm font-semibold text-primary">Radar</p>
        <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">小程序技术雷达</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          按推荐状态、风险等级、资源类型、分类和适用场景筛选小程序生态资源。雷达判断来自资源库、采集信号、规则评分和可校验的摘要证据。
        </p>
      </section>
      <StatStrip stats={stats} />
      <RadarExplorer categories={categories} resources={resources} useCases={useCases} />
    </div>
  );
}
