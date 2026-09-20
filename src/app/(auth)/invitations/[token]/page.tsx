"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldLabel, inputClasses, ErrorText } from "@/components/ui/primitives";

export default function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<{ email: string; role: string; businessName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/invitations/${token}`)
      .then((res) => res.json())
      .then((data) => (data.error ? setError(data.error) : setInfo(data)));
  }, [token]);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/invitations/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (error && !info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4 text-center">
        <p className="text-sm text-danger">{error}</p>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center text-lg font-semibold text-ink">ReplyPilot</p>
        <div className="rounded-md border border-line bg-white p-6">
          <h1 className="text-lg font-semibold text-ink">Join {info.businessName}</h1>
          <p className="mt-1 text-sm text-muted">
            You've been invited as {info.role.toLowerCase()} — {info.email}
          </p>
          <form onSubmit={accept} className="mt-5 space-y-4">
            <div>
              <FieldLabel htmlFor="name">Your name</FieldLabel>
              <input id="name" required className={inputClasses} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="password">Create a password</FieldLabel>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                className={inputClasses}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Joining…" : "Accept & join"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
