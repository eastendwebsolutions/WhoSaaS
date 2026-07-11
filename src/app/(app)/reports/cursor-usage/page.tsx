import { getOrCreateCurrentUser } from "@/lib/auth/current-user";
import { canReviewEntries } from "@/lib/auth/rbac";
import { CursorUsageClient } from "@/components/reports/cursor-usage-client";

export default async function CursorUsagePage() {
  const user = await getOrCreateCurrentUser();
  if (!user) return null;

  return <CursorUsageClient isAdmin={canReviewEntries(user.role)} />;
}
