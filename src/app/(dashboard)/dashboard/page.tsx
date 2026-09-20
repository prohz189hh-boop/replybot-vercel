import { requireDashboardContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { PLAN_LIMITS, getPlan } from "@/lib/billing/entitlements";
import { Panel, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import Link from "next/link";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Panel className="p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </Panel>
  );
}

export default async function DashboardOverviewPage() {
  const { business } = await requireDashboardContext();

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

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

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink">Overview</h1>
      <p className="mt-1 text-sm text-muted">Last 30 days</p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Conversations" value={totalConversations} />
        <StatCard label="AI handled" value={aiConversations} />
        <StatCard label="Needs human" value={needsHuman} />
        <StatCard label="Resolution rate" value={resolutionRate !== null ? `${resolutionRate}%` : "—"} />
        <StatCard label="Active agents" value={activeAgents} />
        <StatCard label="Knowledge sources" value={knowledgeSources} />
        <StatCard label="Unanswered questions" value={unansweredCount} />
        <StatCard
          label="AI messages this month"
          value={`${usageUsed} / ${usageLimit}`}
          sub={`${plan} plan`}
        />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Recent conversations</h2>
            <Link href="/dashboard/inbox" className="text-xs font-medium text-signal-700 hover:underline">
              View inbox →
            </Link>
          </div>
          <div className="mt-3">
            {recentConversations.length === 0 ? (
              <EmptyState
                title="No conversations yet"
                description="Once your widget is live, conversations will show up here."
              />
            ) : (
              <div className="divide-y divide-line rounded-md border border-line bg-white">
                {recentConversations.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="truncate text-sm text-ink">
                      {c.customer.name ?? c.customer.email ?? `Visitor ${c.customer.externalId.slice(0, 8)}`}
                    </span>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Questions your AI couldn't answer</h2>
          </div>
          <div className="mt-3">
            {unansweredQuestions.length === 0 ? (
              <EmptyState title="Nothing pending" description="Escalated and low-confidence questions will show up here." />
            ) : (
              <div className="divide-y divide-line rounded-md border border-line bg-white">
                {unansweredQuestions.map((q) => (
                  <div key={q.id} className="px-3.5 py-2.5">
                    <p className="truncate text-sm text-ink">{q.question}</p>
                    <p className="mt-0.5 text-xs text-muted">{q.reason.replace(/_/g, " ").toLowerCase()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {activeAgents === 0 && (
        <div className="mt-8">
          <EmptyState
            title="Create your first agent"
            description="You'll need an agent before customers can start chatting."
            action={<LinkButton href="/dashboard/agents/new">Create an agent</LinkButton>}
          />
        </div>
      )}
    </div>
  );
}
