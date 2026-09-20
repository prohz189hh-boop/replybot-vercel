import { requireDashboardContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { getPlan, PLAN_LIMITS } from "@/lib/billing/entitlements";
import { Panel } from "@/components/ui/primitives";

const PLAN_NAMES = { FREE: "Free", PRO: "Pro", BUSINESS: "Business" };

export default async function BillingPage() {
  const { business } = await requireDashboardContext();

  const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [plan, aiUsage, agentCount, knowledgeCount, teamCount] = await Promise.all([
    getPlan(business.id),
    prisma.usageRecord.findUnique({ where: { businessId_metric_period: { businessId: business.id, metric: "ai_messages", period } } }),
    prisma.agent.count({ where: { businessId: business.id, isActive: true } }),
    prisma.knowledgeSource.count({ where: { businessId: business.id } }),
    prisma.businessMember.count({ where: { businessId: business.id } }),
  ]);

  const limits = PLAN_LIMITS[plan];
  const rows = [
    { label: "AI messages this month", used: aiUsage?.count ?? 0, limit: limits.ai_messages },
    { label: "Agents", used: agentCount, limit: limits.agents },
    { label: "Knowledge sources", used: knowledgeCount, limit: limits.knowledge_sources },
    { label: "Team members", used: teamCount, limit: limits.team_members },
  ];

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold text-ink">Billing</h1>

      <Panel className="mt-6 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted">Current plan</p>
            <p className="mt-1 text-lg font-semibold text-ink">{PLAN_NAMES[plan]}</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink">{r.label}</span>
                <span className="text-muted">
                  {r.used} / {r.limit}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper">
                <div
                  className="h-full bg-signal"
                  style={{ width: `${Math.min(100, (r.used / r.limit) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="mt-4 p-5">
        <p className="text-sm font-medium text-ink">Paid plans aren't enabled yet</p>
        <p className="mt-1 text-sm text-muted">
          This workspace is on the Free plan. Upgrading to Pro or Business (and the billing/checkout flow itself)
          hasn't been wired up — there's no working "Upgrade" button here because a fake one would be worse than none.
          The plan limits above are real and enforced; only the ability to purchase a higher tier is missing.
        </p>
      </Panel>
    </div>
  );
}
