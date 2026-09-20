"use client";

import { useEffect, useState } from "react";
import { Panel, StatusBadge } from "@/components/ui/primitives";

interface AnalyticsData {
  totals: {
    conversations: number;
    ai: number;
    human: number;
    resolved: number;
    escalated: number;
    messages: number;
    resolutionRate: number | null;
    aiResolutionRate: number | null;
  };
  daily: { day: string; count: number }[];
  knowledgeSourceUsage: { id: string; name: string; type: string; chunkCount: number }[];
  recentUnanswered: { question: string; reason: string; createdAt: string }[];
}

const RANGES = [
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
];

export default function AnalyticsPage() {
  const [range, setRange] = useState("30");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/analytics/overview?range=${range}`)
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [range]);

  const maxDaily = data ? Math.max(1, ...data.daily.map((d) => d.count)) : 1;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">Analytics</h1>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-sm px-2.5 py-1 text-xs font-medium ${
                range === r.key ? "bg-signal-50 text-signal-700" : "text-muted hover:bg-paper"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Conversations" value={data.totals.conversations} />
            <Stat label="Resolution rate" value={data.totals.resolutionRate !== null ? `${data.totals.resolutionRate}%` : "—"} />
            <Stat label="AI resolution rate" value={data.totals.aiResolutionRate !== null ? `${data.totals.aiResolutionRate}%` : "—"} />
            <Stat label="Escalated" value={data.totals.escalated} />
          </div>

          <Panel className="p-5">
            <h2 className="text-sm font-semibold text-ink">Conversations per day</h2>
            {data.daily.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No conversations in this range yet.</p>
            ) : (
              <div className="mt-4 flex items-end gap-1" style={{ height: 120 }}>
                {data.daily.map((d) => (
                  <div key={d.day} className="group relative flex-1" title={`${d.day}: ${d.count}`}>
                    <div
                      className="rounded-t-sm bg-signal transition-all"
                      style={{ height: `${Math.max(4, (d.count / maxDaily) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <div className="grid gap-6 md:grid-cols-2">
            <Panel className="p-5">
              <h2 className="text-sm font-semibold text-ink">Most-used knowledge sources</h2>
              {data.knowledgeSourceUsage.length === 0 ? (
                <p className="mt-3 text-sm text-muted">No indexed knowledge yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.knowledgeSourceUsage.map((s) => (
                    <li key={s.id} className="flex items-center justify-between text-sm">
                      <span className="truncate text-ink">{s.name}</span>
                      <span className="text-xs text-muted">{s.chunkCount} chunks</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel className="p-5">
              <h2 className="text-sm font-semibold text-ink">Recent unanswered questions</h2>
              {data.recentUnanswered.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Nothing in this range.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.recentUnanswered.map((q, i) => (
                    <li key={i} className="text-sm">
                      <p className="truncate text-ink">{q.question}</p>
                      <p className="text-xs text-muted">{q.reason.replace(/_/g, " ").toLowerCase()}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Panel className="p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-ink">{value}</p>
    </Panel>
  );
}
