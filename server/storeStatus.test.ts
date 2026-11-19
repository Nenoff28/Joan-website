import { describe, expect, it } from "vitest";
import { storeStatus } from "../client/src/lib/storeStatus";

const hours: string[][] = [
  ["Понеделник – Петък", "08:00 – 19:00"],
  ["Събота", "08:00 – 18:00"],
  ["Неделя", "08:00 – 17:00"],
];
// 2026-11-19 is a Thursday, 2026-11-21 a Saturday, 2026-11-22 a Sunday.
const at = (date: string, time: string) => new Date(`${date}T${time}:00`);

describe("storeStatus", () => {
  it("is open during weekday hours and points at the Monday–Friday row", () => {
    expect(storeStatus(hours, at("2026-11-19", "09:54"))).toEqual({ open: true, today: 0 });
    expect(storeStatus(hours, at("2026-11-19", "18:59")).open).toBe(true);
  });

  it("is closed before opening and from closing time", () => {
    expect(storeStatus(hours, at("2026-11-19", "07:59")).open).toBe(false);
    expect(storeStatus(hours, at("2026-11-19", "19:00")).open).toBe(false);
  });

  it("uses the Saturday and Sunday rows", () => {
    expect(storeStatus(hours, at("2026-11-21", "17:30"))).toEqual({ open: true, today: 1 });
    expect(storeStatus(hours, at("2026-11-21", "18:00"))).toEqual({ open: false, today: 1 });
    expect(storeStatus(hours, at("2026-11-22", "16:59"))).toEqual({ open: true, today: 2 });
  });

  it("reads hours written with a non-breaking space or a hyphen", () => {
    expect(storeStatus([["x", "08:00 – 19:00"], ["y", "08:00 - 18:00"], ["z", "08:00 – 17:00"]], at("2026-11-19", "10:00")).open).toBe(true);
  });

  it("stays closed when the hours cannot be read", () => {
    expect(storeStatus([["x", "по уговорка"], ["y", ""], ["z", ""]], at("2026-11-19", "10:00")).open).toBe(false);
  });
});
