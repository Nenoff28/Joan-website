import { describe, expect, it } from "vitest";
import { buildAdminReportingSnapshot } from "./catalogueService";

describe("admin reporting snapshot", () => {
  it("groups real request records by Sofia calendar day, week, month and year without calling requested value profit", () => {
    const result = buildAdminReportingSnapshot([
      { createdAt: new Date("2026-08-21T21:30:00.000Z"), status: "new", totalEur: "12.50" },
      { createdAt: new Date("2026-08-22T09:00:00.000Z"), status: "confirmed", totalEur: "20.00" },
      { createdAt: new Date("2026-08-18T12:00:00.000Z"), status: "closed", totalEur: "30.00" },
      { createdAt: new Date("2026-07-31T21:30:00.000Z"), status: "cancelled", totalEur: "99.00" },
      { createdAt: new Date("2025-12-31T12:00:00.000Z"), status: "closed", totalEur: "40.00" },
    ], new Date("2026-08-22T12:00:00.000Z"));

    expect(result).toMatchObject({ asOf: "2026-08-22", timeZone: "Europe/Sofia" });
    expect(result.periods.today).toMatchObject({ requestCount: 2, activeRequestCount: 2, requestedValueEur: 32.5, confirmedRequestValueEur: 20, statusCounts: { new: 1, confirmed: 1 } });
    expect(result.periods.week).toMatchObject({ requestCount: 3, requestedValueEur: 62.5, confirmedRequestValueEur: 50 });
    expect(result.periods.month).toMatchObject({ requestCount: 4, requestedValueEur: 62.5, confirmedRequestValueEur: 50, statusCounts: { cancelled: 1 } });
    expect(result.periods.year).toMatchObject({ requestCount: 4 });
  });
});
