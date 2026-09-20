"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data: { error?: string; ok?: boolean } | null = await res.json().catch(() => null);
      if (!res.ok) {
        setError(res.status >= 500
          ? "The sign-in service is temporarily unavailable. Please try again shortly."
          : data?.error ?? "We couldn't sign you in. Please try again.");
        return;
      }
      if (!data?.ok) {
        setError("We couldn't confirm your sign-in. Please try again.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("We couldn't connect to ReplyPilot. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Good to have you here."
      description="Pick up where you left off. Your conversations, AI agents, and team are right where you need them."
      footer={<>New to ReplyPilot? <Link href="/signup" className="font-bold text-[#5D53E5] hover:underline">Create your account →</Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="mb-2 block text-[12px] font-bold text-[#383652]">Email address</label>
          <input id="email" type="email" autoComplete="email" placeholder="you@company.com" className="rp-field" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label htmlFor="password" className="text-[12px] font-bold text-[#383652]">Password</label>
            <Link href="/forgot-password" className="text-[12px] font-bold text-[#6257EF] hover:underline">Forgot password?</Link>
          </div>
          <div className="relative">
            <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" className="rp-field pr-12" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#88869B] hover:text-[#5147DC]">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {error && <div role="alert" className="rounded-xl border border-[#F3D3D4] bg-[#FFF3F3] px-4 py-3 text-[12px] font-medium text-[#B2334C]">{error}</div>}
        <button type="submit" disabled={loading} aria-busy={loading} className="rp-primary w-full py-3.5">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : <>Sign in to workspace <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>
    </AuthShell>
  );
}
