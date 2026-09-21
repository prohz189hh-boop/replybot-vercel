"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { inputClasses, Panel } from "@/components/ui/primitives";

interface Exchange {
  question: string;
  reply: string;
  confidence: number;
  wouldEscalate: boolean;
  sources: { id: string; content: string }[];
}

export default function PlaygroundPage() {
  const { id } = useParams<{ id: string }>();
  const [message, setMessage] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setError(null);
    setLoading(true);
    const question = message;
    setMessage("");
    try {
      const res = await fetch(`/api/dashboard/agents/${id}/playground`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "The AI service is temporarily unavailable. Please try again later.");
        setMessage(question);
        return;
      }
      if (!data || typeof data.reply !== "string") {
        setError("The AI service returned an unexpected response. Please try again.");
        setMessage(question);
        return;
      }
      setExchanges((prev) => [...prev, { question, ...data }]);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setMessage(question);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Link href={`/dashboard/agents/${id}`} className="text-sm text-muted hover:underline">
        ← Back to agent
      </Link>
      <h1 className="mt-1 text-xl font-semibold text-ink">Test playground</h1>
      <p className="mt-1 text-sm text-muted">
        Ask the agent questions the way a customer would. This calls the real AI and your real knowledge base, but
        never reaches the public widget or a customer.
      </p>

      <div className="mt-6 space-y-4">
        {exchanges.map((ex, i) => (
          <Panel key={i} className="p-4">
            <p className="text-sm font-medium text-ink">{ex.question}</p>
            <p className="mt-2 text-sm text-ink">{ex.reply}</p>
            <div className="mt-3 flex items-center gap-3 text-xs text-muted">
              <span>Confidence: {Math.round(ex.confidence * 100)}%</span>
              {ex.wouldEscalate && <span className="text-escalate">Would escalate to human</span>}
            </div>
            {ex.sources.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-signal-700">
                  {ex.sources.length} source{ex.sources.length === 1 ? "" : "s"} used
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {ex.sources.map((s) => (
                    <li key={s.id} className="rounded-sm bg-paper px-2.5 py-1.5 text-xs text-muted">
                      {s.content.slice(0, 200)}
                      {s.content.length > 200 ? "…" : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Panel>
        ))}
        {exchanges.length === 0 && (
          <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            Ask a question below to see how the agent responds.
          </p>
        )}
      </div>

      <form onSubmit={send} className="mt-4 flex gap-2">
        <input
          className={inputClasses}
          placeholder="Ask a question…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Sending…" : "Send"}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
