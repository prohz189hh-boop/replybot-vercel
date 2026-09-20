import Link from "next/link";
import { LinkButton } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold text-ink">ReplyPilot</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="font-medium text-ink hover:underline">
            Log in
          </Link>
          <LinkButton href="/signup">Start free</LinkButton>
        </nav>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-3xl font-semibold text-ink md:text-4xl">
          Turn your website into a 24/7 support agent.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base text-muted">
          Train AI on your business knowledge, answer customer questions automatically, and hand conversations to
          your team when it matters.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <LinkButton href="/signup">Start free</LinkButton>
          <LinkButton href="/login" variant="secondary">
            Log in
          </LinkButton>
        </div>
      </main>
    </div>
  );
}
