import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  companies,
  cursorAccountAllowanceSnapshots,
  cursorCoachingFindings,
  cursorFeatureUsageDaily,
  cursorSpendSnapshots,
  cursorTeamConnections,
  cursorUsageDaily,
  users,
} from "@/lib/db/schema";
import { centsToDollars } from "./cursor-allowance-normalizer";

export type CursorUsageFilters = {
  connectionId?: string;
  startDate: string;
  endDate: string;
  userId?: string;
};

function parseNum(value: string | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function listCursorConnections(companyId: string) {
  return db.query.cursorTeamConnections.findMany({
    where: and(eq(cursorTeamConnections.companyId, companyId), eq(cursorTeamConnections.isActive, true)),
    columns: {
      id: true,
      accountLabel: true,
      cursorTeamId: true,
      lastSyncStartedAt: true,
      lastSyncSuccessAt: true,
      lastSyncError: true,
      firstSyncCompletedAt: true,
      apiCapabilitiesJson: true,
    },
    orderBy: [desc(cursorTeamConnections.createdAt)],
  });
}

export async function getCursorWorkspaceContext(companyId: string) {
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
    columns: { asanaWorkspaceId: true, name: true },
  });
  return {
    companyName: company?.name ?? "Company",
    asanaWorkspaceId: company?.asanaWorkspaceId ?? null,
  };
}

export async function getCursorUsageSummary(companyId: string, connectionId?: string) {
  const connections = await listCursorConnections(companyId);
  const scoped = connectionId ? connections.filter((c) => c.id === connectionId) : connections;
  const connectionIds = scoped.map((c) => c.id);
  if (connectionIds.length === 0) {
    return {
      connections: [],
      cards: [
        { key: "pool_used_percent", label: "Team pool used", value: null, tooltip: "Connect a Cursor account to begin syncing." },
        { key: "pool_remaining", label: "Pool remaining", value: null, tooltip: "Based on Cursor team allowance." },
        { key: "active_users", label: "Active Cursor users", value: 0, tooltip: "Users with spend in the current billing cycle." },
        { key: "unmapped_users", label: "Unmapped users", value: 0, tooltip: "Cursor users without a matching WhoSaaS account." },
      ],
      lastSyncAt: null,
    };
  }

  const latestAllowance = await db
    .select()
    .from(cursorAccountAllowanceSnapshots)
    .where(
      and(
        eq(cursorAccountAllowanceSnapshots.companyId, companyId),
        connectionId ? eq(cursorAccountAllowanceSnapshots.connectionId, connectionId) : sql`true`,
      ),
    )
    .orderBy(desc(cursorAccountAllowanceSnapshots.snapshotAt))
    .limit(connectionIds.length);

  const latestSpend = await db
    .select()
    .from(cursorSpendSnapshots)
    .where(
      and(
        eq(cursorSpendSnapshots.companyId, companyId),
        inArray(cursorSpendSnapshots.connectionId, connectionIds),
      ),
    )
    .orderBy(desc(cursorSpendSnapshots.snapshotAt));

  const seen = new Set<string>();
  const uniqueSpend = latestSpend.filter((row) => {
    const key = `${row.connectionId}:${row.cursorExternalUserId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const poolUsedPercent =
    latestAllowance.reduce((sum, row) => sum + (parseNum(row.poolUsedPercent) ?? 0), 0) /
    Math.max(latestAllowance.length, 1);
  const poolRemaining = latestAllowance.reduce((sum, row) => sum + (parseNum(row.poolRemainingCents) ?? 0), 0);
  const unmapped = uniqueSpend.filter((row) => !row.userId).length;
  const lastSyncAt = scoped.reduce<Date | null>((latest, conn) => {
    if (!conn.lastSyncSuccessAt) return latest;
    if (!latest || conn.lastSyncSuccessAt > latest) return conn.lastSyncSuccessAt;
    return latest;
  }, null);

  return {
    connections: scoped,
    cards: [
      {
        key: "pool_used_percent",
        label: "Team pool used",
        value: Number.isFinite(poolUsedPercent) ? Math.round(poolUsedPercent * 10) / 10 : null,
        tooltip: "Percent of the shared Cursor team pool consumed this billing cycle.",
      },
      {
        key: "pool_remaining",
        label: "Pool remaining",
        value: centsToDollars(poolRemaining),
        tooltip: "Estimated remaining included pool based on Cursor API data.",
      },
      {
        key: "active_users",
        label: "Active Cursor users",
        value: uniqueSpend.length,
        tooltip: "Users with spend in the current billing cycle.",
      },
      {
        key: "unmapped_users",
        label: "Unmapped users",
        value: unmapped,
        tooltip: "Cursor users shown by email when no WhoSaaS account match exists.",
      },
    ],
    lastSyncAt,
    allowance: latestAllowance,
  };
}

export async function getCursorUsageUsers(companyId: string, filters: CursorUsageFilters) {
  const connections = await listCursorConnections(companyId);
  const connectionIds = filters.connectionId
    ? connections.filter((c) => c.id === filters.connectionId).map((c) => c.id)
    : connections.map((c) => c.id);

  if (connectionIds.length === 0) return [];

  const spendRows = await db
    .select()
    .from(cursorSpendSnapshots)
    .where(and(eq(cursorSpendSnapshots.companyId, companyId), inArray(cursorSpendSnapshots.connectionId, connectionIds)))
    .orderBy(desc(cursorSpendSnapshots.snapshotAt));

  const seen = new Set<string>();
  const latestByUser = spendRows.filter((row) => {
    const key = `${row.connectionId}:${row.cursorExternalUserId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const userIds = latestByUser.map((r) => r.userId).filter((id): id is string => Boolean(id));
  const appUsers =
    userIds.length > 0
      ? await db.query.users.findMany({
          where: inArray(users.id, userIds),
          columns: { id: true, email: true, displayName: true },
        })
      : [];
  const userMap = new Map(appUsers.map((u) => [u.id, u]));

  const findings = await db.query.cursorCoachingFindings.findMany({
    where: eq(cursorCoachingFindings.companyId, companyId),
  });
  const findingCount = new Map<string, number>();
  for (const f of findings) {
    const key = f.userId ?? "team";
    findingCount.set(key, (findingCount.get(key) ?? 0) + 1);
  }

  return latestByUser
    .filter((row) => (filters.userId ? row.userId === filters.userId : true))
    .map((row) => {
      const appUser = row.userId ? userMap.get(row.userId) : null;
      const connection = connections.find((c) => c.id === row.connectionId);
      return {
        connectionId: row.connectionId,
        accountLabel: connection?.accountLabel ?? "Account",
        userId: row.userId,
        cursorExternalUserId: row.cursorExternalUserId,
        displayName: appUser?.displayName ?? row.sourceEmail ?? "Unknown",
        email: appUser?.email ?? row.sourceEmail ?? "",
        mapped: Boolean(row.userId),
        spendDollars: centsToDollars(parseNum(row.spendCents)),
        poolSharePercent: parseNum(row.teamPoolSharePercent),
        topDrivers: row.topDriverJson,
        suggestionCount: findingCount.get(row.userId ?? "team") ?? 0,
      };
    });
}

export async function getCursorUsageTrends(companyId: string, filters: CursorUsageFilters) {
  const start = new Date(`${filters.startDate}T00:00:00.000Z`);
  const end = new Date(`${filters.endDate}T23:59:59.999Z`);
  const connectionFilter = filters.connectionId
    ? eq(cursorUsageDaily.connectionId, filters.connectionId)
    : sql`true`;
  const userFilter = filters.userId ? eq(cursorUsageDaily.userId, filters.userId) : sql`true`;

  const rows = await db
    .select({
      usageDate: cursorUsageDaily.usageDate,
      totalRequests: sql<number>`coalesce(sum(${cursorUsageDaily.totalRequests}), 0)::int`.mapWith(Number),
      acceptedCompletions: sql<number>`coalesce(sum(${cursorUsageDaily.acceptedCompletions}), 0)::int`.mapWith(Number),
      aiLinesAdded: sql<number>`coalesce(sum(${cursorUsageDaily.aiLinesAdded}), 0)::int`.mapWith(Number),
    })
    .from(cursorUsageDaily)
    .where(
      and(
        eq(cursorUsageDaily.companyId, companyId),
        gte(cursorUsageDaily.usageDate, start),
        lte(cursorUsageDaily.usageDate, end),
        connectionFilter,
        userFilter,
      ),
    )
    .groupBy(cursorUsageDaily.usageDate)
    .orderBy(cursorUsageDaily.usageDate);

  return rows.map((row) => ({
    date: row.usageDate.toISOString().slice(0, 10),
    totalRequests: row.totalRequests,
    acceptedCompletions: row.acceptedCompletions,
    aiLinesAdded: row.aiLinesAdded,
  }));
}

export async function getCursorCoachingSuggestions(companyId: string, connectionId?: string, userId?: string) {
  const conditions = [eq(cursorCoachingFindings.companyId, companyId)];
  if (connectionId) conditions.push(eq(cursorCoachingFindings.connectionId, connectionId));
  if (userId) conditions.push(eq(cursorCoachingFindings.userId, userId));

  return db.query.cursorCoachingFindings.findMany({
    where: and(...conditions),
    orderBy: [desc(cursorCoachingFindings.generatedAt)],
  });
}

export async function getCursorUserDetail(companyId: string, userId: string, filters: CursorUsageFilters) {
  const appUser = await db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.companyId, companyId)),
    columns: { id: true, email: true, displayName: true },
  });
  if (!appUser) throw new Error("Not found");

  const start = new Date(`${filters.startDate}T00:00:00.000Z`);
  const end = new Date(`${filters.endDate}T23:59:59.999Z`);

  const usage = await db
    .select({
      totalRequests: sql<number>`coalesce(sum(${cursorUsageDaily.totalRequests}), 0)::int`.mapWith(Number),
      acceptedCompletions: sql<number>`coalesce(sum(${cursorUsageDaily.acceptedCompletions}), 0)::int`.mapWith(Number),
      aiLinesAdded: sql<number>`coalesce(sum(${cursorUsageDaily.aiLinesAdded}), 0)::int`.mapWith(Number),
      daysWithUsage: sql<number>`count(distinct ${cursorUsageDaily.usageDate})::int`.mapWith(Number),
    })
    .from(cursorUsageDaily)
    .where(
      and(
        eq(cursorUsageDaily.companyId, companyId),
        eq(cursorUsageDaily.userId, userId),
        gte(cursorUsageDaily.usageDate, start),
        lte(cursorUsageDaily.usageDate, end),
      ),
    );

  const spend = await db.query.cursorSpendSnapshots.findFirst({
    where: and(eq(cursorSpendSnapshots.companyId, companyId), eq(cursorSpendSnapshots.userId, userId)),
    orderBy: [desc(cursorSpendSnapshots.snapshotAt)],
  });

  const suggestions = await getCursorCoachingSuggestions(companyId, filters.connectionId, userId);
  const trends = await getCursorUsageTrends(companyId, { ...filters, userId });

  return {
    user: appUser,
    usage: usage[0] ?? { totalRequests: 0, acceptedCompletions: 0, aiLinesAdded: 0, daysWithUsage: 0 },
    spend: spend
      ? {
          spendDollars: centsToDollars(parseNum(spend.spendCents)),
          poolSharePercent: parseNum(spend.teamPoolSharePercent),
          topDrivers: spend.topDriverJson,
        }
      : null,
    trends,
    suggestions,
  };
}

export async function getCursorFeatureTrends(companyId: string, filters: CursorUsageFilters) {
  const start = new Date(`${filters.startDate}T00:00:00.000Z`);
  const end = new Date(`${filters.endDate}T23:59:59.999Z`);
  const rows = await db
    .select({
      usageDate: cursorFeatureUsageDaily.usageDate,
      agentCount: sql<number>`coalesce(sum(${cursorFeatureUsageDaily.agentCount}), 0)::int`.mapWith(Number),
      tabCount: sql<number>`coalesce(sum(${cursorFeatureUsageDaily.tabCount}), 0)::int`.mapWith(Number),
      planCount: sql<number>`coalesce(sum(${cursorFeatureUsageDaily.planCount}), 0)::int`.mapWith(Number),
    })
    .from(cursorFeatureUsageDaily)
    .where(
      and(
        eq(cursorFeatureUsageDaily.companyId, companyId),
        gte(cursorFeatureUsageDaily.usageDate, start),
        lte(cursorFeatureUsageDaily.usageDate, end),
        filters.connectionId ? eq(cursorFeatureUsageDaily.connectionId, filters.connectionId) : sql`true`,
        filters.userId ? eq(cursorFeatureUsageDaily.userId, filters.userId) : sql`true`,
      ),
    )
    .groupBy(cursorFeatureUsageDaily.usageDate)
    .orderBy(cursorFeatureUsageDaily.usageDate);

  return rows.map((row) => ({
    date: row.usageDate.toISOString().slice(0, 10),
    agentCount: row.agentCount,
    tabCount: row.tabCount,
    planCount: row.planCount,
  }));
}
