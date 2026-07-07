import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { statusLabels, riskLabels, typeLabels, maintainLabels } from "@/components/resource-labels";
import type { RadarResource } from "@/lib/resources";

export function ResourceCard({ resource }: { resource: RadarResource }) {
  return (
    <Card className="transition-colors hover:border-primary/40">
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={resource.radar.status}>{statusLabels[resource.radar.status]}</Badge>
          <Badge variant={`risk-${resource.radar.riskLevel}`}>{riskLabels[resource.radar.riskLevel]}</Badge>
          <Badge>{typeLabels[resource.radar.type]}</Badge>
          <span className="text-xs text-muted-foreground">{maintainLabels[resource.radar.maintainStatus]}</span>
        </div>

        <div className="min-w-0">
          <Link className="focus-ring group inline-flex items-start gap-2 rounded-md text-base font-bold leading-6 hover:text-primary" href={`/resources/${resource.id}`}>
            <span>{resource.title}</span>
            <ArrowUpRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{resource.radar.summary}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            <span className="font-semibold text-foreground">替代方案：</span>
            {resource.radar.alternatives.length > 0 ? resource.radar.alternatives.slice(0, 3).join("、") : "暂无明确替代方案"}
          </p>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
          <span>{resource.section ?? resource.category}</span>
          <a className="focus-ring inline-flex min-h-8 items-center gap-1 rounded-md hover:text-primary" href={resource.url} rel="noreferrer" target="_blank">
            来源
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
