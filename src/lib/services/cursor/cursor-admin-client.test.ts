import { describe, expect, it } from "vitest";
import { parseDailyUsageRow, parseExternalUserId, parseSpendRow } from "./cursor-admin-client";

describe("cursor-admin-client parsers", () => {
  it("accepts numeric Cursor user ids", () => {
    expect(parseExternalUserId({ userId: 12345 })).toBe("12345");
  });

  it("parses teamMemberSpend rows", () => {
    const row = parseSpendRow({
      userId: 12345,
      email: "dev@example.com",
      name: "Dev",
      spendCents: 100.5,
      overallSpendCents: 250.25,
    });
    expect(row?.userId).toBe("12345");
    expect(row?.spendCents).toBe(100.5);
    expect(row?.includedSpendCents).toBeCloseTo(149.75);
  });

  it("parses daily usage rows with Cursor field names", () => {
    const row = parseDailyUsageRow({
      userId: 99,
      day: "2026-07-01",
      email: "dev@example.com",
      agentRequests: 5,
      chatRequests: 3,
      composerRequests: 2,
      totalAccepts: 4,
      acceptedLinesAdded: 10,
      acceptedLinesDeleted: 1,
      totalLinesAdded: 15,
      totalLinesDeleted: 2,
      totalTabsAccepted: 7,
      mostUsedModel: "gpt-5",
    });
    expect(row?.userId).toBe("99");
    expect(row?.date).toBe("2026-07-01");
    expect(row?.totalRequests).toBe(10);
    expect(row?.agentCount).toBe(5);
    expect(row?.tabCount).toBe(7);
  });
});
