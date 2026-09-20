import { requireDashboardContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { EmptyState } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { KnowledgeManager } from "./knowledge-manager";

export default async function KnowledgePage() {
  const { business } = await requireDashboardContext();

  const agents = await prisma.agent.findMany({
    where: { businessId: business.id, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  if (agents.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-ink">Knowledge</h1>
        <div className="mt-6">
          <EmptyState
            title="Create an agent first"
            description="Knowledge sources belong to a specific agent. Create an agent, then come back here to add what it should know."
            action={<LinkButton href="/dashboard/agents/new">Create an agent</LinkButton>}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink">Knowledge</h1>
      <p className="mt-1 text-sm text-muted">What your agent knows — text, FAQs, website pages, and documents.</p>
      <div className="mt-6">
        <KnowledgeManager agents={agents} />
      </div>
    </div>
  );
}
