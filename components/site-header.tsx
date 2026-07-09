import Link from "next/link";
import { Activity, ClipboardCheck, GitCompareArrows, Newspaper, Radar, Search, ShieldCheck } from "lucide-react";
import { GitHubIcon } from "@/components/github-icon";
import { QuickSearch } from "@/components/quick-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { GITHUB_REPOSITORY_URL } from "@/lib/site-links";

const navItems = [
  { href: "/radar", label: "雷达", title: "Radar", icon: Radar },
  { href: "/compare", label: "对比", title: "Compare", icon: GitCompareArrows },
  { href: "/advisor", label: "顾问", title: "Advisor", icon: Search },
  { href: "/doctor", label: "体检", title: "Doctor", icon: ClipboardCheck },
  { href: "/weekly", label: "周报", title: "Weekly", icon: Newspaper },
  { href: "/admin", label: "管理", title: "Admin", icon: ShieldCheck }
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/92 backdrop-blur">
      <a className="focus-ring sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2" href="#main-content">
        跳到主要内容
      </a>
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link className="focus-ring flex min-h-11 items-center gap-2 rounded-md" href="/">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-foreground text-background">
            <Activity aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block whitespace-nowrap text-sm font-bold leading-5">小程序雷达</span>
            <span className="hidden text-xs text-muted-foreground sm:block">MiniProgram Radar</span>
          </span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <nav aria-label="主导航" className="flex items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                href={item.href}
                key={item.href}
                title={item.title}
                aria-label={item.label}
              >
                <item.icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="shrink-0">
            <QuickSearch />
          </div>
          <a
            aria-label="GitHub"
            className="focus-ring inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-foreground transition-colors hover:bg-muted"
            href={GITHUB_REPOSITORY_URL}
            rel="noreferrer"
            target="_blank"
            title="GitHub"
          >
            <GitHubIcon aria-hidden="true" className="h-4 w-4" />
          </a>
          <div className="shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
