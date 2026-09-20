"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";

const fieldClass = "rp-field";
const labelClass = "mb-2 block text-[12px] font-bold text-[#383652]";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", businessName: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((previous) => ({ ...previous, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (form.password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          businessName: form.businessName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      });
      const data: { error?: string; ok?: boolean } | null = await res.json().catch(() => null);
      if (!res.ok) {
        setError(res.status >= 500
          ? "The signup service is temporarily unavailable. Please try again shortly."
          : data?.error ?? "We couldn't create your account. Check your details and try again.");
        return;
      }
      if (!data?.ok) {
        setError("We couldn't confirm your account was created. Please try again.");
        return;
      }
      router.replace("/onboarding");
      router.refresh();
    } catch {
      setError("We couldn't connect to ReplyPilot. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Your workspace starts here"
      title="Create something great."
      description="Start with your business details. You can set up your AI agent, knowledge, and website widget next."
      footer={<>Already have an account? <Link href="/login" className="font-bold text-[#5D53E5] hover:underline">Log in <span aria-hidden="true">→</span></Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="name">Your name</label>
          <input id="name" name="name" className={fieldClass} placeholder="Alex Morgan" autoComplete="name" required maxLength={120} value={form.name} onChange={update("name")} />
        </div>
        <div>
          <label className={labelClass} htmlFor="businessName">Business name</label>
          <input id="businessName" name="organization" className={fieldClass} placeholder="Your company" autoComplete="organization" required maxLength={160} value={form.businessName} onChange={update("businessName")} />
        </div>
        <div>
          <label className={labelClass} htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" className={fieldClass} placeholder="you@company.com" autoComplete="email" required maxLength={255} value={form.email} onChange={update("email")} />
        </div>
        <div>
          <label className={labelClass} htmlFor="password">Password</label>
          <div className="relative">
            <input id="password" name="password" type={showPassword ? "text" : "password"} className={`${fieldClass} pr-12`} placeholder="At least 8 characters" autoComplete="new-password" required minLength={8} maxLength={200} value={form.password} onChange={update("password")} />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#88869B] hover:text-[#5147DC]" aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#9291A5]"><LockKeyhole className="h-3 w-3" /> Use a unique password to keep your workspace safe.</p>
        </div>
        {error && <div role="alert" className="rounded-xl border border-[#F3D3D4] bg-[#FFF3F3] px-4 py-3 text-[12px] font-medium leading-5 text-[#B2334C]">{error}</div>}
        <button type="submit" disabled={loading} className="rp-primary mt-1 w-full py-3.5" aria-busy={loading}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating your workspace…</> : <>Create free account <ArrowRight className="h-4 w-4" /></>}
        </button>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-1 text-[11px] font-medium text-[#85859B]">
          <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-[#31A780]" /> No credit card required</span>
          <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-[#31A780]" /> Set up at your pace</span>
        </div>
      </form>
    </AuthShell>
  );
}
