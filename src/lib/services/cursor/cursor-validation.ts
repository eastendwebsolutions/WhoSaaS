import type { CursorUsageFilters } from "./cursor-query";
import { probeCursorCapabilities } from "./cursor-admin-client";

export function formatCursorApiKeyError(message: string): string {
  if (/invalid team api key/i.test(message)) {
    return "Not a Team Admin API key. In Cursor, open Dashboard → API Keys, create a Team Admin key with admin scope (starts with crsr_). Personal or Agent keys will not work.";
  }
  if (/enterprise/i.test(message)) {
    return "This Cursor team may require an Enterprise plan for the Admin API.";
  }
  return message;
}

export async function validateCursorTeamAdminKey(apiKey: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { ok: false, message: "API key is required." };
  }
  const capabilities = await probeCursorCapabilities(trimmed);
  if (!capabilities.spend) {
    return {
      ok: false,
      message: formatCursorApiKeyError(capabilities.spendError ?? "Cursor rejected this API key."),
    };
  }
  return { ok: true };
}

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
