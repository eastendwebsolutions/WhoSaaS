import type { CursorApiCapabilities, CursorDailyUsageRow, CursorSpendRow } from "./types";

const BASE_URL = "https://api.cursor.com";
const MAX_DAILY_RANGE_MS = 30 * 86_400_000;

function authHeader(apiKey: string) {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseExternalUserId(raw: Record<string, unknown>): string | null {
  if (typeof raw.userId === "string" && raw.userId.trim()) return raw.userId.trim();
  if (typeof raw.userId === "number" && Number.isFinite(raw.userId)) return String(raw.userId);
  return null;
}

function parseUsageDateValue(raw: Record<string, unknown>): string | null {
  if (typeof raw.day === "string" && raw.day.trim()) return raw.day.trim();
  if (typeof raw.usageDate === "string" && raw.usageDate.trim()) return raw.usageDate.trim();
  const epoch = num(raw.date);
  if (epoch != null) return new Date(epoch).toISOString().slice(0, 10);
  return null;
}

export function parseSpendRow(raw: Record<string, unknown>): CursorSpendRow | null {
  const userId = parseExternalUserId(raw);
  const email = typeof raw.email === "string" ? raw.email : null;
  if (!userId || !email) return null;

  const spendCents = num(raw.spendCents) ?? 0;
  const overallSpendCents = num(raw.overallSpendCents) ?? spendCents;
  const includedSpendCents =
    num(raw.includedSpendCents) ??
    (overallSpendCents > spendCents ? overallSpendCents - spendCents : null);

  return {
    userId,
    email,
    name: typeof raw.name === "string" ? raw.name : null,
    spendCents,
    includedSpendCents,
    overallSpendCents,
    billingTier: typeof raw.billingTier === "string" ? raw.billingTier : null,
    autoPercentUsed: num(raw.autoPercentUsed),
    apiPercentUsed: num(raw.apiPercentUsed),
    totalPercentUsed: num(raw.totalPercentUsed),
  };
}

export function parseDailyUsageRow(raw: Record<string, unknown>): CursorDailyUsageRow | null {
  const userId = parseExternalUserId(raw);
  const date = parseUsageDateValue(raw);
  if (!userId || !date) return null;

  const agentRequests = num(raw.agentRequests) ?? 0;
  const chatRequests = num(raw.chatRequests) ?? 0;
  const composerRequests = num(raw.composerRequests) ?? 0;
  const cmdkUsages = num(raw.cmdkUsages) ?? 0;
  const totalRequests = agentRequests + chatRequests + composerRequests + cmdkUsages;
  const acceptedLinesAdded = num(raw.acceptedLinesAdded) ?? 0;
  const acceptedLinesDeleted = num(raw.acceptedLinesDeleted) ?? 0;
  const totalLinesAdded = num(raw.totalLinesAdded) ?? 0;
  const totalLinesDeleted = num(raw.totalLinesDeleted) ?? 0;
  const mostUsedModel = typeof raw.mostUsedModel === "string" ? raw.mostUsedModel : null;
  const modelUsage = mostUsedModel ? { [mostUsedModel]: totalRequests || 1 } : {};

  return {
    date,
    userId,
    email: typeof raw.email === "string" ? raw.email : null,
    totalRequests,
    acceptedCompletions: num(raw.totalAccepts) ?? 0,
    aiLinesAdded: acceptedLinesAdded,
    aiLinesDeleted: acceptedLinesDeleted,
    manualLinesAdded: Math.max(0, totalLinesAdded - acceptedLinesAdded),
    manualLinesDeleted: Math.max(0, totalLinesDeleted - acceptedLinesDeleted),
    sessionCount: agentRequests + composerRequests,
    subscriptionIncludedReqs: num(raw.subscriptionIncludedReqs),
    modelUsage,
    agentCount: agentRequests,
    tabCount: num(raw.totalTabsAccepted) ?? 0,
    planCount: composerRequests,
    askCount: chatRequests,
    skillsCount: 0,
    mcpCount: 0,
  };
}

type PostResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function postJson<T>(apiKey: string, path: string, body: Record<string, unknown>): Promise<PostResult<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(apiKey),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).catch((error: unknown) => ({
    ok: false,
    status: 0,
    statusText: error instanceof Error ? error.message : "Network error",
    json: async () => null,
  } as Response));

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
    const message = payload?.message ?? payload?.error ?? res.statusText ?? "Request failed";
    return { ok: false, status: res.status, error: message };
  }

  const data = (await res.json().catch(() => null)) as T | null;
  if (data == null) return { ok: false, status: res.status, error: "Empty response from Cursor API" };
  return { ok: true, data };
}

function rowsFromSpendBody(body: Record<string, unknown>): unknown[] {
  const candidates = [body.teamMemberSpend, body.data, body.users, body.spend];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

export async function probeCursorCapabilities(apiKey: string): Promise<CursorApiCapabilities & { spendError?: string }> {
  const spend = await postJson<Record<string, unknown>>(apiKey, "/teams/spend", { page: 1, pageSize: 1 });
  const usage = await postJson<Record<string, unknown>>(apiKey, "/teams/daily-usage-data", {
    startDate: Date.now() - 86_400_000,
    endDate: Date.now(),
    page: 1,
    pageSize: 1,
  });
  return {
    spend: spend.ok,
    dailyUsage: usage.ok,
    analyticsByUser: false,
    spendError: spend.ok ? undefined : spend.error,
  };
}

export async function fetchTeamSpend(apiKey: string): Promise<CursorSpendRow[]> {
  const all: CursorSpendRow[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await postJson<Record<string, unknown>>(apiKey, "/teams/spend", {
      page,
      pageSize: 100,
    });
    if (!result.ok) {
      if (all.length === 0) throw new Error(`Cursor spend API failed (${result.status}): ${result.error}`);
      break;
    }

    const body = result.data;
    totalPages = num(body.totalPages) ?? page;
    const parsed = rowsFromSpendBody(body)
      .map((row) => (row && typeof row === "object" ? parseSpendRow(row as Record<string, unknown>) : null))
      .filter((row): row is CursorSpendRow => row != null);
    all.push(...parsed);
    page += 1;
  }

  return all;
}

export async function fetchDailyUsageData(
  apiKey: string,
  startDate: Date,
  endDate: Date,
): Promise<CursorDailyUsageRow[]> {
  const all: CursorDailyUsageRow[] = [];
  let windowStart = startDate.getTime();

  while (windowStart < endDate.getTime()) {
    const windowEnd = Math.min(windowStart + MAX_DAILY_RANGE_MS, endDate.getTime());
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const result = await postJson<Record<string, unknown>>(apiKey, "/teams/daily-usage-data", {
        startDate: windowStart,
        endDate: windowEnd,
        page,
        pageSize: 1000,
      });
      if (!result.ok) {
        if (all.length === 0) throw new Error(`Cursor daily usage API failed (${result.status}): ${result.error}`);
        break;
      }

      const body = result.data;
      totalPages = num(body.totalPages) ?? page;
      const rows = body.data ?? body.usage ?? [];
      if (!Array.isArray(rows)) break;

      const parsed = rows
        .map((row) => (row && typeof row === "object" ? parseDailyUsageRow(row as Record<string, unknown>) : null))
        .filter((row): row is CursorDailyUsageRow => row != null);
      all.push(...parsed);
      page += 1;
    }

    windowStart = windowEnd + 1;
  }

  return all;
}
