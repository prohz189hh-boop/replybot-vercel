import Link from "next/link";
import {
  Activity, ArrowRight, ArrowUpRight, Bot, BookOpen, CheckCircle2,
  CircleHelp, Inbox, MessageCircle, Sparkles, TrendingUp, Users, Zap,
} from "lucide-react";
import { requireDashboardContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { PLAN_LIMITS, getPlan } from "@/lib/billing/entitlements";
import { StatusBadge } from "@/components/ui/primitives";

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  theme = "violet",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Inbox;
  theme?: "violet" | "green" | "amber" | "blue";
}) {
  const iconClasses = {
    violet: "bg-[#EEEAFE] text-[#6054DA]",
    green: "bg-[#E6F8EF] text-[#249A71]",
    amber: "bg-[#FFF1E4] text-[#C47E31]",
    blue: "bg-[#E7F1FE] text-[#447CCC]",
  };
  return (
    <div className="rounded-[22px] border border-[#E9E9F3] bg-white p-5 shadow-[0_10px_30px_rgba(35,27,76,.035)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-bold text-[#818199]">{label}</p>
        <span className={"flex h-10 w-10 items-center justify-center rounded-[14px] " + iconClasses[theme]}><Icon className="h-[19px] w-[19px]" /></span>
      </div>
      <p className="mt-3 text-[32px] font-extrabold leading-none tracking-[-.055em] text-[#25213F]">{value}</p>
      <p className="mt-2 text-[11px] font-medium text-[#A09DB4]">{detail}</p>
    </div>
  );
}

function SectionHeader({ title, note, href, action }: { title: string; note: string; href?: string; action?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-[16px] font-extrabold tracking-tight text-[#282441]">{title}</h2><p className="mt-1 text-[12px] text-[#9291A7]">{note}</p></div>
      {href && <Link href={href} className="inline-flex items-center gap-1.5 text-[12px] font-extrabold text-[#6459E7] hover:underline">{action ?? "View all"} <ArrowUpRight className="h-4 w-4" /></Link>}
    </div>
  );
}

export default async function DashboardOverviewPage() {
  const { user, business } = await requireDashboardContext();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const period = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");

  const [
    totalConversations,
    aiConversations,
    resolvedConversations,
    needsHuman,
    activeAgents,
    knowledgeSources,
    unansweredCount,
    usageRecord,
    plan,
    recentConversations,
    unansweredQuestions,
  ] = await Promise.all([
    prisma.conversation.count({ where: { businessId: business.id, createdAt: { gte: since30d } } }),
    prisma.conversation.count({ where: { businessId: business.id, status: "AI", createdAt: { gte: since30d } } }),
    prisma.conversation.count({ where: { businessId: business.id, status: "RESOLVED", createdAt: { gte: since30d } } }),
    prisma.conversation.count({ where: { businessId: business.id, status: { in: ["WAITING_FOR_HUMAN", "HUMAN"] } } }),
    prisma.agent.count({ where: { businessId: business.id, isActive: true } }),
    prisma.knowledgeSource.count({ where: { businessId: business.id, status: "READY" } }),
    prisma.unansweredQuestion.count({ where: { businessId: business.id, status: "UNANSWERED" } }),
    prisma.usageRecord.findUnique({ where: { businessId_metric_period: { businessId: business.id, metric: "ai_messages", period } } }),
    getPlan(business.id),
    prisma.conversation.findMany({
      where: { businessId: business.id },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { customer: { select: { name: true, email: true, externalId: true } } },
    }),
    prisma.unansweredQuestion.findMany({
      where: { businessId: business.id, status: "UNANSWERED" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const resolutionRate = totalConversations > 0 ? Math.round((resolvedConversations / totalConversations) * 100) : null;
  const usageLimit = PLAN_LIMITS[plan].ai_messages;
  const usageUsed = usageRecord?.count ?? 0;
  const usagePercent = usageLimit > 0 ? Math.min(100, Math.round((usageUsed / usageLimit) * 100)) : 0;
  const firstName = user.name?.trim().split(" ")[0] ?? "there";
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#8F8AAE]">YOUR WORKSPACE / OVERVIEW</p>
          <h1 className="mt-2 text-[29px] font-extrabold tracking-[-.05em] text-[#272341] sm:text-[34px]">{greeting}, {firstName} <span aria-hidden="true">✳</span></h1>
          <p className="mt-1 text-[13px] text-[#84839A]">Here&apos;s what&apos;s happening at {business.name}.</p>
        </div>
        <Link href="/dashboard/agents" className="rp-primary"><Bot className="h-[17px] w-[17px]" /> Manage your agents <ArrowRight className="h-4 w-4" /></Link>
      </div>

      <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-[130deg] from-[#1B1845] via-[#302668] to-[#5543B9] px-6 py-8 text-white shadow-[0_20px_50px_rgba(49,38,121,.17)] sm:px-9 sm:py-9">
        <div className="pointer-events-none absolute -right-16 -top-24 h-[300px] w-[300px] rounded-full border-[44px] border-white/[.035]" />
        <div className="pointer-events-none absolute -bottom-48 right-20 h-[360px] w-[360px] rounded-full bg-[#8175FF]/20 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-8 sm:flex-row sm:items-center">
          <div className="max-w-[510px]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.15em] text-[#DDD7FF]"><Sparkles className="h-3.5 w-3.5" /> REPLYPILOT CONTROL CENTER</span>
            <h2 className="mt-4 text-[25px] font-extrabold leading-tight tracking-[-.045em] sm:text-[32px]">{activeAgents === 0 ? "Let’s bring your first agent to life." : "Your support, all in one place."}</h2>
            <p className="mt-3 max-w-[475px] text-[13px] leading-6 text-[#CCC6EF]">
              {activeAgents === 0 ? "Set up an AI agent, add what it should know, and test it before inviting customers." : "See what your agent is handling, keep an eye on conversations, and step in when customers need you."}
            </p>
            <Link href={activeAgents === 0 ? "/onboarding" : "/dashboard/inbox"} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-[12px] font-extrabold text-[#493DA5] transition hover:bg-[#F2EFFF]">
              {activeAgents === 0 ? "Complete setup" : "Open conversations"} <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-start">
            <span className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/20 bg-white/15"><Bot className="h-7 w-7" /></span>
            <div><p className="text-[26px] font-extrabold leading-none">{activeAgents}</p><p className="mt-1 text-[11px] text-[#CFCAEC]">Active AI {activeAgents === 1 ? "agent" : "agents"}</p></div>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="At a glance" note="Real data from the past 30 days, except where marked." />
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Conversations" value={totalConversations} detail="Started in the past 30 days" icon={MessageCircle} />
          <Metric label="AI handling" value={aiConversations} detail="Conversations currently with AI" icon={Zap} theme="blue" />
          <Metric label="Needs a human" value={needsHuman} detail="Currently awaiting or with your team" icon={Users} theme="amber" />
          <Metric label="Resolved" value={resolutionRate === null ? "—" : resolutionRate + "%"} detail={resolutionRate === null ? "No conversations yet" : resolvedConversations + " of " + totalConversations + " started"} icon={TrendingUp} theme="green" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,1fr)]">
        <div className="rounded-[22px] border border-[#E9E9F3] bg-white p-5 sm:p-6">
          <SectionHeader title="Recent conversations" note="Your latest customer activity." href="/dashboard/inbox" action="Open inbox" />
          <div className="mt-5">
            {recentConversations.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#DFDDF2] bg-[#FCFBFF] px-6 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EDEAFF] text-[#6054DA]"><Inbox className="h-6 w-6" /></span>
                <p className="mt-4 text-[13px] font-extrabold text-[#292540]">It&apos;s quiet here — for now.</p>
                <p className="mt-2 max-w-[270px] text-[12px] leading-5 text-[#89889E]">When customers start talking to your agent, their conversations will appear here.</p>
                <Link href="/dashboard/agents" className="mt-5 text-[12px] font-extrabold text-[#6257EF] hover:underline">Set up an agent →</Link>
              </div>
            ) : (
              <div className="divide-y divide-[#F0EFF5]">
                {recentConversations.map((conversation) => (
                  <Link key={conversation.id} href="/dashboard/inbox" className="flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition hover:bg-[#F9F8FF]">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0EEFC] text-[#665BE2]"><MessageCircle className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-[#38344D]">{conversation.customer.name ?? conversation.customer.email ?? "Visitor " + conversation.customer.externalId.slice(0, 8)}</span>
                    <StatusBadge status={conversation.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[22px] border border-[#E9E9F3] bg-white p-5 sm:p-6">
          <SectionHeader title="Your plan & usage" note="AI activity in the current month." href="/dashboard/billing" action="Plan details" />
          <div className="mt-6 rounded-[17px] bg-[#F6F4FF] p-5">
            <div className="flex items-center justify-between"><span className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#756CC1]">{plan} PLAN</span><Activity className="h-4 w-4 text-[#665ADB]" /></div>
            <p className="mt-5 text-[28px] font-extrabold tracking-[-.04em] text-[#30285E]">{usageUsed} <span className="text-[13px] font-semibold text-[#8F8AB2]">/ {usageLimit} messages</span></p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#DFDBFA]"><div className="h-full rounded-full bg-[#665ADB]" style={{ width: usagePercent + "%" }} /></div>
            <p className="mt-3 text-[11px] text-[#8580AA]">{usagePercent}% of your monthly AI message allowance used</p>
          </div>
          <div className="mt-5 flex items-center justify-between border-b border-[#F1F0F6] pb-4 text-[12px]"><span className="flex items-center gap-2 text-[#85839B]"><Bot className="h-4 w-4" /> Active agents</span><strong className="text-[#35314F]">{activeAgents}</strong></div>
          <div className="flex items-center justify-between pt-4 text-[12px]"><span className="flex items-center gap-2 text-[#85839B]"><BookOpen className="h-4 w-4" /> Ready knowledge sources</span><strong className="text-[#35314F]">{knowledgeSources}</strong></div>
        </div>
      </div>

      <div className="rounded-[22px] border border-[#E9E9F3] bg-white p-5 sm:p-6">
        <SectionHeader title="Questions to follow up" note="Knowledge gaps that may need your attention." href="/dashboard/knowledge" action="Manage knowledge" />
        {unansweredQuestions.length === 0 ? (
          <div className="mt-5 flex items-center gap-4 rounded-2xl bg-[#F6FAF8] px-5 py-5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E6F8EF] text-[#249A71]"><CheckCircle2 className="h-6 w-6" /></span><div><p className="text-[13px] font-extrabold text-[#2C3C36]">No questions flagged right now</p><p className="mt-1 text-[12px] text-[#82958A]">Unanswered customer questions will be collected here when they occur.</p></div></div>
        ) : (
          <div className="mt-4 divide-y divide-[#F0EFF5]">
            {unansweredQuestions.map((question) => (
              <div key={question.id} className="flex items-start gap-3 py-3"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-[#CA913A]" /><div className="min-w-0"><p className="text-[12px] font-semibold text-[#36324D]">{question.question}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[.09em] text-[#A5A0A8]">{question.reason.replace(/_/g, " ").toLowerCase()}</p></div></div>
            ))}
          </div>
        )}
        {unansweredCount > unansweredQuestions.length && <p className="mt-3 text-[11px] text-[#88849B]">{unansweredCount - unansweredQuestions.length} more unanswered questions in your workspace.</p>}
      </div>
    </div>
  );
}
