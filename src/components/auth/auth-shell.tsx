import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Sparkles, ShieldCheck, Zap } from "lucide-react";
import { BrandWordmark } from "@/components/brand";

export function AuthShell({
  children,
  eyebrow,
  title,
  description,
  footer,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  footer?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#F7F8FC] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.04fr)]">
      <section className="rp-hero-gradient rp-dot-grid relative hidden min-h-screen overflow-hidden p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div className="rp-aurora pointer-events-none absolute -right-40 top-16 h-[480px] w-[480px] rounded-full" />
        <div className="relative z-10"><BrandWordmark light /></div>
        <div className="relative z-10 mx-auto flex w-full max-w-[510px] flex-1 flex-col justify-center py-12">
          <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[.14em] text-[#C9C4FF]">
            <Sparkles className="h-3.5 w-3.5" /> Less busywork. Better conversations.
          </span>
          <h2 className="max-w-[450px] text-[44px] font-extrabold leading-[1.13] tracking-[-0.055em] xl:text-[55px]">
            Every conversation, <span className="text-[#BFB7FF]">handled with care.</span>
          </h2>
          <p className="mt-6 max-w-[440px] text-[15px] leading-7 text-[#C8C8E0]">
            Give your customers helpful answers, trained on what makes your business yours.
            Bring in your team whenever a human touch matters.
          </p>
          <div className="rp-float mt-12 rounded-[26px] border border-white/15 bg-white/[.09] p-3 shadow-[0_25px_75px_rgba(0,0,0,.2)] backdrop-blur-xl">
            <div className="rounded-[20px] bg-white p-5 text-[#24223D] shadow-2xl">
              <div className="flex items-center gap-3 border-b border-[#EFEFFC] pb-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAE8FF] text-[#6257EF]"><Sparkles className="h-5 w-5" /></span>
                <div className="flex-1"><p className="text-sm font-bold">Your support agent</p><p className="mt-0.5 text-xs text-[#8B8BA6]">Here to help, anytime</p></div>
                <span className="rounded-full bg-[#E9F9F3] px-2.5 py-1 text-[10px] font-bold text-[#16865E]">● Online</span>
              </div>
              <div className="space-y-4 py-5 text-[13px] leading-6">
                <div className="ml-auto max-w-[84%] rounded-2xl rounded-tr-sm bg-[#EEEAFE] px-4 py-3 text-[#393276]">
                  Do you offer delivery?
                </div>
                <div className="flex items-end gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#6257EF] text-white"><Sparkles className="h-3.5 w-3.5" /></span>
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-[#F6F6FA] px-4 py-3">
                    Yes! Here are your delivery options. Want me to walk you through them?
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#EEEEF4] px-4 py-3 text-xs text-[#9292A8]">
                Ask a question <ArrowUpRight className="h-4 w-4 text-[#665CEE]" />
              </div>
            </div>
          </div>
          <div className="mt-9 grid grid-cols-2 gap-4 text-xs font-medium text-[#D6D2ED]">
            <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#6CE2C3]" /> Your knowledge, your answers</span>
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#6CE2C3]" /> Built for your team</span>
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-between text-xs text-[#9290B8]">
          <span>© {new Date().getFullYear()} ReplyPilot</span>
          <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Make support feel effortless</span>
        </div>
      </section>
      <section className="flex min-h-screen flex-col px-5 py-7 sm:px-10 lg:px-12 xl:px-20">
        <div className="lg:hidden"><BrandWordmark /></div>
        <div className="mx-auto flex w-full max-w-[450px] flex-1 flex-col justify-center py-12 lg:py-16">
          <span className="text-[11px] font-extrabold uppercase tracking-[.2em] text-[#6A60E8]">{eyebrow}</span>
          <h1 className="mt-3 text-[32px] font-extrabold leading-tight tracking-[-.045em] text-[#19172F] sm:text-[38px]">{title}</h1>
          <p className="mt-3 text-[14px] leading-6 text-[#787993]">{description}</p>
          <div className="mt-8 rounded-[26px] border border-[#E8E8F3] bg-white p-6 shadow-[0_20px_70px_rgba(24,22,65,.055)] sm:p-8">
            {children}
          </div>
          {footer && <div className="mt-6 text-center text-sm text-[#797991]">{footer}</div>}
        </div>
        <div className="text-center text-[11px] text-[#9A9BAE]">Your workspace, ready when you are. · <Link href="/" className="text-[#665CEB] hover:underline">Back to home</Link></div>
      </section>
    </main>
  );
}
