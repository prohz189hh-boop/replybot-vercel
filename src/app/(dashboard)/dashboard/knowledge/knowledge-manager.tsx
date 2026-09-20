"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Panel, EmptyState, StatusBadge, FieldLabel, inputClasses, ErrorText } from "@/components/ui/primitives";

interface Source {
  id: string;
  type: "MANUAL_TEXT" | "FAQ" | "WEBSITE" | "FILE";
  name: string;
  status: "PROCESSING" | "READY" | "FAILED";
  errorMessage: string | null;
  chunkCount: number;
  sourceUrl: string | null;
  lastIndexedAt: string | null;
}

type Tab = "text" | "faq" | "website" | "file";

export function KnowledgeManager({ agents }: { agents: { id: string; name: string }[] }) {
  const [agentId, setAgentId] = useState(agents[0].id);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("text");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/knowledge?agentId=${agentId}`);
      const data = await res.json();
      setSources(res.ok ? data.sources : []);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onDelete(id: string) {
    if (!confirm("Delete this knowledge source? This can't be undone.")) return;
    await fetch(`/api/dashboard/knowledge/${id}`, { method: "DELETE" });
    refresh();
  }

  async function onReindex(id: string) {
    await fetch(`/api/dashboard/knowledge/${id}/reindex`, { method: "POST" });
    refresh();
  }

  return (
    <div>
      {agents.length > 1 && (
        <select
          className={`${inputClasses} mb-4 max-w-xs`}
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}

      <Panel className="p-5">
        <div className="flex gap-1 border-b border-line pb-3">
          {(["text", "faq", "website", "file"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-sm px-3 py-1.5 text-sm font-medium ${
                tab === t ? "bg-signal-50 text-signal-700" : "text-muted hover:text-ink"
              }`}
            >
              {{ text: "Text", faq: "FAQ", website: "Website", file: "File" }[t]}
            </button>
          ))}
        </div>
        <div className="pt-4">
          {tab === "text" && <TextForm agentId={agentId} type="MANUAL_TEXT" onDone={refresh} />}
          {tab === "faq" && <FaqForm agentId={agentId} onDone={refresh} />}
          {tab === "website" && <WebsiteForm agentId={agentId} onDone={refresh} />}
          {tab === "file" && <FileForm agentId={agentId} onDone={refresh} />}
        </div>
      </Panel>

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : sources.length === 0 ? (
          <EmptyState title="No knowledge yet" description="Add text, an FAQ, a website, or a file above to get started." />
        ) : (
          <div className="divide-y divide-line rounded-md border border-line bg-white">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{s.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {s.type.replace("_", " ").toLowerCase()} · {s.chunkCount} chunk{s.chunkCount === 1 ? "" : "s"}
                    {s.status === "FAILED" && s.errorMessage ? ` · ${s.errorMessage}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={s.status} />
                  {(s.type === "WEBSITE" || s.type === "FILE") && (
                    <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => onReindex(s.id)}>
                      Reindex
                    </Button>
                  )}
                  <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => onDelete(s.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TextForm({ agentId, type, onDone }: { agentId: string; type: "MANUAL_TEXT"; onDone: () => void }) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, type, name, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't add this.");
        return;
      }
      setName("");
      setContent("");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input className={inputClasses} placeholder="Name (e.g. Store hours)" value={name} onChange={(e) => setName(e.target.value)} required />
      <textarea
        className={inputClasses}
        rows={4}
        placeholder="Our store is open Monday–Friday from 9am to 6pm."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
      />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={saving}>
        {saving ? "Adding…" : "Add"}
      </Button>
    </form>
  );
}

function FaqForm({ agentId, onDone }: { agentId: string; onDone: () => void }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          type: "FAQ",
          name: question.slice(0, 100),
          content: `Question: ${question}\nAnswer: ${answer}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't add this.");
        return;
      }
      setQuestion("");
      setAnswer("");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <FieldLabel htmlFor="q">Question</FieldLabel>
        <input id="q" className={inputClasses} value={question} onChange={(e) => setQuestion(e.target.value)} required />
      </div>
      <div>
        <FieldLabel htmlFor="a">Answer</FieldLabel>
        <textarea id="a" className={inputClasses} rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} required />
      </div>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={saving}>
        {saving ? "Adding…" : "Add FAQ"}
      </Button>
    </form>
  );
}

function WebsiteForm({ agentId, onDone }: { agentId: string; onDone: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, type: "WEBSITE", name: url, url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't crawl this URL.");
        return;
      }
      setUrl("");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        className={inputClasses}
        type="url"
        placeholder="https://example.com/faq"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
      />
      <p className="text-xs text-muted">Public pages only — the crawler blocks private/internal addresses automatically.</p>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={saving}>
        {saving ? "Crawling…" : "Add page"}
      </Button>
    </form>
  );
}

function FileForm({ agentId, onDone }: { agentId: string; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setSaving(true);
    try {
      const form = new FormData();
      form.set("agentId", agentId);
      form.set("name", file.name);
      form.set("file", file);
      const res = await fetch("/api/dashboard/knowledge", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't upload this file.");
        return;
      }
      setFile(null);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm text-muted file:mr-3 file:rounded-sm file:border-0 file:bg-signal-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-signal-700"
      />
      <p className="text-xs text-muted">PDF, DOCX, or TXT — up to 15MB.</p>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={saving || !file}>
        {saving ? "Uploading…" : "Upload"}
      </Button>
    </form>
  );
}
