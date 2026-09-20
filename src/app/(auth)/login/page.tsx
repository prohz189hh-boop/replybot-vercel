"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FieldLabel, inputClasses, ErrorText } from "@/components/ui/primitives";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center text-lg font-semibold text-ink">ReplyPilot</p>
        <div className="rounded-md border border-line bg-white p-6">
          <h1 className="text-lg font-semibold text-ink">Log in</h1>
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className={inputClasses}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                className={inputClasses}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Logging in…" : "Log in"}
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          Don't have an account?{" "}
          <Link href="/signup" className="font-medium text-signal-700 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
