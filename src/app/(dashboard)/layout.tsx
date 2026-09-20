import { requireDashboardContext } from "@/lib/auth/context";
import { DashboardNav } from "@/components/dashboard/nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { business } = await requireDashboardContext();

  return (
    <div className="flex min-h-screen bg-paper">
      <DashboardNav businessName={business.name} />
      <main className="flex-1 pb-20 md:pb-0">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
