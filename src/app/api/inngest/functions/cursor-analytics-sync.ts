import { syncAllActiveCursorConnections } from "@/lib/services/cursor/cursor-sync";
import { inngest } from "./client";

export const cursorAnalyticsSync = inngest.createFunction(
  { id: "cursor-analytics-sync", triggers: [{ cron: "45 6 * * *" }] },
  async () => {
    const results = await syncAllActiveCursorConnections();
    return { synced: results.length, results };
  },
);
