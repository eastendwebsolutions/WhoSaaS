import { describe, expect, it } from "vitest";
import {
  getBillingPeriodBounds,
  getBillingPeriodLabel,
  getBillingWeekBounds,
  getDefaultBillingPeriodBounds,
  getMostRecentCompletedBillingWeek,
  isSundayOrMondayInBillingTz,
} from "./period";

describe("billing period utilities", () => {
  it("uses Saturday through Friday for the current billing week", () => {
    const now = new Date("2026-05-28T16:00:00.000Z");
    const { periodStart, periodEnd } = getBillingWeekBounds(now);
    expect(periodStart.toISOString().slice(0, 10)).toBe("2026-05-23");
    expect(periodEnd.toISOString().slice(0, 10)).toBe("2026-05-29");
    expect(getBillingPeriodLabel(periodStart, periodEnd)).toBe("May 23, 2026 to May 29, 2026");
  });

  it("returns previous completed week when current week is in progress", () => {
    const now = new Date("2026-05-01T16:00:00.000Z");
    const { periodStart, periodEnd } = getMostRecentCompletedBillingWeek(now);
    expect(periodStart.toISOString().slice(0, 10)).toBe("2026-04-18");
    expect(periodEnd.toISOString().slice(0, 10)).toBe("2026-04-24");
  });

  it("uses the current billing week regardless of company", () => {
    const now = new Date("2026-05-28T16:00:00.000Z");
    const expected = getBillingWeekBounds(now);
    const { periodStart, periodEnd } = getBillingPeriodBounds("spartanrestoration.com", now);
    expect(periodStart).toEqual(expected.periodStart);
    expect(periodEnd).toEqual(expected.periodEnd);
  });

  it("formats billing labels using long month names", () => {
    const label = getBillingPeriodLabel(new Date("2026-04-25T00:00:00.000Z"), new Date("2026-05-01T00:00:00.000Z"));
    expect(label).toContain("2026");
    expect(label).toContain("to");
  });

  it("detects Sunday and Monday in the billing timezone", () => {
    expect(isSundayOrMondayInBillingTz(new Date("2026-07-05T16:00:00.000Z"))).toBe(true);
    expect(isSundayOrMondayInBillingTz(new Date("2026-07-06T16:00:00.000Z"))).toBe(true);
    expect(isSundayOrMondayInBillingTz(new Date("2026-07-08T16:00:00.000Z"))).toBe(false);
  });

  it("defaults to the previous completed week on Sunday and Monday", () => {
    const sunday = new Date("2026-07-05T16:00:00.000Z");
    const monday = new Date("2026-07-06T16:00:00.000Z");
    const expected = getMostRecentCompletedBillingWeek(sunday);

    for (const now of [sunday, monday]) {
      const { periodStart, periodEnd } = getDefaultBillingPeriodBounds(now);
      expect(periodStart.toISOString().slice(0, 10)).toBe(expected.periodStart.toISOString().slice(0, 10));
      expect(periodEnd.toISOString().slice(0, 10)).toBe(expected.periodEnd.toISOString().slice(0, 10));
      expect(periodStart.toISOString().slice(0, 10)).toBe("2026-06-27");
      expect(periodEnd.toISOString().slice(0, 10)).toBe("2026-07-03");
    }
  });

  it("defaults to the current billing week on other weekdays", () => {
    const wednesday = new Date("2026-07-08T16:00:00.000Z");
    const { periodStart, periodEnd } = getDefaultBillingPeriodBounds(wednesday);
    const current = getBillingWeekBounds(wednesday);
    expect(periodStart).toEqual(current.periodStart);
    expect(periodEnd).toEqual(current.periodEnd);
  });
});

