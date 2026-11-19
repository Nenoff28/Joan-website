import { describe, expect, it } from "vitest";
import { canTransitionOrderStatus, orderStatusTransitions, type OrderStatus } from "../shared/orderStatus";

describe("order status transitions", () => {
  it("allows the normal flow and keeping the same status", () => {
    expect(canTransitionOrderStatus("new", "contacted")).toBe(true);
    expect(canTransitionOrderStatus("confirmed", "closed")).toBe(true);
    expect(canTransitionOrderStatus("closed", "closed")).toBe(true);
  });
  it("blocks jumping back from cancelled or closed except reopening", () => {
    expect(canTransitionOrderStatus("cancelled", "confirmed")).toBe(false);
    expect(canTransitionOrderStatus("closed", "new")).toBe(false);
    expect(canTransitionOrderStatus("cancelled", "new")).toBe(true);
    expect(canTransitionOrderStatus("closed", "confirmed")).toBe(true);
  });
  it("never leaves a status without a way forward", () => {
    for (const status of Object.keys(orderStatusTransitions) as OrderStatus[]) expect(orderStatusTransitions[status].length).toBeGreaterThan(0);
  });
});
