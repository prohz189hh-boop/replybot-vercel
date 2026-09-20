"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge, inputClasses } from "@/components/ui/primitives";

interface ConversationListItem {
  id: string;
  status: string;
  unreadCount: number;
  updatedAt: string;
  customerName: string;
  agentName: string;
  lastMessage: string | null;
  assignedToId: string | null;
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "ai", label: "AI" },
  { key: "needs_human", label: "Needs human" },
  { key: "mine", label: "Assigned to me" },
  { key: "resolved", label: "Resolved" },
] as const;

// No websocket/SSE infrastructure exists yet (see README's "not yet
// built" list) — this polls, which is the documented fallback for
// realtime updates the spec allows when full realtime isn't wired up.
const POLL_MS = 8000;

export function InboxApp() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    const params = new URLSearchParams({ filter });
    if (search.trim()) params.set("search", search.trim());
    const res = await fetch(`/api/dashboard/conversations?${params}`);
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations);
    }
    setLoading(false);
  }, [filter, search]);

  useEffect(() => {
    setLoading(true);
    loadList();
    const interval = setInterval(loadList, POLL_MS);
    return () => clearInterval(interval);
  }, [loadList]);

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col md:h-[calc(100vh-4rem)] md:flex-row md:gap-4">
      <div className={`flex min-w-0 flex-col md:w-80 md:shrink-0 ${selectedId ? "hidden md:flex" : "flex"}`}>
        <div className="mb-3 space-y-2">
          <input
            className={inputClasses}
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-sm px-2.5 py-1 text-xs font-medium ${
                  filter === f.key ? "bg-signal-50 text-signal-700" : "text-muted hover:bg-paper"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto rounded-md border border-line bg-white">
          {loading ? (
            <p className="p-4 text-sm text-muted">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-sm text-muted">No conversations here.</p>
          ) : (
            <ul className="divide-y divide-line">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    className={`block w-full px-3.5 py-3 text-left hover:bg-paper ${selectedId === c.id ? "bg-signal-50" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink">{c.customerName}</span>
                      {c.unreadCount > 0 && (
                        <span className="shrink-0 rounded-full bg-signal px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">{c.lastMessage ?? "No messages yet"}</p>
                    <div className="mt-1.5">
                      <StatusBadge status={c.status} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={`min-w-0 flex-1 ${selectedId ? "flex" : "hidden md:flex"}`}>
        {selectedId ? (
          <ConversationDetail id={selectedId} onBack={() => setSelectedId(null)} onChanged={loadList} />
        ) : (
          <div className="hidden flex-1 items-center justify-center rounded-md border border-dashed border-line text-sm text-muted md:flex">
            Select a conversation
          </div>
        )}
      </div>
    </div>
  );
}

interface Message {
  id: string;
  sender: "CUSTOMER" | "AI" | "HUMAN" | "SYSTEM";
  content: string;
  createdAt: string;
}
interface Note {
  id: string;
  content: string;
  createdAt: string;
}
interface ConversationDetailData {
  id: string;
  status: string;
  businessId: string;
  customer: { name: string | null; email: string | null; externalId: string };
  agent: { name: string };
  messages: Message[];
  notes: Note[];
}

function ConversationDetail({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const [data, setData] = useState<ConversationDetailData | null>(null);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<"messages" | "notes">("messages");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/dashboard/conversations/${id}`);
    if (res.ok) setData((await res.json()).conversation);
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/dashboard/conversations/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply }),
      });
      setReply("");
      await load();
      onChanged();
    } finally {
      setSending(false);
    }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    await fetch(`/api/dashboard/conversations/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: note }),
    });
    setNote("");
    await load();
  }

  async function setStatus(status: string) {
    await fetch(`/api/dashboard/conversations/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
    onChanged();
  }

  if (!data) {
    return <div className="flex flex-1 items-center justify-center text-sm text-muted">Loading…</div>;
  }

  return (
    <div className="flex flex-1 flex-col rounded-md border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onBack} className="text-sm text-muted hover:text-ink md:hidden">
            ←
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {data.customer.name ?? data.customer.email ?? `Visitor ${data.customer.externalId.slice(0, 8)}`}
            </p>
            <p className="text-xs text-muted">{data.agent.name}</p>
          </div>
        </div>
        <StatusBadge status={data.status} />
      </div>

      <div className="flex gap-1 border-b border-line px-4 pt-2">
        <button
          onClick={() => setTab("messages")}
          className={`rounded-t-sm px-3 py-1.5 text-xs font-medium ${tab === "messages" ? "text-signal-700" : "text-muted"}`}
        >
          Conversation
        </button>
        <button
          onClick={() => setTab("notes")}
          className={`rounded-t-sm px-3 py-1.5 text-xs font-medium ${tab === "notes" ? "text-signal-700" : "text-muted"}`}
        >
          Internal notes ({data.notes.length})
        </button>
      </div>

      {tab === "messages" ? (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {data.messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${
                  m.sender === "CUSTOMER"
                    ? "bg-paper text-ink"
                    : m.sender === "HUMAN"
                      ? "ml-auto bg-signal-50 text-signal-700"
                      : m.sender === "AI"
                        ? "ml-auto bg-signal text-white"
                        : "mx-auto bg-escalate-50 text-escalate text-xs"
                }`}
              >
                {m.content}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-line p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => setStatus("AI")}>
                Return to AI
              </Button>
              <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => setStatus("RESOLVED")}>
                Resolve
              </Button>
              <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => setStatus("OPEN")}>
                Reopen
              </Button>
            </div>
            <form onSubmit={sendReply} className="flex gap-2">
              <input
                className={inputClasses}
                placeholder="Reply as yourself…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <Button type="submit" disabled={sending}>
                Send
              </Button>
            </form>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
            {data.notes.length === 0 ? (
              <p className="text-sm text-muted">No internal notes yet. Only your team can see these.</p>
            ) : (
              data.notes.map((n) => (
                <div key={n.id} className="rounded-sm bg-paper px-3 py-2 text-sm text-ink">
                  {n.content}
                </div>
              ))
            )}
          </div>
          <form onSubmit={addNote} className="flex gap-2 border-t border-line p-3">
            <input
              className={inputClasses}
              placeholder="Add an internal note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button type="submit">Add</Button>
          </form>
        </>
      )}
    </div>
  );
}
