"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Bot,
  BookOpen,
  BarChart3,
  Users,
  CreditCard,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/inbox", label: "Inbox", icon: Inbox },
  { href: "/dashboard/agents", label: "Agents", icon: Bot },
  { href: "/dashboard/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/team", label: "Team", icon: Users },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

// Mobile bottom bar only has room for the things checked most often —
// the rest stay reachable from /dashboard/settings on small screens.
const MOBILE_ITEMS = NAV_ITEMS.slice(0, 4);

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}

export function DashboardNav({ businessName }: { businessName: string }) {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-white md:flex">
        <div className="border-b border-line px-5 py-4">
          <p className="truncate text-sm font-semibold text-ink">{businessName}</p>
          <p className="text-xs text-muted">ReplyPilot</p>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-signal-50 text-signal-700" : "text-ink hover:bg-paper"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-white md:hidden"
        aria-label="Primary"
      >
        {MOBILE_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium ${
                active ? "text-signal-700" : "text-muted"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
