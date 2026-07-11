import type { TopDriver } from "./types";
import { CURSOR_RULE_VERSION } from "./types";

export type CoachingInputUser = {
  userId: string | null;
  email: string;
  displayName: string | null;
  totalRequests: number;
  acceptedCompletions: number;
  daysWithUsage: number;
  poolSharePercent: number | null;
  topDrivers: TopDriver[];
  agentCount: number;
  planCount: number;
  askCount: number;
  skillsCount: number;
  mcpCount: number;
};

export type CoachingFindingDraft = {
  userId: string | null;
  ruleKey: string;
  category: string;
  severity: string;
  title: string;
  explanation: string;
  recommendedAction: string;
  evidenceJson: Record<string, unknown>;
  thresholdJson: Record<string, unknown>;
};

function acceptanceRate(user: CoachingInputUser): number | null {
  if (user.totalRequests <= 0) return null;
  return user.acceptedCompletions / user.totalRequests;
}

export function buildCoachingFindings(users: CoachingInputUser[]): CoachingFindingDraft[] {
  const findings: CoachingFindingDraft[] = [];
  const periodDays = 90;

  for (const user of users) {
    if (user.daysWithUsage === 0) {
      findings.push({
        userId: user.userId,
        ruleKey: "adoption_cadence_none",
        category: "adoption",
        severity: "opportunity",
        title: "No recent Cursor activity",
        explanation: `${user.displayName ?? user.email} had no recorded Cursor usage in the last ${periodDays} days.`,
        recommendedAction: "Identify one recurring task this week where Cursor can help, such as test fixes or small refactors.",
        evidenceJson: { daysWithUsage: user.daysWithUsage, periodDays },
        thresholdJson: { minDaysWithUsage: 1 },
      });
      continue;
    }

    if (user.daysWithUsage > 0 && user.daysWithUsage < 5) {
      findings.push({
        userId: user.userId,
        ruleKey: "adoption_cadence_intermittent",
        category: "adoption",
        severity: "opportunity",
        title: "Intermittent Cursor usage",
        explanation: `${user.displayName ?? user.email} used Cursor on ${user.daysWithUsage} of the last ${periodDays} days.`,
        recommendedAction: "Pick one daily workflow to run through Cursor consistently so patterns become easier to review.",
        evidenceJson: { daysWithUsage: user.daysWithUsage, periodDays },
        thresholdJson: { minDaysWithUsage: 5 },
      });
    }

    if (user.agentCount > 20 && user.planCount === 0 && user.askCount === 0) {
      findings.push({
        userId: user.userId,
        ruleKey: "feature_breadth_agent_only",
        category: "workflow",
        severity: "opportunity",
        title: "Heavy Agent usage without Plan or Ask",
        explanation: "Most activity is Agent-driven, with little Plan or Ask usage.",
        recommendedAction: "Try Plan for multi-step changes and Ask for quick clarifications before large Agent runs.",
        evidenceJson: { agentCount: user.agentCount, planCount: user.planCount, askCount: user.askCount },
        thresholdJson: { minAgentCount: 20 },
      });
    }

    if (user.agentCount > 10 && user.skillsCount === 0 && user.mcpCount === 0) {
      findings.push({
        userId: user.userId,
        ruleKey: "reusable_context_missing",
        category: "workflow",
        severity: "opportunity",
        title: "Repeated usage without reusable context",
        explanation: "There is repeated Agent usage but no Skills or MCP adoption yet.",
        recommendedAction: "Capture team conventions in Skills or MCP tools so Cursor starts with better context.",
        evidenceJson: { agentCount: user.agentCount, skillsCount: user.skillsCount, mcpCount: user.mcpCount },
        thresholdJson: { minAgentCount: 10 },
      });
    }

    const topModel = user.topDrivers.find((d) => d.key.startsWith("model:"));
    if (topModel && topModel.sharePercent >= 70) {
      findings.push({
        userId: user.userId,
        ruleKey: "model_concentration",
        category: "model_selection",
        severity: "opportunity",
        title: "Usage concentrated in one model",
        explanation: `${topModel.label} accounts for about ${topModel.sharePercent}% of measured activity.`,
        recommendedAction: "Experiment with a lower-cost model for routine edits and keep the current model for complex changes.",
        evidenceJson: { model: topModel.label, sharePercent: topModel.sharePercent },
        thresholdJson: { maxModelSharePercent: 70 },
      });
    }

    const rate = acceptanceRate(user);
    if (rate != null && rate < 0.35 && user.totalRequests >= 20) {
      findings.push({
        userId: user.userId,
        ruleKey: "completion_workflow_low_acceptance",
        category: "prompting",
        severity: "opportunity",
        title: "Low completion acceptance rate",
        explanation: `Accepted completions are about ${Math.round(rate * 100)}% of total requests.`,
        recommendedAction: "Use smaller, scoped prompts with explicit file context and acceptance criteria.",
        evidenceJson: { acceptanceRate: rate, totalRequests: user.totalRequests },
        thresholdJson: { minAcceptanceRate: 0.35 },
      });
    }

    if (user.poolSharePercent != null && user.poolSharePercent >= 25) {
      const driverLabel = user.topDrivers[0]?.label ?? "usage activity";
      findings.push({
        userId: user.userId,
        ruleKey: "pool_contribution_high",
        category: "budget",
        severity: "info",
        title: "Notable share of team pool usage",
        explanation: `${user.displayName ?? user.email} represents about ${user.poolSharePercent}% of team pool spend, driven mainly by ${driverLabel}.`,
        recommendedAction: "Review whether this usage pattern matches high-value work, and whether model or mode changes could reduce cost for routine tasks.",
        evidenceJson: {
          poolSharePercent: user.poolSharePercent,
          topDrivers: user.topDrivers,
        },
        thresholdJson: { poolShareThresholdPercent: 25 },
      });
    }
  }

  const activeUsers = users.filter((u) => u.daysWithUsage > 0);
  if (activeUsers.length >= 2) {
    const withPlan = activeUsers.filter((u) => u.planCount > 0).length;
    if (withPlan / activeUsers.length >= 0.5) {
      findings.push({
        userId: null,
        ruleKey: "team_learning_plan_adoption",
        category: "team_learning",
        severity: "positive",
        title: "Team is using Plan mode regularly",
        explanation: `${withPlan} of ${activeUsers.length} active teammates used Plan mode in this period.`,
        recommendedAction: "Share one example prompt pattern that worked well so others can reuse it.",
        evidenceJson: { withPlan, activeUsers: activeUsers.length },
        thresholdJson: { minPlanAdoptionRatio: 0.5 },
      });
    }
  }

  return findings;
}

export { CURSOR_RULE_VERSION };
