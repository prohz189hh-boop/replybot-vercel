"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FieldLabel, inputClasses } from "@/components/ui/primitives";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage(data.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center text-lg font-semibold text-ink">ReplyPilot</p>
        <div className="rounded-md border border-line bg-white p-6">
          <h1 className="text-lg font-semibold text-ink">Reset your password</h1>
          <p className="mt-1 text-sm text-muted">We'll email you a link to set a new one.</p>
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <input
                id="email"
                type="email"
                required
                className={inputClasses}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {message && <p className="text-sm text-ink">{message}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          <Link href="/login" className="font-medium text-signal-700 hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
