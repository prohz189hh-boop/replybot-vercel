import { requireDashboardContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { LinkButton } from "@/components/ui/button";
import { Panel, EmptyState, StatusBadge } from "@/components/ui/primitives";
import Link from "next/link";

export default async function AgentsPage() {
  const { business } = await requireDashboardContext();

  const agents = await prisma.agent.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { conversations: true, knowledgeSources: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Agents</h1>
          <p className="mt-1 text-sm text-muted">Each agent is a separate AI support assistant with its own knowledge base.</p>
        </div>
        <LinkButton href="/dashboard/agents/new">New agent</LinkButton>
      </div>

      <div className="mt-6">
        {agents.length === 0 ? (
          <EmptyState
            title="No agents yet"
            description="Create your first agent to start answering customer questions with AI."
            action={<LinkButton href="/dashboard/agents/new">Create an agent</LinkButton>}
          />
        ) : (
          <div className="divide-y divide-line rounded-md border border-line bg-white">
            {agents.map((agent) => (
              <Link
                key={agent.id}
                href={`/dashboard/agents/${agent.id}`}
                className="flex items-center justify-between px-4 py-3.5 hover:bg-paper"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{agent.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {agent._count.conversations} conversation{agent._count.conversations === 1 ? "" : "s"} ·{" "}
                    {agent._count.knowledgeSources} knowledge source{agent._count.knowledgeSources === 1 ? "" : "s"}
                  </p>
                </div>
                <StatusBadge status={agent.isActive ? "ACTIVE" : "INACTIVE"} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
