import type { CursorDailyUsageRow, CursorSpendRow, NormalizedAccountAllowance, TopDriver } from "./types";

export function centsToDollars(cents: number | null | undefined): number | null {
  if (cents == null) return null;
  return Math.round(cents) / 100;
}

export function deriveAccountAllowance(
  spendRows: CursorSpendRow[],
  dailyRows: CursorDailyUsageRow[],
  billingCycleStart: Date,
  billingCycleEnd: Date,
): NormalizedAccountAllowance {
  const onDemandSpendCents = spendRows.reduce((sum, row) => sum + row.spendCents, 0);
  const includedSpendCents = spendRows.reduce((sum, row) => sum + (row.includedSpendCents ?? 0), 0);
  const overallSpendCents = spendRows.reduce(
    (sum, row) => sum + (row.overallSpendCents ?? row.spendCents + (row.includedSpendCents ?? 0)),
    0,
  );

  const tierRow = spendRows.find((row) => row.billingTier);
  const percentRow = spendRows.find((row) => row.totalPercentUsed != null);

  const poolUsedCents = includedSpendCents > 0 ? includedSpendCents : overallSpendCents;
  const subscriptionIncludedReqs =
    dailyRows.find((row) => row.subscriptionIncludedReqs != null)?.subscriptionIncludedReqs ?? null;

  let poolUsedPercent = percentRow?.totalPercentUsed ?? null;
  if (poolUsedPercent == null && subscriptionIncludedReqs && subscriptionIncludedReqs > 0) {
    const usedReqs = dailyRows.reduce((sum, row) => sum + row.totalRequests, 0);
    poolUsedPercent = Math.min(100, (usedReqs / subscriptionIncludedReqs) * 100);
  }

  const poolRemainingCents =
    includedSpendCents > 0 && poolUsedPercent != null
      ? Math.max(0, includedSpendCents * (1 - poolUsedPercent / 100))
      : null;

  return {
    billingCycleStart,
    billingCycleEnd,
    includedSpendCents: includedSpendCents > 0 ? includedSpendCents : null,
    onDemandSpendCents,
    overallSpendCents,
    poolUsedCents,
    poolRemainingCents,
    poolUsedPercent,
    billingTier: tierRow?.billingTier ?? null,
    subscriptionIncludedReqs,
    autoPercentUsed: percentRow?.autoPercentUsed ?? null,
    apiPercentUsed: percentRow?.apiPercentUsed ?? null,
    totalPercentUsed: percentRow?.totalPercentUsed ?? null,
    allowanceSource: includedSpendCents > 0 ? "teams_spend" : onDemandSpendCents > 0 ? "derived" : "unknown",
    rawAllowanceJson: {
      userCount: spendRows.length,
      onDemandSpendCents,
      includedSpendCents,
      overallSpendCents,
    },
  };
}

export function deriveTopDrivers(input: {
  modelUsage: Record<string, number>;
  agentCount: number;
  tabCount: number;
  planCount: number;
  askCount: number;
  skillsCount: number;
  mcpCount: number;
  totalRequests: number;
}): TopDriver[] {
  const buckets: TopDriver[] = [
    { key: "agent", label: "Agent", value: input.agentCount, sharePercent: 0 },
    { key: "tab", label: "Tab", value: input.tabCount, sharePercent: 0 },
    { key: "plan", label: "Plan", value: input.planCount, sharePercent: 0 },
    { key: "ask", label: "Ask", value: input.askCount, sharePercent: 0 },
    { key: "skills", label: "Skills", value: input.skillsCount, sharePercent: 0 },
    { key: "mcp", label: "MCP", value: input.mcpCount, sharePercent: 0 },
  ];

  for (const [model, count] of Object.entries(input.modelUsage)) {
    buckets.push({ key: `model:${model}`, label: model, value: count, sharePercent: 0 });
  }

  const total =
    buckets.reduce((sum, item) => sum + item.value, 0) || input.totalRequests || 1;

  return buckets
    .map((item) => ({ ...item, sharePercent: Math.round((item.value / total) * 1000) / 10 }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

export function computePoolSharePercent(userSpendCents: number, teamSpendCents: number): number | null {
  if (teamSpendCents <= 0) return null;
  return Math.round((userSpendCents / teamSpendCents) * 1000) / 10;
}
