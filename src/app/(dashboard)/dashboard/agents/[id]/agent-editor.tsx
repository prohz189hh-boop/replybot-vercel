"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FieldLabel, inputClasses, ErrorText, Panel } from "@/components/ui/primitives";
import type { Agent, WidgetConfiguration } from "@prisma/client";

type AgentWithWidget = Agent & { widgetConfig: WidgetConfiguration | null };

const PERSONALITIES = ["PROFESSIONAL", "FRIENDLY", "CONCISE", "DETAILED"] as const;
const LENGTHS = ["SHORT", "BALANCED", "DETAILED"] as const;

export function AgentEditor({ agent }: { agent: AgentWithWidget }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: agent.name,
    personality: agent.personality,
    responseLength: agent.responseLength,
    confidenceThreshold: agent.confidenceThreshold,
    fallbackMessage: agent.fallbackMessage,
    escalationKeywords: agent.escalationKeywords.join(", "),
    allowedDomains: agent.allowedDomains.join(", "),
    welcomeMessage: agent.widgetConfig?.welcomeMessage ?? "",
    primaryColor: agent.widgetConfig?.primaryColor ?? "#3E5CE8",
    chatButtonText: agent.widgetConfig?.chatButtonText ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      const domains = form.allowedDomains
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      const keywords = form.escalationKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const res = await fetch(`/api/dashboard/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          personality: form.personality,
          responseLength: form.responseLength,
          confidenceThreshold: Number(form.confidenceThreshold),
          fallbackMessage: form.fallbackMessage,
          escalationKeywords: keywords,
          allowedDomains: domains,
          widgetConfig: {
            welcomeMessage: form.welcomeMessage,
            primaryColor: form.primaryColor,
            chatButtonText: form.chatButtonText,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save changes.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onDeactivate() {
    if (!confirm(`Deactivate "${agent.name}"? The public widget will stop responding immediately.`)) return;
    const res = await fetch(`/api/dashboard/agents/${agent.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard/agents");
      router.refresh();
    }
  }

  const installSnippet = `<script src="${process.env.NEXT_PUBLIC_APP_URL ?? "https://your-domain.example"}/widget/loader.js" data-agent="${agent.publicId}" async></script>`;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/agents" className="text-sm text-muted hover:underline">
            ← Agents
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-ink">{agent.name}</h1>
        </div>
        <Link
          href={`/dashboard/agents/${agent.id}/playground`}
          className="text-sm font-medium text-signal-700 hover:underline"
        >
          Test in playground →
        </Link>
      </div>

      <form onSubmit={onSave} className="mt-6 space-y-6">
        <Panel className="p-5">
          <h2 className="text-sm font-semibold text-ink">Behavior</h2>
          <div className="mt-4 space-y-4">
            <div>
              <FieldLabel htmlFor="name">Agent name</FieldLabel>
              <input
                id="name"
                className={inputClasses}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="personality">Personality</FieldLabel>
                <select
                  id="personality"
                  className={inputClasses}
                  value={form.personality}
                  onChange={(e) => setForm((f) => ({ ...f, personality: e.target.value as typeof f.personality }))}
                >
                  {PERSONALITIES.map((p) => (
                    <option key={p} value={p}>
                      {p.charAt(0) + p.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="length">Response length</FieldLabel>
                <select
                  id="length"
                  className={inputClasses}
                  value={form.responseLength}
                  onChange={(e) => setForm((f) => ({ ...f, responseLength: e.target.value as typeof f.responseLength }))}
                >
                  {LENGTHS.map((l) => (
                    <option key={l} value={l}>
                      {l.charAt(0) + l.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="threshold">
                Confidence threshold ({Math.round(form.confidenceThreshold * 100)}%)
              </FieldLabel>
              <input
                id="threshold"
                type="range"
                min={0}
                max={1}
                step={0.05}
                className="w-full accent-signal"
                value={form.confidenceThreshold}
                onChange={(e) => setForm((f) => ({ ...f, confidenceThreshold: Number(e.target.value) }))}
              />
              <p className="mt-1 text-xs text-muted">Below this confidence, the agent hands off instead of guessing.</p>
            </div>
            <div>
              <FieldLabel htmlFor="fallback">Fallback message</FieldLabel>
              <textarea
                id="fallback"
                rows={2}
                className={inputClasses}
                value={form.fallbackMessage}
                onChange={(e) => setForm((f) => ({ ...f, fallbackMessage: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel htmlFor="keywords">Escalation keywords (comma-separated)</FieldLabel>
              <input
                id="keywords"
                className={inputClasses}
                value={form.escalationKeywords}
                onChange={(e) => setForm((f) => ({ ...f, escalationKeywords: e.target.value }))}
              />
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="text-sm font-semibold text-ink">Widget</h2>
          <div className="mt-4 space-y-4">
            <div>
              <FieldLabel htmlFor="welcome">Welcome message</FieldLabel>
              <input
                id="welcome"
                className={inputClasses}
                value={form.welcomeMessage}
                onChange={(e) => setForm((f) => ({ ...f, welcomeMessage: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="color">Accent color</FieldLabel>
                <input
                  id="color"
                  type="color"
                  className="h-10 w-full rounded-sm border border-line"
                  value={form.primaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel htmlFor="buttonText">Chat button text</FieldLabel>
                <input
                  id="buttonText"
                  className={inputClasses}
                  value={form.chatButtonText}
                  onChange={(e) => setForm((f) => ({ ...f, chatButtonText: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="text-sm font-semibold text-ink">Allowed domains</h2>
          <p className="mt-1 text-xs text-muted">
            Sites where this widget is allowed to load (comma-separated, e.g. https://acme.com). Leave empty and the
            widget won't work on any production domain.
          </p>
          <input
            className={`${inputClasses} mt-3`}
            placeholder="https://acme.com, https://www.acme.com"
            value={form.allowedDomains}
            onChange={(e) => setForm((f) => ({ ...f, allowedDomains: e.target.value }))}
          />
        </Panel>

        <Panel className="p-5">
          <h2 className="text-sm font-semibold text-ink">Install on your site</h2>
          <pre className="mt-3 overflow-x-auto rounded-sm bg-ink px-3 py-2.5 font-mono text-xs text-white">
            {installSnippet}
          </pre>
        </Panel>

        <ErrorText>{error}</ErrorText>
        {saved && !error && <p className="text-sm text-resolved">Saved.</p>}

        <div className="flex items-center justify-between">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="danger" onClick={onDeactivate}>
            Deactivate agent
          </Button>
        </div>
      </form>
    </div>
  );
}
