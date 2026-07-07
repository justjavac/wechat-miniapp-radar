"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { CornerDownRight, Search, X } from "lucide-react";
import { statusLabels, riskLabels } from "@/components/resource-labels";
import { Button } from "@/components/ui/button";

interface SearchResource {
  id: string;
  title: string;
  description: string;
  category: string;
  radar: {
    status: keyof typeof statusLabels;
    riskLevel: keyof typeof riskLabels;
  };
}

interface SearchResponse {
  resources?: SearchResource[];
}

const commandLinks = [
  { href: "/radar?status=adopt", label: "推荐资源", description: "优先评估的框架、组件和工具" },
  { href: "/radar?risk=high", label: "高风险资源", description: "需要迁移或谨慎采用的项目" },
  { href: "/compare", label: "方案对比", description: "对比 Taro、uni-app、原生小程序等方案" },
  { href: "/advisor", label: "选型顾问", description: "输入业务场景生成建议" },
  { href: "/doctor", label: "项目体检", description: "扫描小程序项目风险" }
];

function cleanTitle(title: string) {
  return title.replace(/\s*★.*$/, "");
}

export function QuickSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [resources, setResources] = useState<SearchResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const trimmedQuery = query.trim();

  const openSearch = useCallback(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }, []);

  const closeSearch = useCallback((restoreFocus = true) => {
    setOpen(false);
    setLoading(false);
    setSearchError("");
    if (!restoreFocus) return;
    window.setTimeout(() => {
      const previousFocus = previousFocusRef.current;
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
        return;
      }
      triggerRef.current?.focus();
    }, 0);
  }, []);

  function onBackdropClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) closeSearch();
  }

  function onDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])")
    ).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
      if (event.key === "Escape" && open) closeSearch();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeSearch, open, openSearch]);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!trimmedQuery) {
      setResources([]);
      setLoading(false);
      setSearchError("");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setSearchError("");
    setResources([]);
    const timeout = window.setTimeout(async () => {
      const params = new URLSearchParams({ q: trimmedQuery, limit: "6" });
      const response = await fetch(`/api/resources?${params.toString()}`, { signal: controller.signal }).catch(() => null);
      if (!response?.ok) {
        if (!controller.signal.aborted) {
          setResources([]);
          setSearchError("搜索暂时不可用，请稍后重试。");
          setLoading(false);
        }
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as SearchResponse;
      if (!controller.signal.aborted) {
        setResources(payload.resources ?? []);
        setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [open, trimmedQuery]);

  const visibleCommands = useMemo(() => {
    if (!trimmedQuery) return commandLinks;
    const normalized = trimmedQuery.toLowerCase();
    return commandLinks.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(normalized));
  }, [trimmedQuery]);

  return (
    <>
      <Button aria-label="快速搜索" onClick={openSearch} ref={triggerRef} size="sm" type="button" variant="secondary">
        <Search aria-hidden="true" className="h-4 w-4" />
        <span className="hidden md:inline">快速搜索</span>
        <span className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground lg:inline">Ctrl K</span>
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-background/75 p-4 backdrop-blur-sm" onClick={onBackdropClick} role="presentation">
          <div
            className="mx-auto mt-16 max-w-2xl overflow-hidden rounded-lg border border-border bg-surface shadow-radar"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="快速搜索"
            aria-busy={loading}
            onKeyDown={onDialogKeyDown}
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Search aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
              <input
                className="min-h-11 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索 Taro、云开发、组件库或输入命令"
                ref={inputRef}
                type="search"
                value={query}
                aria-label="搜索资源或命令"
                aria-describedby="quick-search-status"
              />
              <button className="focus-ring min-h-11 min-w-11 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => closeSearch()} type="button" aria-label="关闭快速搜索">
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-2">
              <div className="sr-only" id="quick-search-status" role="status">
                {loading ? "正在搜索资源" : searchError || (trimmedQuery ? `找到 ${resources.length} 个资源` : "显示常用命令")}
              </div>
              {loading ? <p className="px-3 py-4 text-sm text-muted-foreground">正在搜索资源...</p> : null}
              {searchError ? <p className="px-3 py-4 text-sm text-danger" role="alert">{searchError}</p> : null}
              {resources.length > 0 ? (
                <div className="py-2">
                  <p className="px-3 pb-2 text-xs font-semibold text-muted-foreground">资源</p>
                  {resources.map((resource) => (
                    <Link
                      className="focus-ring grid gap-1 rounded-md px-3 py-2 hover:bg-muted"
                      href={`/resources/${resource.id}`}
                      key={resource.id}
                      onClick={() => closeSearch(false)}
                    >
                      <span className="font-semibold">{cleanTitle(resource.title)}</span>
                      <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">{resource.description}</span>
                      <span className="text-xs text-muted-foreground">
                        {resource.category} · {statusLabels[resource.radar.status]} · {riskLabels[resource.radar.riskLevel]}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : trimmedQuery && !loading && !searchError ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">没有匹配的资源。</p>
              ) : null}

              <div className="py-2">
                <p className="px-3 pb-2 text-xs font-semibold text-muted-foreground">命令</p>
                {visibleCommands.length > 0 ? (
                  visibleCommands.map((item) => (
                    <Link className="focus-ring flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted" href={item.href} key={item.href} onClick={() => closeSearch(false)}>
                      <CornerDownRight aria-hidden="true" className="h-4 w-4 text-primary" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{item.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="px-3 py-4 text-sm text-muted-foreground">没有匹配的命令。</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
