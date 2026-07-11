import { describe, expect, it } from "vitest";
import { buildCoachingFindings } from "./cursor-coaching-rules";
import type { CoachingInputUser } from "./cursor-coaching-rules";

const baseUser: CoachingInputUser = {
  userId: "11111111-1111-1111-1111-111111111111",
  email: "dev@example.com",
  displayName: "Dev",
  totalRequests: 50,
  acceptedCompletions: 10,
  daysWithUsage: 10,
  poolSharePercent: 30,
  topDrivers: [{ key: "model:gpt-4", label: "gpt-4", value: 40, sharePercent: 80 }],
  agentCount: 25,
  planCount: 0,
  askCount: 0,
  skillsCount: 0,
  mcpCount: 0,
};

describe("buildCoachingFindings", () => {
  it("creates pool contribution finding when share is high", () => {
    const findings = buildCoachingFindings([baseUser]);
    expect(findings.some((f) => f.ruleKey === "pool_contribution_high")).toBe(true);
  });

  it("does not create low acceptance finding when data is insufficient", () => {
    const findings = buildCoachingFindings([
      { ...baseUser, totalRequests: 5, acceptedCompletions: 1 },
    ]);
    expect(findings.some((f) => f.ruleKey === "completion_workflow_low_acceptance")).toBe(false);
  });

  it("creates adoption finding when there is no usage", () => {
    const findings = buildCoachingFindings([{ ...baseUser, daysWithUsage: 0, totalRequests: 0 }]);
    expect(findings.some((f) => f.ruleKey === "adoption_cadence_none")).toBe(true);
  });
});
