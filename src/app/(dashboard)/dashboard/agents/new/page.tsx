"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldLabel, inputClasses, ErrorText } from "@/components/ui/primitives";

export default function NewAgentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // businessId is read server-side from the session's active
      // membership by requireBusinessAccess — but the current route
      // signature also takes it in the body, so we look it up via the
      // dashboard context endpoint isn't needed: the API route resolves
      // and checks it itself. We still need to tell it WHICH business,
      // since a user can belong to more than one; the active one comes
      // from the same cookie the dashboard layout already set.
      const meRes = await fetch("/api/dashboard/business");
      const me = await meRes.json();

      const res = await fetch("/api/dashboard/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: me.business.id, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't create the agent.");
        return;
      }
      router.push(`/dashboard/agents/${data.agent.id}`);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold text-ink">New agent</h1>
      <p className="mt-1 text-sm text-muted">You can add knowledge and customize behavior after creating it.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-md border border-line bg-white p-5">
        <div>
          <FieldLabel htmlFor="name">Agent name</FieldLabel>
          <input
            id="name"
            required
            placeholder="e.g. Acme Support"
            className={inputClasses}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create agent"}
        </Button>
      </form>
    </div>
  );
}
