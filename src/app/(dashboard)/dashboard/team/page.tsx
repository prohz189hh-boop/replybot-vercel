import { requireDashboardContext } from "@/lib/auth/context";
import { TeamManager } from "./team-manager";

export default async function TeamPage() {
  const { role } = await requireDashboardContext();
  return (
    <div>
      <h1 className="text-xl font-semibold text-ink">Team</h1>
      <p className="mt-1 text-sm text-muted">Who has access to your ReplyPilot workspace.</p>
      <div className="mt-6">
        <TeamManager viewerRole={role} />
      </div>
    </div>
  );
}
