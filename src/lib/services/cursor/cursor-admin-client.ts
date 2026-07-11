import type { CursorApiCapabilities, CursorDailyUsageRow, CursorSpendRow } from "./types";

const BASE_URL = "https://api.cursor.com";

function authHeader(apiKey: string) {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseSpendRow(raw: Record<string, unknown>): CursorSpendRow | null {
  const userId = typeof raw.userId === "string" ? raw.userId : null;
  const email = typeof raw.email === "string" ? raw.email : null;
  if (!userId || !email) return null;
  return {
    userId,
    email,
    name: typeof raw.name === "string" ? raw.name : null,
    spendCents: num(raw.spendCents) ?? 0,
    includedSpendCents: num(raw.includedSpendCents),
    overallSpendCents: num(raw.overallSpendCents) ?? num(raw.spendCents),
    billingTier: typeof raw.billingTier === "string" ? raw.billingTier : null,
    autoPercentUsed: num(raw.autoPercentUsed),
    apiPercentUsed: num(raw.apiPercentUsed),
    totalPercentUsed: num(raw.totalPercentUsed),
  };
}

function parseDailyUsageRow(raw: Record<string, unknown>): CursorDailyUsageRow | null {
  const userId = typeof raw.userId === "string" ? raw.userId : typeof raw.user_id === "string" ? raw.user_id : null;
  const date =
    typeof raw.date === "string"
      ? raw.date
      : typeof raw.day === "string"
        ? raw.day
        : typeof raw.usageDate === "string"
          ? raw.usageDate
          : null;
  if (!userId || !date) return null;

  const modelUsage =
    raw.modelUsage && typeof raw.modelUsage === "object" && !Array.isArray(raw.modelUsage)
      ? (raw.modelUsage as Record<string, number>)
      : raw.models && typeof raw.models === "object" && !Array.isArray(raw.models)
        ? (raw.models as Record<string, number>)
        : {};

  return {
    date,
    userId,
    email: typeof raw.email === "string" ? raw.email : null,
    totalRequests: num(raw.totalRequests) ?? num(raw.requests) ?? 0,
    acceptedCompletions: num(raw.acceptedCompletions) ?? num(raw.accepted) ?? 0,
    aiLinesAdded: num(raw.aiLinesAdded) ?? 0,
    aiLinesDeleted: num(raw.aiLinesDeleted) ?? 0,
    manualLinesAdded: num(raw.manualLinesAdded) ?? 0,
    manualLinesDeleted: num(raw.manualLinesDeleted) ?? 0,
    sessionCount: num(raw.sessionCount) ?? num(raw.sessions) ?? 0,
    subscriptionIncludedReqs: num(raw.subscriptionIncludedReqs),
    modelUsage,
    agentCount: num(raw.agentCount) ?? num(raw.agentRequests) ?? 0,
    tabCount: num(raw.tabCount) ?? num(raw.tabRequests) ?? 0,
    planCount: num(raw.planCount) ?? 0,
    askCount: num(raw.askCount) ?? 0,
    skillsCount: num(raw.skillsCount) ?? 0,
    mcpCount: num(raw.mcpCount) ?? 0,
  };
}

async function postJson<T>(apiKey: string, path: string, body: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(apiKey),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}

export async function probeCursorCapabilities(apiKey: string): Promise<CursorApiCapabilities> {
  const spendBody = await postJson<unknown>(apiKey, "/teams/spend", {});
  const usageBody = await postJson<unknown>(apiKey, "/teams/daily-usage-data", {
    startDate: Date.now() - 86_400_000,
    endDate: Date.now(),
  });
  return {
    spend: spendBody != null,
    dailyUsage: usageBody != null,
    analyticsByUser: false,
  };
}

export async function fetchTeamSpend(apiKey: string): Promise<CursorSpendRow[]> {
  const body = await postJson<{ data?: unknown[]; users?: unknown[]; spend?: unknown[] }>(apiKey, "/teams/spend", {});
  if (!body) return [];
  const rows = body.data ?? body.users ?? body.spend ?? [];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => (row && typeof row === "object" ? parseSpendRow(row as Record<string, unknown>) : null))
    .filter((row): row is CursorSpendRow => row != null);
}

export async function fetchDailyUsageData(
  apiKey: string,
  startDate: Date,
  endDate: Date,
): Promise<CursorDailyUsageRow[]> {
  const body = await postJson<{ data?: unknown[]; usage?: unknown[] }>(apiKey, "/teams/daily-usage-data", {
    startDate: startDate.getTime(),
    endDate: endDate.getTime(),
  });
  if (!body) return [];
  const rows = body.data ?? body.usage ?? [];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => (row && typeof row === "object" ? parseDailyUsageRow(row as Record<string, unknown>) : null))
    .filter((row): row is CursorDailyUsageRow => row != null);
}
