import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canVisitAdminSection, firstAdminPath } from "../shared/permissions";

const adminPage = readFileSync(
  resolve(process.cwd(), "client/src/pages/Admin.tsx"),
  "utf8"
);
const orderDetailPage = readFileSync(
  resolve(process.cwd(), "client/src/pages/AdminOrderDetail.tsx"),
  "utf8"
);

function functionSource(name: string, nextName: string) {
  const start = adminPage.indexOf(`function ${name}`);
  const end = adminPage.indexOf(`function ${nextName}`, start + 1);
  if (start < 0 || end < 0) throw new Error(`Could not isolate ${name}`);
  return adminPage.slice(start, end);
}

describe("granular administrator UI permission contract", () => {
  it("uses staff.me and shared route helpers before mounting a workspace", () => {
    expect(adminPage).toContain("trpc.staff.me.useQuery()");
    expect(adminPage).toContain("canVisitAdminSection");
    expect(adminPage).toContain("firstAdminPath");
    expect(adminPage).toContain(
      "if (!canVisitAdminSection(permissions, location))"
    );
    expect(adminPage).toContain(
      'return <AccessDeniedState text="Непознат административен маршрут." />'
    );
    expect(adminPage).toContain("setLocation(redirectPath)");
    expect(adminPage).toContain(
      'if (location === "/admin/users-roles") return <AdminUsersRoles />'
    );
  });

  it("matches the shared route catalog, including the users/roles exception", () => {
    expect(canVisitAdminSection(["orders.read"], "/admin/orders")).toBe(true);
    expect(canVisitAdminSection(["orders.read"], "/admin/products")).toBe(
      false
    );
    expect(canVisitAdminSection(["users.read"], "/admin/users-roles")).toBe(
      true
    );
    expect(canVisitAdminSection(["roles.read"], "/admin/users-roles")).toBe(
      true
    );
    expect(canVisitAdminSection(["activity.read"], "/admin/users-roles")).toBe(
      false
    );
    expect(canVisitAdminSection(["orders.read"], "/admin/not-a-section")).toBe(
      false
    );
    expect(firstAdminPath(["orders.read"])).toBe("/admin/orders");
    expect(firstAdminPath([])).toBeNull();
  });

  it("gates data queries with the matching granular read permission", () => {
    expect(adminPage).toContain("trpc.admin.productCategories.useQuery");
    expect(adminPage).toMatch(
      /enabled:\s*canReadCategories\s*\|\|\s*canWriteProducts/
    );
    expect(adminPage).toContain(
      "trpc.admin.products.useQuery(undefined, { enabled: canReadProducts && catalogueReady })"
    );
    expect(adminPage).toContain(
      "trpc.admin.operations.useQuery(undefined, { enabled: canReadInventory })"
    );
    expect(adminPage).toContain(
      "trpc.admin.operations.useQuery(undefined, { enabled: canReadPromotions })"
    );
    expect(adminPage).toContain(
      "trpc.admin.orders.useQuery(undefined, { enabled: canReadOrders })"
    );
    expect(adminPage).toContain(
      "trpc.admin.contactEnquiries.useQuery(undefined, { enabled: canReadEnquiries })"
    );
    expect(adminPage).toContain(
      "trpc.admin.brochures.useQuery(undefined, { enabled: canReadBrochures })"
    );
    expect(adminPage).toContain(
      "trpc.admin.operations.useQuery(undefined, { enabled: canReadActivity })"
    );
  });

  it("does not re-query the aggregate operations endpoint from the orders page", () => {
    const orders = functionSource("AdminOrders", "AdminContactEnquiries");
    expect(orders).not.toContain("trpc.admin.operations");
    expect(orders).toContain("orderCounts");
    expect(orders).toContain("orders.data ?? []");
  });

  it("makes mutation controls read-only without dispatching mutations", () => {
    expect(adminPage).toContain("if (!canEditProductForm) return;");
    expect(adminPage).toContain("fieldset disabled={!canWriteProducts}");
    expect(adminPage).toContain("disabled={!categoryOptions.length}");
    expect(adminPage).toMatch(/if\s*\(canWriteInventory\)\s*adjust\.mutate/);
    expect(adminPage).toContain("if (!canWrite) return;");
    expect(adminPage).toContain("fieldset disabled={!canWriteCategories}");
    expect(orderDetailPage).toContain(
      'const canWrite = Boolean(staff.data?.permissions.includes("orders.write"));'
    );
    expect(orderDetailPage).toContain(
      "fieldset disabled={!canWrite || update.isPending}"
    );
    expect(orderDetailPage).toContain("update.mutate({");
    expect(orderDetailPage).toContain("adminNote: comment.trim() || null");
    expect(adminPage).toContain("if (canWriteEnquiries) update.mutate");
    expect(adminPage).toContain(
      "if (workbookData && canImportCustomers) importer.mutate"
    );
    expect(adminPage).toContain(
      "if (csvData && canImportLegacyOrders) importer.mutate"
    );
    expect(adminPage).toContain("if (!file || !canWriteBrochures) return;");
  });

  it("renders role and customer-role activity labels", () => {
    expect(adminPage).toContain('"role.created": "създаде роля"');
    expect(adminPage).toContain('"role.updated": "обнови роля"');
    expect(adminPage).toContain('"role.deleted": "изтри роля"');
    expect(adminPage).toContain(
      '"customer.role_assigned": "назначи роля на клиент"'
    );
  });
});
