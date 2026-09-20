import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AdminPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.platformRole !== "PLATFORM_ADMIN") redirect("/dashboard");

  const [businesses, userCount, businessCount] = await Promise.all([
    prisma.business.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        subscription: true,
        _count: { select: { members: true, agents: true, conversations: true, knowledgeSources: true } },
      },
    }),
    prisma.user.count(),
    prisma.business.count(),
  ]);

  return (
    <main className="min-h-screen bg-paper px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/dashboard" className="text-xs text-muted hover:underline">← Dashboard</Link>
            <h1 className="mt-1 text-2xl font-semibold text-ink">Platform admin</h1>
            <p className="mt-1 text-sm text-muted">Business and account overview. Billing changes are platform-level controls.</p>
          </div>
          <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-muted">
            {session.user.email}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-md border border-line bg-white p-4"><p className="text-xs text-muted">Users</p><p className="mt-1 text-2xl font-semibold text-ink">{userCount}</p></div>
          <div className="rounded-md border border-line bg-white p-4"><p className="text-xs text-muted">Businesses</p><p className="mt-1 text-2xl font-semibold text-ink">{businessCount}</p></div>
          <div className="rounded-md border border-line bg-white p-4"><p className="text-xs text-muted">Showing</p><p className="mt-1 text-2xl font-semibold text-ink">{businesses.length}</p></div>
        </div>

        <section className="mt-8 overflow-hidden rounded-md border border-line bg-white">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Businesses</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line bg-paper text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Members</th>
                  <th className="px-4 py-3 font-medium">Agents</th>
                  <th className="px-4 py-3 font-medium">Conversations</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {businesses.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{b.name}</p>
                      <p className="text-xs text-muted">{b.contactEmail ?? "No contact email"}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium">{b.subscription?.plan ?? "FREE"}</td>
                    <td className="px-4 py-3 text-muted">{b._count.members}</td>
                    <td className="px-4 py-3 text-muted">{b._count.agents}</td>
                    <td className="px-4 py-3 text-muted">{b._count.conversations}</td>
                    <td className="px-4 py-3 text-xs text-muted">{b.createdAt.toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {businesses.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">No businesses yet.</p>}
        </section>
      </div>
    </main>
  );
}
