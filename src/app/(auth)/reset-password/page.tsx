"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldLabel, inputClasses, ErrorText } from "@/components/ui/primitives";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 1500);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <p className="text-sm text-muted">This reset link is missing its token.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center text-lg font-semibold text-ink">ReplyPilot</p>
        <div className="rounded-md border border-line bg-white p-6">
          <h1 className="text-lg font-semibold text-ink">Set a new password</h1>
          {done ? (
            <p className="mt-4 text-sm text-resolved">Password updated. Redirecting to log in…</p>
          ) : (
            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <div>
                <FieldLabel htmlFor="password">New password</FieldLabel>
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
                {loading ? "Saving…" : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-paper"><p className="text-sm text-muted">Loading…</p></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
