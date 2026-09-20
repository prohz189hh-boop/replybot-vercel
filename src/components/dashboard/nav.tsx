"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Inbox, Bot, BookOpen, BarChart3, Users,
  CreditCard, Settings, ArrowUpRight, ChevronRight, Sparkles,
} from "lucide-react";
import { BrandWordmark } from "@/components/brand";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/inbox", label: "Inbox", icon: Inbox },
  { href: "/dashboard/agents", label: "AI agents", icon: Bot },
  { href: "/dashboard/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/team", label: "Your team", icon: Users },
  { href: "/dashboard/billing", label: "Plan & usage", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const MOBILE_ITEMS = NAV_ITEMS.slice(0, 4);

function isActive(path: string, href: string) {
  return href === "/dashboard" ? path === "/dashboard" : path.startsWith(href);
}

export function DashboardNav({ businessName }: { businessName: string }) {
  const pathname = usePathname();

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[266px] shrink-0 flex-col border-r border-[#E9E9F3] bg-white md:flex">
        <div className="border-b border-[#F0EFF7] px-6 py-6">
          <BrandWordmark href="/dashboard" />
          <p className="mt-2 pl-[52px] text-[10px] font-semibold uppercase tracking-[.2em] text-[#B0AFBF]">Your workspace</p>
        </div>
        <div className="mx-4 mt-6 flex items-center gap-3 rounded-2xl border border-[#ECEBF7] bg-[#F9F8FF] px-3 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E9E6FF] text-[#5C52DA]"><Sparkles className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-extrabold text-[#282440]">{businessName}</p><p className="mt-0.5 text-[10px] text-[#9390AD]">Business workspace</p></div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#9793BC]" />
        </div>
        <div className="px-4 pb-1 pt-8 text-[10px] font-extrabold uppercase tracking-[.17em] text-[#AAA9BC]">WORKSPACE</div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="Dashboard">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-bold transition-all ${active ? "bg-[#EEEAFE] text-[#554BCE]" : "text-[#71708A] hover:bg-[#F7F7FB] hover:text-[#292640]"}`}>
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
                <span className="flex-1">{label}</span>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-[#6C60E9]" />}
              </Link>
            );
          })}
        </nav>
        <div className="m-4 rounded-[20px] bg-gradient-to-br from-[#282058] to-[#5144AA] p-4 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><Sparkles className="h-4.5 w-4.5" /></div>
          <p className="mt-3 text-[13px] font-extrabold">Your next conversation awaits.</p>
          <p className="mt-1.5 text-[11px] leading-5 text-[#CBC5F5]">Keep your agent up to date with what customers need.</p>
          <Link href="/dashboard/knowledge" className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-white hover:underline">Manage knowledge <ArrowUpRight className="h-3.5 w-3.5" /></Link>
        </div>
      </aside>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[#E5E3F3] bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(27,23,57,.05)] backdrop-blur-xl md:hidden" aria-label="Mobile navigation">
        {MOBILE_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-[66px] flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold ${active ? "text-[#5D52DF]" : "text-[#9A99AD]"}`}>
            <span className={`flex h-9 w-11 items-center justify-center rounded-xl ${active ? "bg-[#EEEAFE]" : ""}`}><Icon className="h-[19px] w-[19px]" /></span>{label}
          </Link>;
        })}
      </nav>
    </>
  );
}
