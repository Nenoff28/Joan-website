import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) =>
  fs.readFileSync(path.resolve(import.meta.dirname, file), "utf8");

describe("admin order status history contracts", () => {
  it("keeps the immutable history table fields and request/created index in the schema", () => {
    const schema = read("../drizzle/schema.ts");
    expect(schema).toContain(
      'export const orderStatusHistory = mysqlTable("order_status_history"'
    );
    expect(schema).toContain('orderRequestId: int("orderRequestId")');
    expect(schema).toContain(
      'status: mysqlEnum("status", ["new", "contacted", "confirmed", "closed", "cancelled"])'
    );
    expect(schema).toContain('comment: text("comment")');
    expect(schema).toContain('authorId: int("authorId")');
    expect(schema).toContain(
      'authorName: varchar("authorName", { length: 255 }).notNull()'
    );
    expect(schema).toContain(
      'index("order_status_history_request_created_idx").on(table.orderRequestId, table.createdAt)'
    );
  });

  it("returns one batched order detail with decoded parameters, history, and a legacy synthetic item fallback", () => {
    const service = read("./catalogueService.ts");
    expect(service).toContain(
      "export async function getAdminOrderDetail(id: number)"
    );
    expect(service).toContain("Promise.all([");
    expect(service).toContain("from(orderStatusHistory)");
    expect(service).toContain(
      "orderBy(desc(orderStatusHistory.createdAt), desc(orderStatusHistory.id))"
    );
    expect(service).toContain(
      "parameters: orderParameters(item.parametersJson, productFeaturesJson)"
    );
    expect(service).toContain(
      "parameters: orderParameters(null, headerRow.productFeaturesJson)"
    );
    expect(service).toContain("id: 0, orderRequestId: headerRow.order.id");
    expect(service).toContain(
      "productFeaturesJson: catalogueProducts.featuresJson"
    );
  });

  it("updates the current order and appends exactly one immutable event atomically", () => {
    const service = read("./catalogueService.ts");
    const updateStart = service.indexOf(
      "export async function updateOrderRequest"
    );
    const updateEnd = service.indexOf(
      "export async function updateContactEnquiry",
      updateStart
    );
    const update = service.slice(updateStart, updateEnd);
    expect(update).toContain("db.transaction(async (tx)");
    expect(update).toContain("tx.update(orderRequests).set({ status, adminNote: comment })");
    expect(update).toContain("tx.insert(orderStatusHistory).values({ orderRequestId: id, status, comment, authorId: adminUserId, authorName })");
    expect(update).toContain("metadataJson: JSON.stringify({ status })");
    expect(update).not.toContain("update(orderStatusHistory)");
  });

  it("protects detail reads with orders.read and status writes with orders.write", () => {
    const router = read("./routers.ts");
    expect(router).toContain('orderDetail: permissionProcedure("orders.read")');
    expect(router).toContain("id: z.number().int().positive()");
    expect(router).toContain(
      'updateOrder: permissionProcedure("orders.write")'
    );
    expect(router).toContain("const actorId = ctx.staff.id");
    expect(router).toContain("ctx.staff.name");
  });
});
