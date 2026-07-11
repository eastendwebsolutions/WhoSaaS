import { describe, expect, it } from "vitest";
import {
  centsToDollars,
  computePoolSharePercent,
  deriveAccountAllowance,
  deriveTopDrivers,
} from "./cursor-allowance-normalizer";
import type { CursorDailyUsageRow, CursorSpendRow } from "./types";

describe("cursor-allowance-normalizer", () => {
  it("converts cents to dollars", () => {
    expect(centsToDollars(1234)).toBe(12.34);
    expect(centsToDollars(null)).toBeNull();
  });

  it("derives account allowance from spend rows", () => {
    const spendRows: CursorSpendRow[] = [
      {
        userId: "u1",
        email: "a@example.com",
        name: "A",
        spendCents: 100,
        includedSpendCents: 500,
        overallSpendCents: 600,
        billingTier: "TIER_1000",
        autoPercentUsed: 10,
        apiPercentUsed: 5,
        totalPercentUsed: 40,
      },
      {
        userId: "u2",
        email: "b@example.com",
        name: "B",
        spendCents: 50,
        includedSpendCents: 300,
        overallSpendCents: 350,
        billingTier: null,
        autoPercentUsed: null,
        apiPercentUsed: null,
        totalPercentUsed: null,
      },
    ];
    const allowance = deriveAccountAllowance(
      spendRows,
      [],
      new Date("2026-07-01T00:00:00.000Z"),
      new Date("2026-07-31T00:00:00.000Z"),
    );
    expect(allowance.includedSpendCents).toBe(800);
    expect(allowance.onDemandSpendCents).toBe(150);
    expect(allowance.totalPercentUsed).toBe(40);
  });

  it("computes pool share percent", () => {
    expect(computePoolSharePercent(25, 100)).toBe(25);
    expect(computePoolSharePercent(0, 0)).toBeNull();
  });

  it("derives top drivers sorted by value", () => {
    const drivers = deriveTopDrivers({
      modelUsage: { "gpt-4": 80 },
      agentCount: 20,
      tabCount: 5,
      planCount: 0,
      askCount: 0,
      skillsCount: 0,
      mcpCount: 0,
      totalRequests: 100,
    });
    expect(drivers[0]?.key).toBe("model:gpt-4");
    expect(drivers.length).toBeGreaterThan(0);
  });
});

describe("daily usage parsing helpers", () => {
  it("handles subscription included reqs in allowance derivation", () => {
    const dailyRows: CursorDailyUsageRow[] = [
      {
        date: "2026-07-01",
        userId: "u1",
        email: "a@example.com",
        totalRequests: 10,
        acceptedCompletions: 5,
        aiLinesAdded: 1,
        aiLinesDeleted: 0,
        manualLinesAdded: 0,
        manualLinesDeleted: 0,
        sessionCount: 1,
        subscriptionIncludedReqs: 100,
        modelUsage: {},
        agentCount: 1,
        tabCount: 0,
        planCount: 0,
        askCount: 0,
        skillsCount: 0,
        mcpCount: 0,
      },
    ];
    const allowance = deriveAccountAllowance([], dailyRows, new Date(), new Date());
    expect(allowance.subscriptionIncludedReqs).toBe(100);
  });
});
