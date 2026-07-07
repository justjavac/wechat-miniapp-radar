"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Save } from "lucide-react";
import { maintainLabels, riskLabels, statusLabels } from "@/components/resource-labels";
import { Button } from "@/components/ui/button";
import type { MaintainStatus, RadarStatus, RiskLevel } from "@/lib/resources";

export interface EditableResource {
  id: string;
  title: string;
  status: RadarStatus;
  maintainStatus: MaintainStatus;
  riskLevel: RiskLevel;
  summary: string;
}

const statusOptions = Object.entries(statusLabels) as Array<[RadarStatus, string]>;
const maintainOptions = Object.entries(maintainLabels) as Array<[MaintainStatus, string]>;
const riskOptions = Object.entries(riskLabels) as Array<[RiskLevel, string]>;

function resolveSelectedResourceId(resources: EditableResource[], requestedId: string | null) {
  if (requestedId && resources.some((resource) => resource.id === requestedId)) return requestedId;
  return resources[0]?.id ?? "";
}

export function ResourceMaintenanceForm({ resources }: { resources: EditableResource[] }) {
  const searchParams = useSearchParams();
  const requestedResourceId = searchParams.get("resource");
  const initialSelectedId = resolveSelectedResourceId(resources, requestedResourceId);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const selected = useMemo(() => resources.find((resource) => resource.id === selectedId) ?? resources[0], [resources, selectedId]);
  const [status, setStatus] = useState<RadarStatus>(selected?.status ?? "assess");
  const [maintainStatus, setMaintainStatus] = useState<MaintainStatus>(selected?.maintainStatus ?? "unknown");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(selected?.riskLevel ?? "medium");
  const [summary, setSummary] = useState(selected?.summary ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function changeSelected(id: string) {
    const next = resources.find((resource) => resource.id === id);
    if (!next) return;

    setSelectedId(next.id);
    setStatus(next.status);
    setMaintainStatus(next.maintainStatus);
    setRiskLevel(next.riskLevel);
    setSummary(next.summary);
    setMessage(null);
  }

  useEffect(() => {
    const nextId = resolveSelectedResourceId(resources, requestedResourceId);
    if (!requestedResourceId || nextId === selectedId) return;
    changeSelected(nextId);
  }, [requestedResourceId, resources, selectedId]);

  async function submit() {
    if (!selected) return;

    setLoading(true);
    setMessage(null);

    const token = searchParams.get("token");
    const response = await fetch(`/api/admin/resources/${selected.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...(token ? { "x-admin-token": token } : {})
      },
      body: JSON.stringify({
        status,
        maintainStatus,
        riskLevel,
        summary
      })
    }).catch(() => null);

    setLoading(false);

    if (!response) {
      setMessage({ type: "error", text: "请求失败，请检查网络或服务状态。" });
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setMessage({ type: "error", text: payload.error ?? "资源维护失败。" });
      return;
    }

    setMessage({ type: "success", text: "资源雷达字段已更新。" });
  }

  if (!selected) {
    return <p className="text-sm text-muted-foreground">暂无可维护资源。</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-3">
        <label className="block text-sm font-semibold" htmlFor="resource-id">
          资源
        </label>
        <select
          className="focus-ring min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none"
          id="resource-id"
          onChange={(event) => changeSelected(event.target.value)}
          value={selected.id}
        >
          {resources.map((resource) => (
            <option key={resource.id} value={resource.id}>
              {resource.title}
            </option>
          ))}
        </select>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm font-semibold">
            推荐状态
            <select
              className="focus-ring mt-2 min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal outline-none"
              onChange={(event) => setStatus(event.target.value as RadarStatus)}
              value={status}
            >
              {statusOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold">
            维护状态
            <select
              className="focus-ring mt-2 min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal outline-none"
              onChange={(event) => setMaintainStatus(event.target.value as MaintainStatus)}
              value={maintainStatus}
            >
              {maintainOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold">
            风险等级
            <select
              className="focus-ring mt-2 min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal outline-none"
              onChange={(event) => setRiskLevel(event.target.value as RiskLevel)}
              value={riskLevel}
            >
              {riskOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-semibold" htmlFor="resource-summary">
          摘要
        </label>
        <textarea
          className="focus-ring min-h-32 w-full resize-y rounded-md border border-border bg-background px-3 py-3 text-sm leading-6 outline-none"
          id="resource-summary"
          onChange={(event) => setSummary(event.target.value)}
          value={summary}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={loading} onClick={submit} type="button">
            <Save aria-hidden="true" className="h-4 w-4" />
            {loading ? "保存中" : "保存"}
          </Button>
          {message ? (
            <p className={message.type === "success" ? "text-sm font-medium text-primary" : "text-sm font-medium text-danger"} role="status">
              {message.text}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
