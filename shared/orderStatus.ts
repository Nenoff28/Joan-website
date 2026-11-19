export type OrderStatus = "new" | "contacted" | "confirmed" | "closed" | "cancelled";

/** Allowed next statuses per current status (same status is always allowed to add a comment). */
export const orderStatusTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ["contacted", "confirmed", "cancelled"],
  contacted: ["confirmed", "cancelled"],
  confirmed: ["contacted", "closed", "cancelled"],
  closed: ["confirmed"],
  cancelled: ["new"],
};

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus) {
  return from === to || orderStatusTransitions[from].includes(to);
}
