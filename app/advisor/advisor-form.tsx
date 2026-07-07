"use client";

import { useState } from "react";
import { Bot, LoaderCircle, Send } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface AdvisorResponse {
  question: string;
  recommendation: string;
  fitConditions: string[];
  reasons: string[];
  risks: string[];
  alternatives: Array<{ resourceId: string; title: string; url: string; reason: string; status: string; riskLevel: string }>;
  validationChecklist: string[];
  evidence: Array<{ resourceId: string; title: string; url: string; type: string; label: string }>;
}

export function AdvisorForm() {
  const [question, setQuestion] = useState("React 团队做电商小程序，后续可能上 H5，应该选 Taro 还是原生？");
  const [answer, setAnswer] = useState<AdvisorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!question.trim()) {
      setError("请输入选型问题。");
      return;
    }

    setLoading(true);
    setError("");
    setAnswer(null);
    try {
      const response = await fetch("/api/advisor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question })
      });
      if (!response.ok) throw new Error("Advisor request failed");
      setAnswer((await response.json()) as AdvisorResponse);
    } catch {
      setError("暂时无法生成建议，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-lg border border-border bg-surface p-4 shadow-radar">
        <label className="block text-sm font-semibold" htmlFor="advisor-question">
          选型问题
        </label>
        <textarea
          className="focus-ring mt-2 min-h-44 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-base leading-7 outline-none"
          id="advisor-question"
          onChange={(event) => setQuestion(event.target.value)}
          value={question}
        />
        {error ? <p className="mt-2 text-sm text-danger" role="alert">{error}</p> : null}
        <Button className="mt-4 w-full" disabled={loading} onClick={submit} type="button" aria-busy={loading}>
          {loading ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Send aria-hidden="true" className="h-4 w-4" />}
          {loading ? "生成中" : "生成建议"}
        </Button>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-radar" aria-live="polite">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Bot aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="font-bold">Advisor 输出</h2>
        </div>
        {answer ? (
          <div className="mt-4 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">推荐结论</h3>
              <p className="mt-1 text-lg font-bold">{answer.recommendation}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">理由</h3>
              <ul className="mt-2 space-y-2 text-sm leading-6">
                {answer.reasons.map((item) => (
                  <li className="rounded-md bg-muted px-3 py-2" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">适用条件</h3>
              <ul className="mt-2 space-y-2 text-sm leading-6">
                {answer.fitConditions.map((item) => (
                  <li className="rounded-md bg-muted px-3 py-2" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">主要风险</h3>
              <ul className="mt-2 space-y-2 text-sm leading-6">
                {answer.risks.map((item) => (
                  <li className="rounded-md bg-muted px-3 py-2" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">替代方案</h3>
              <div className="mt-2 grid gap-2">
                {answer.alternatives.map((item) => (
                  <Link className="focus-ring rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" href={`/resources/${item.resourceId}`} key={item.resourceId}>
                    <span className="font-semibold">{item.title}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {item.status} · {item.riskLevel}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.reason}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">验证清单</h3>
              <ul className="mt-2 space-y-2 text-sm leading-6">
                {answer.validationChecklist.map((item) => (
                  <li className="rounded-md bg-muted px-3 py-2" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground">证据来源</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {answer.evidence.map((item) => (
                  <div className="rounded-md border border-border px-3 py-2 text-xs" key={item.resourceId}>
                    <Link className="focus-ring font-semibold hover:text-primary" href={`/resources/${item.resourceId}`}>
                      {item.title}
                    </Link>
                    <a className="focus-ring mt-1 block text-muted-foreground hover:text-primary" href={item.url} rel="noreferrer" target="_blank">
                      {item.label} · 外部证据
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm leading-6 text-muted-foreground">当前是规则生成的 Advisor 原型。后续接入模型 API 后，会基于本地资源库、评分和证据生成更完整的自然语言建议。</p>
        )}
      </section>
    </div>
  );
}
