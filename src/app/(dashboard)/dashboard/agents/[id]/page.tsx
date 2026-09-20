import { notFound } from "next/navigation";
import { requireDashboardContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { AgentEditor } from "./agent-editor";

export default async function AgentDetailPage({ params }: { params: { id: string } }) {
  const { business } = await requireDashboardContext();

  const agent = await prisma.agent.findFirst({
    where: { id: params.id, businessId: business.id }, // tenant-scoped in the query itself
    include: { widgetConfig: true },
  });

  if (!agent) notFound();

  return <AgentEditor agent={agent} />;
}
