import { requireDashboardContext } from "@/lib/auth/context";
import { InboxApp } from "./inbox-app";

export default async function InboxPage() {
  await requireDashboardContext(); // auth/tenant check; InboxApp fetches its own data client-side
  return <InboxApp />;
}
