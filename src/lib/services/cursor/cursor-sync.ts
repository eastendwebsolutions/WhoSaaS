import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  cursorAccountAllowanceSnapshots,
  cursorCoachingFindings,
  cursorFeatureUsageDaily,
  cursorSpendSnapshots,
  cursorTeamConnections,
  cursorUsageDaily,
} from "@/lib/db/schema";
import { decrypt } from "@/lib/utils/crypto";
import { startOfUtcDay } from "@/lib/services/analytics/utc-day";
import { fetchDailyUsageData, fetchTeamSpend, probeCursorCapabilities } from "./cursor-admin-client";
import {
  computePoolSharePercent,
  deriveAccountAllowance,
  deriveTopDrivers,
} from "./cursor-allowance-normalizer";
import { buildCoachingFindings, type CoachingInputUser } from "./cursor-coaching-rules";
import { resolveIdentitiesForConnection } from "./cursor-identity-resolver";
import { CURSOR_BACKFILL_DAYS, type CursorDailyUsageRow } from "./types";

function currentBillingCycle(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { start, end };
}

function parseUsageDate(value: string): Date {
  if (/^\d+$/.test(value)) return startOfUtcDay(new Date(Number(value)));
  return startOfUtcDay(new Date(value));
}

function aggregateDailyByUser(rows: CursorDailyUsageRow[]) {
  const map = new Map<
    string,
    {
      totalRequests: number;
      acceptedCompletions: number;
      aiLinesAdded: number;
      aiLinesDeleted: number;
      manualLinesAdded: number;
      manualLinesDeleted: number;
      sessionCount: number;
      modelUsage: Record<string, number>;
      agentCount: number;
      tabCount: number;
      planCount: number;
      askCount: number;
      skillsCount: number;
      mcpCount: number;
      days: Set<string>;
    }
  >();

  for (const row of rows) {
    const existing = map.get(row.userId) ?? {
      totalRequests: 0,
      acceptedCompletions: 0,
      aiLinesAdded: 0,
      aiLinesDeleted: 0,
      manualLinesAdded: 0,
      manualLinesDeleted: 0,
      sessionCount: 0,
      modelUsage: {},
      agentCount: 0,
      tabCount: 0,
      planCount: 0,
      askCount: 0,
      skillsCount: 0,
      mcpCount: 0,
      days: new Set<string>(),
    };
    existing.totalRequests += row.totalRequests;
    existing.acceptedCompletions += row.acceptedCompletions;
    existing.aiLinesAdded += row.aiLinesAdded;
    existing.aiLinesDeleted += row.aiLinesDeleted;
    existing.manualLinesAdded += row.manualLinesAdded;
    existing.manualLinesDeleted += row.manualLinesDeleted;
    existing.sessionCount += row.sessionCount;
    existing.agentCount += row.agentCount;
    existing.tabCount += row.tabCount;
    existing.planCount += row.planCount;
    existing.askCount += row.askCount;
    existing.skillsCount += row.skillsCount;
    existing.mcpCount += row.mcpCount;
    existing.days.add(row.date);
    for (const [model, count] of Object.entries(row.modelUsage)) {
      existing.modelUsage[model] = (existing.modelUsage[model] ?? 0) + count;
    }
    map.set(row.userId, existing);
  }
  return map;
}

export async function syncCursorConnection(connectionId: string) {
  const conn = await db.query.cursorTeamConnections.findFirst({
    where: and(eq(cursorTeamConnections.id, connectionId), eq(cursorTeamConnections.isActive, true)),
  });
  if (!conn) throw new Error("Not found");

  await db
    .update(cursorTeamConnections)
    .set({ lastSyncStartedAt: new Date(), updatedAt: new Date() })
    .where(eq(cursorTeamConnections.id, conn.id));

  const apiKey = decrypt(conn.apiKeyEncrypted);
  const capabilities = await probeCursorCapabilities(apiKey);
  const spendRows = await fetchTeamSpend(apiKey);

  const end = new Date();
  const backfillStart = new Date();
  const days = conn.firstSyncCompletedAt ? 7 : CURSOR_BACKFILL_DAYS;
  backfillStart.setUTCDate(backfillStart.getUTCDate() - days);

  const dailyRows = await fetchDailyUsageData(apiKey, backfillStart, end);
  const identities = await resolveIdentitiesForConnection(conn.companyId, conn.id, spendRows);
  const billing = currentBillingCycle();
  const snapshotAt = new Date();
  const teamSpendCents = spendRows.reduce((sum, row) => sum + row.spendCents + (row.includedSpendCents ?? 0), 0);
  const allowance = deriveAccountAllowance(spendRows, dailyRows, billing.start, billing.end);
  const dailyByUser = aggregateDailyByUser(dailyRows);

  await db.insert(cursorAccountAllowanceSnapshots).values({
    connectionId: conn.id,
    companyId: conn.companyId,
    billingCycleStart: allowance.billingCycleStart,
    billingCycleEnd: allowance.billingCycleEnd,
    snapshotAt,
    includedSpendCents: allowance.includedSpendCents?.toString() ?? null,
    onDemandSpendCents: allowance.onDemandSpendCents?.toString() ?? null,
    overallSpendCents: allowance.overallSpendCents?.toString() ?? null,
    poolUsedCents: allowance.poolUsedCents?.toString() ?? null,
    poolRemainingCents: allowance.poolRemainingCents?.toString() ?? null,
    poolUsedPercent: allowance.poolUsedPercent?.toString() ?? null,
    billingTier: allowance.billingTier,
    subscriptionIncludedReqs: allowance.subscriptionIncludedReqs,
    autoPercentUsed: allowance.autoPercentUsed?.toString() ?? null,
    apiPercentUsed: allowance.apiPercentUsed?.toString() ?? null,
    totalPercentUsed: allowance.totalPercentUsed?.toString() ?? null,
    allowanceSource: allowance.allowanceSource,
    rawAllowanceJson: allowance.rawAllowanceJson,
  });

  for (const spend of spendRows) {
    const identity = identities.get(spend.userId);
    const usageAgg = dailyByUser.get(spend.userId);
    const userSpendCents = spend.spendCents + (spend.includedSpendCents ?? 0);
    const topDrivers = deriveTopDrivers({
      modelUsage: usageAgg?.modelUsage ?? {},
      agentCount: usageAgg?.agentCount ?? 0,
      tabCount: usageAgg?.tabCount ?? 0,
      planCount: usageAgg?.planCount ?? 0,
      askCount: usageAgg?.askCount ?? 0,
      skillsCount: usageAgg?.skillsCount ?? 0,
      mcpCount: usageAgg?.mcpCount ?? 0,
      totalRequests: usageAgg?.totalRequests ?? 0,
    });

    await db.insert(cursorSpendSnapshots).values({
      connectionId: conn.id,
      companyId: conn.companyId,
      cursorExternalUserId: spend.userId,
      userId: identity?.userId ?? null,
      billingCycleStart: billing.start,
      billingCycleEnd: billing.end,
      snapshotAt,
      spendCents: spend.spendCents.toString(),
      includedSpendCents: spend.includedSpendCents?.toString() ?? null,
      overallSpendCents: spend.overallSpendCents?.toString() ?? null,
      teamPoolSharePercent: computePoolSharePercent(userSpendCents, teamSpendCents)?.toString() ?? null,
      topDriverJson: topDrivers,
      billingTier: spend.billingTier,
      autoPercentUsed: spend.autoPercentUsed?.toString() ?? null,
      apiPercentUsed: spend.apiPercentUsed?.toString() ?? null,
      totalPercentUsed: spend.totalPercentUsed?.toString() ?? null,
      sourceEmail: spend.email,
    });
  }

  for (const row of dailyRows) {
    const identity = identities.get(row.userId);
    const usageDate = parseUsageDate(row.date);
    if (identity?.userId) {
      await db
        .insert(cursorUsageDaily)
        .values({
          companyId: conn.companyId,
          connectionId: conn.id,
          userId: identity.userId,
          usageDate,
          totalRequests: row.totalRequests,
          acceptedCompletions: row.acceptedCompletions,
          aiLinesAdded: row.aiLinesAdded,
          aiLinesDeleted: row.aiLinesDeleted,
          manualLinesAdded: row.manualLinesAdded,
          manualLinesDeleted: row.manualLinesDeleted,
          sessionCount: row.sessionCount,
          modelUsageJson: row.modelUsage,
          ingestionSource: "api",
        })
        .onConflictDoUpdate({
          target: [
            cursorUsageDaily.companyId,
            cursorUsageDaily.userId,
            cursorUsageDaily.usageDate,
            cursorUsageDaily.ingestionSource,
          ],
          set: {
            connectionId: conn.id,
            totalRequests: row.totalRequests,
            acceptedCompletions: row.acceptedCompletions,
            aiLinesAdded: row.aiLinesAdded,
            aiLinesDeleted: row.aiLinesDeleted,
            manualLinesAdded: row.manualLinesAdded,
            manualLinesDeleted: row.manualLinesDeleted,
            sessionCount: row.sessionCount,
            modelUsageJson: row.modelUsage,
            computedAt: new Date(),
            updatedAt: new Date(),
          },
        });
    }

    await db
      .insert(cursorFeatureUsageDaily)
      .values({
        connectionId: conn.id,
        companyId: conn.companyId,
        cursorExternalUserId: row.userId,
        userId: identity?.userId ?? null,
        usageDate,
        agentCount: row.agentCount,
        tabCount: row.tabCount,
        planCount: row.planCount,
        askCount: row.askCount,
        skillsCount: row.skillsCount,
        mcpCount: row.mcpCount,
        modelUsageJson: row.modelUsage,
        sourceEndpoint: "daily-usage-data",
        ingestionSource: "api",
      })
      .onConflictDoUpdate({
        target: [
          cursorFeatureUsageDaily.connectionId,
          cursorFeatureUsageDaily.cursorExternalUserId,
          cursorFeatureUsageDaily.usageDate,
          cursorFeatureUsageDaily.ingestionSource,
        ],
        set: {
          userId: identity?.userId ?? null,
          agentCount: row.agentCount,
          tabCount: row.tabCount,
          planCount: row.planCount,
          askCount: row.askCount,
          skillsCount: row.skillsCount,
          mcpCount: row.mcpCount,
          modelUsageJson: row.modelUsage,
          computedAt: new Date(),
          updatedAt: new Date(),
        },
      });
  }

  const coachingUsers: CoachingInputUser[] = spendRows.map((spend) => {
    const usageAgg = dailyByUser.get(spend.userId);
    const identity = identities.get(spend.userId);
    const userSpendCents = spend.spendCents + (spend.includedSpendCents ?? 0);
    return {
      userId: identity?.userId ?? null,
      email: spend.email,
      displayName: spend.name,
      totalRequests: usageAgg?.totalRequests ?? 0,
      acceptedCompletions: usageAgg?.acceptedCompletions ?? 0,
      daysWithUsage: usageAgg?.days.size ?? 0,
      poolSharePercent: computePoolSharePercent(userSpendCents, teamSpendCents),
      topDrivers: deriveTopDrivers({
        modelUsage: usageAgg?.modelUsage ?? {},
        agentCount: usageAgg?.agentCount ?? 0,
        tabCount: usageAgg?.tabCount ?? 0,
        planCount: usageAgg?.planCount ?? 0,
        askCount: usageAgg?.askCount ?? 0,
        skillsCount: usageAgg?.skillsCount ?? 0,
        mcpCount: usageAgg?.mcpCount ?? 0,
        totalRequests: usageAgg?.totalRequests ?? 0,
      }),
      agentCount: usageAgg?.agentCount ?? 0,
      planCount: usageAgg?.planCount ?? 0,
      askCount: usageAgg?.askCount ?? 0,
      skillsCount: usageAgg?.skillsCount ?? 0,
      mcpCount: usageAgg?.mcpCount ?? 0,
    };
  });

  const periodStart = startOfUtcDay(backfillStart);
  const periodEnd = startOfUtcDay(end);
  await db
    .delete(cursorCoachingFindings)
    .where(and(eq(cursorCoachingFindings.companyId, conn.companyId), eq(cursorCoachingFindings.connectionId, conn.id)));

  const findings = buildCoachingFindings(coachingUsers);
  for (const finding of findings) {
    await db.insert(cursorCoachingFindings).values({
      connectionId: conn.id,
      companyId: conn.companyId,
      userId: finding.userId,
      periodStart,
      periodEnd,
      ruleKey: finding.ruleKey,
      category: finding.category,
      severity: finding.severity,
      title: finding.title,
      explanation: finding.explanation,
      recommendedAction: finding.recommendedAction,
      evidenceJson: finding.evidenceJson,
      thresholdJson: finding.thresholdJson,
      ruleVersion: "1.0.0",
    });
  }

  await db
    .update(cursorTeamConnections)
    .set({
      lastSyncSuccessAt: new Date(),
      lastSyncError: null,
      firstSyncCompletedAt: conn.firstSyncCompletedAt ?? new Date(),
      apiCapabilitiesJson: capabilities,
      updatedAt: new Date(),
    })
    .where(eq(cursorTeamConnections.id, conn.id));

  return {
    connectionId: conn.id,
    spendUsers: spendRows.length,
    dailyRows: dailyRows.length,
    findings: findings.length,
    capabilities,
  };
}

export async function syncAllActiveCursorConnections(companyId?: string, connectionId?: string) {
  const connections = await db.query.cursorTeamConnections.findMany({
    where: eq(cursorTeamConnections.isActive, true),
  });
  const filtered = connections.filter((c) => {
    if (companyId && c.companyId !== companyId) return false;
    if (connectionId && c.id !== connectionId) return false;
    return true;
  });

  const results = [];
  for (const conn of filtered) {
    try {
      results.push(await syncCursorConnection(conn.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await db
        .update(cursorTeamConnections)
        .set({ lastSyncError: message, updatedAt: new Date() })
        .where(eq(cursorTeamConnections.id, conn.id));
      results.push({ connectionId: conn.id, error: message });
    }
  }
  return results;
}
