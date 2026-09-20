"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Panel, FieldLabel, inputClasses, ErrorText } from "@/components/ui/primitives";
import type { BusinessRole } from "@prisma/client";

interface Member {
  id: string;
  role: BusinessRole;
  user: { id: string; name: string | null; email: string };
}
interface Invitation {
  id: string;
  email: string;
  role: BusinessRole;
  expiresAt: string;
}

export function TeamManager({ viewerRole }: { viewerRole: BusinessRole }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [currentMembershipId, setCurrentMembershipId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/dashboard/team");
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members);
      setInvitations(data.invitations);
      setCurrentMembershipId(data.currentMembershipId);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const canManage = viewerRole === "OWNER" || viewerRole === "ADMIN";

  async function removeMember(id: string) {
    if (!confirm("Remove this person from your team?")) return;
    const res = await fetch(`/api/dashboard/team/${id}`, { method: "DELETE" });
    if (res.ok) refresh();
    else alert((await res.json()).error);
  }

  async function changeRole(id: string, role: BusinessRole) {
    const res = await fetch(`/api/dashboard/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) refresh();
    else alert((await res.json()).error);
  }

  return (
    <div className="space-y-6">
      {canManage && <InviteForm onInvited={refresh} />}

      <div>
        <h2 className="text-sm font-semibold text-ink">Members</h2>
        <div className="mt-2 divide-y divide-line rounded-md border border-line bg-white">
          {loading ? (
            <p className="p-4 text-sm text-muted">Loading…</p>
          ) : (
            members.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {m.user.name ?? m.user.email} {m.id === currentMembershipId && <span className="text-muted">(you)</span>}
                  </p>
                  <p className="text-xs text-muted">{m.user.email}</p>
                </div>
                {canManage && m.id !== currentMembershipId ? (
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-sm border border-line px-2 py-1 text-xs"
                      value={m.role}
                      onChange={(e) => changeRole(m.id, e.target.value as BusinessRole)}
                      disabled={viewerRole !== "OWNER" && m.role !== "AGENT"}
                    >
                      <option value="OWNER">Owner</option>
                      <option value="ADMIN">Admin</option>
                      <option value="AGENT">Agent</option>
                    </select>
                    <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => removeMember(m.id)}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted">{m.role.charAt(0) + m.role.slice(1).toLowerCase()}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {invitations.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-ink">Pending invitations</h2>
          <div className="mt-2 divide-y divide-line rounded-md border border-line bg-white">
            {invitations.map((i) => (
              <div key={i.id} className="flex items-center justify-between px-4 py-3">
                <p className="text-sm text-ink">{i.email}</p>
                <span className="text-xs text-muted">{i.role.toLowerCase()} · pending</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InviteForm({ onInvited }: { onInvited: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "AGENT">("AGENT");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/dashboard/team/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't send the invitation.");
        return;
      }
      setEmail("");
      onInvited();
    } finally {
      setSending(false);
    }
  }

  return (
    <Panel className="p-5">
      <h2 className="text-sm font-semibold text-ink">Invite someone</h2>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <FieldLabel htmlFor="invite-email">Email</FieldLabel>
          <input
            id="invite-email"
            type="email"
            required
            className={inputClasses}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="invite-role">Role</FieldLabel>
          <select
            id="invite-role"
            className={inputClasses}
            value={role}
            onChange={(e) => setRole(e.target.value as "ADMIN" | "AGENT")}
          >
            <option value="AGENT">Agent</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <Button type="submit" disabled={sending}>
          {sending ? "Sending…" : "Send invite"}
        </Button>
      </form>
      <ErrorText>{error}</ErrorText>
    </Panel>
  );
}
