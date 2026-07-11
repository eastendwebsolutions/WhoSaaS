export type CursorSpendRow = {
  userId: string;
  email: string;
  name: string | null;
  spendCents: number;
  includedSpendCents: number | null;
  overallSpendCents: number | null;
  billingTier: string | null;
  autoPercentUsed: number | null;
  apiPercentUsed: number | null;
  totalPercentUsed: number | null;
};

export type CursorDailyUsageRow = {
  date: string;
  userId: string;
  email: string | null;
  totalRequests: number;
  acceptedCompletions: number;
  aiLinesAdded: number;
  aiLinesDeleted: number;
  manualLinesAdded: number;
  manualLinesDeleted: number;
  sessionCount: number;
  subscriptionIncludedReqs: number | null;
  modelUsage: Record<string, number>;
  agentCount: number;
  tabCount: number;
  planCount: number;
  askCount: number;
  skillsCount: number;
  mcpCount: number;
};

export type CursorApiCapabilities = {
  spend: boolean;
  dailyUsage: boolean;
  analyticsByUser: boolean;
};

export type NormalizedAccountAllowance = {
  billingCycleStart: Date;
  billingCycleEnd: Date;
  includedSpendCents: number | null;
  onDemandSpendCents: number | null;
  overallSpendCents: number | null;
  poolUsedCents: number | null;
  poolRemainingCents: number | null;
  poolUsedPercent: number | null;
  billingTier: string | null;
  subscriptionIncludedReqs: number | null;
  autoPercentUsed: number | null;
  apiPercentUsed: number | null;
  totalPercentUsed: number | null;
  allowanceSource: string;
  rawAllowanceJson: Record<string, unknown>;
};

export type TopDriver = {
  key: string;
  label: string;
  value: number;
  sharePercent: number;
};

export const CURSOR_RULE_VERSION = "1.0.0";
export const CURSOR_BACKFILL_DAYS = 90;
