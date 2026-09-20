"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function VerifyEmailContent() {
  const token = useSearchParams().get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => setStatus(res.ok ? "ok" : "error"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 text-center">
      <div>
        {status === "loading" && <p className="text-sm text-muted">Verifying…</p>}
        {status === "ok" && <p className="text-sm text-ink">Your email is verified.</p>}
        {status === "error" && <p className="text-sm text-danger">This verification link is invalid or has expired.</p>}
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-signal-700 hover:underline">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-paper"><p className="text-sm text-muted">Verifying…</p></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
