"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FieldLabel, inputClasses, ErrorText } from "@/components/ui/primitives";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", businessName: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center text-lg font-semibold text-ink">ReplyPilot</p>
        <div className="rounded-md border border-line bg-white p-6">
          <h1 className="text-lg font-semibold text-ink">Create your account</h1>
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div>
              <FieldLabel htmlFor="name">Your name</FieldLabel>
              <input id="name" required className={inputClasses} value={form.name} onChange={update("name")} />
            </div>
            <div>
              <FieldLabel htmlFor="businessName">Business name</FieldLabel>
              <input
                id="businessName"
                required
                className={inputClasses}
                value={form.businessName}
                onChange={update("businessName")}
              />
            </div>
            <div>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className={inputClasses}
                value={form.email}
                onChange={update("email")}
              />
            </div>
            <div>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className={inputClasses}
                value={form.password}
                onChange={update("password")}
              />
            </div>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-signal-700 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
