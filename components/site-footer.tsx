import Link from "next/link";
import { Activity, ExternalLink, Rss } from "lucide-react";
import { GitHubIcon } from "@/components/github-icon";
import { GITHUB_REPOSITORY_URL } from "@/lib/site-links";

const productLinks = [
  { href: "/radar", label: "雷达" },
  { href: "/compare", label: "对比" },
  { href: "/advisor", label: "顾问" },
  { href: "/doctor", label: "体检" },
  { href: "/weekly", label: "周报" }
];

const dataLinks = [
  { href: "/api/resources", label: "Resources API" },
  { href: "/api/weekly", label: "Weekly API" },
  { href: "/weekly.xml", label: "RSS" }
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background/92">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:px-8">
        <div className="max-w-xl">
          <Link className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md" href="/">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-foreground text-background">
              <Activity aria-hidden="true" className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-bold">小程序雷达</span>
              <span className="text-xs text-muted-foreground">MiniProgram Radar</span>
            </span>
          </Link>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">AI 驱动的小程序生态选型与风险评估工具。</p>
          <p className="mt-4 font-mono text-xs text-muted-foreground">© {year} MiniProgram Radar</p>
        </div>

        <nav aria-label="产品入口" className="grid gap-2 text-sm">
          <p className="text-xs font-semibold text-muted-foreground">产品</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 lg:grid lg:gap-2">
            {productLinks.map((item) => (
              <Link className="focus-ring rounded-sm text-muted-foreground hover:text-foreground" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <nav aria-label="开放链接" className="grid gap-2 text-sm">
          <p className="text-xs font-semibold text-muted-foreground">开放</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 lg:grid lg:gap-2">
            {dataLinks.map((item) => (
              <Link className="focus-ring inline-flex items-center gap-1 rounded-sm text-muted-foreground hover:text-foreground" href={item.href} key={item.href}>
                {item.label === "RSS" ? <Rss aria-hidden="true" className="h-3.5 w-3.5" /> : null}
                {item.label}
              </Link>
            ))}
            <a
              className="focus-ring inline-flex items-center gap-1 rounded-sm text-muted-foreground hover:text-foreground"
              href={GITHUB_REPOSITORY_URL}
              rel="noreferrer"
              target="_blank"
            >
              <GitHubIcon aria-hidden="true" className="h-3.5 w-3.5" />
              GitHub
              <ExternalLink aria-hidden="true" className="h-3 w-3" />
            </a>
          </div>
        </nav>
      </div>
    </footer>
  );
}
