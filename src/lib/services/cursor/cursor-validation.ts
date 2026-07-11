import type { CursorUsageFilters } from "./cursor-query";

export function parseCursorUsageFilters(searchParams: URLSearchParams): CursorUsageFilters {
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  if (!startDate || !endDate) {
    const end = new Date();
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 90);
    return {
      connectionId: searchParams.get("connectionId") ?? undefined,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      userId: searchParams.get("userId") ?? undefined,
    };
  }
  return {
    connectionId: searchParams.get("connectionId") ?? undefined,
    startDate,
    endDate,
    userId: searchParams.get("userId") ?? undefined,
  };
}
