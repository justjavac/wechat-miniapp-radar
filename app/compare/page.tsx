import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { maintainLabels, riskLabels, statusLabels } from "@/components/resource-labels";
import { buildCompareInsights, getCompareResources } from "@/lib/resources";

export const metadata = {
  title: "Compare | 小程序雷达"
};

export default async function ComparePage() {
  const resources = await getCompareResources();
  const insights = buildCompareInsights(resources);

  return (
    <div className="space-y-6">
      <section className="max-w-4xl">
        <p className="text-sm font-semibold text-primary">Compare</p>
        <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">核心方案对比</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">把核心框架放在同一组规则下比较，先看适用场景、风险和验证项，再进入具体资源详情。</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3" aria-label="选型结论">
        {insights.slice(0, 6).map((insight) => (
          <Card key={insight.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={resources.find((resource) => resource.id === insight.id)?.radar.status ?? "default"}>
                  {statusLabels[resources.find((resource) => resource.id === insight.id)?.radar.status ?? "assess"]}
                </Badge>
                <h2 className="text-base font-bold">{insight.title}</h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6">
              <p className="font-semibold">{insight.recommendation}</p>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">适合</p>
                <p className="mt-1 text-muted-foreground">{insight.bestFor.slice(0, 3).join("、")}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">主要取舍</p>
                <ul className="mt-1 space-y-1 text-muted-foreground">
                  {insight.tradeoffs.slice(0, 2).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">验证重点</p>
                <p className="mt-1 text-muted-foreground">{insight.validationChecklist[0]}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">证据来源</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {insight.evidence.slice(0, 2).map((evidence) => (
                    <a
                      className="focus-ring rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-muted"
                      href={evidence.url}
                      key={evidence.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {evidence.label}
                    </a>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="overflow-hidden">
        <CardHeader>
          <h2 className="text-base font-bold">框架选型矩阵</h2>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">方案</th>
                <th className="px-4 py-3">推荐状态</th>
                <th className="px-4 py-3">风险</th>
                <th className="px-4 py-3">维护状态</th>
                <th className="px-4 py-3">适用场景</th>
                <th className="px-4 py-3">替代方案</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((resource) => (
                <tr className="border-t border-border align-top" key={resource.id}>
                  <td className="px-4 py-4">
                    <div className="font-semibold">{resource.title}</div>
                    <div className="mt-1 max-w-sm text-muted-foreground">{resource.description}</div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={resource.radar.status}>{statusLabels[resource.radar.status]}</Badge>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={`risk-${resource.radar.riskLevel}`}>{riskLabels[resource.radar.riskLevel]}</Badge>
                  </td>
                  <td className="px-4 py-4">{maintainLabels[resource.radar.maintainStatus]}</td>
                  <td className="px-4 py-4">{resource.radar.useCases.join("、")}</td>
                  <td className="px-4 py-4">{resource.radar.alternatives.join("、") || "暂无"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
