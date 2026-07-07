import { Activity, AlertTriangle, Database, ShieldCheck } from "lucide-react";
import type { ResourceStats } from "@/lib/resources";
import { formatCount } from "@/lib/utils";

const items = [
  { key: "total", label: "资源总量", icon: Database },
  { key: "adopt", label: "推荐采用", icon: ShieldCheck },
  { key: "assess", label: "需要评估", icon: Activity },
  { key: "highRisk", label: "高风险", icon: AlertTriangle }
] as const;

export function StatStrip({ stats }: { stats: ResourceStats }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="雷达统计">
      {items.map((item) => (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-radar" key={item.key}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <item.icon aria-hidden="true" className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3 font-mono text-3xl font-semibold">{formatCount(stats[item.key])}</div>
        </div>
      ))}
    </section>
  );
}
