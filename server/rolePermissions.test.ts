import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import { accessRoles, customerProfiles, users } from "../drizzle/schema";
import {
  ADMIN_SECTION_PERMISSIONS,
  ALL_PERMISSIONS,
  OPERATOR_PERMISSIONS,
  canVisitAdminSection,
  firstAdminPath,
  hasPermission,
  normalizePermissions,
} from "../shared/permissions";
import {
  assignAccessRole,
  assertDelegation,
  getStaffAccess,
  parsePermissions,
  publicStaffAccess,
  saveAccessRole,
} from "./accessControl";
import { isTrustedMutationOrigin } from "./permissionProcedures";
import { appRouter } from "./routers";

/**
 * These tests intentionally replace the customer identity and database boundaries.
 * No test below opens a database connection or relies on browser/checkpoint state.
 */
const fixtures = vi.hoisted(() => {
  const customerAccounts = {
    activateCustomerAccount: vi.fn(),
    clearCustomerSession: vi.fn(),
    getCustomerFromRequest: vi.fn(),
    getCustomerIdentityFromRequest: vi.fn(),
    importLegacyCustomers: vi.fn(),
    loginCustomer: vi.fn(),
    previewLegacyCustomerWorkbook: vi.fn(),
  };
  const catalogueService = {
    activateAdminBrochure: vi.fn(),
    adjustProductStock: vi.fn(),
    archiveAdminBrochure: vi.fn(),
    createAdminProduct: vi.fn(),
    createContactEnquiry: vi.fn(),
    createOrderRequest: vi.fn(),
    getAdminBrochures: vi.fn(),
    getAdminCategories: vi.fn(),
    getAdminProductCategories: vi.fn(),
    getAdminContactEnquiries: vi.fn(),
    getAdminOperations: vi.fn(),
    getAdminOrders: vi.fn(),
    getAdminOrderDetail: vi.fn(),
    getAdminProducts: vi.fn(),
    getAdminSummary: vi.fn(),
    getPublicBestSellers: vi.fn(),
    getPublicBrochure: vi.fn(),
    getPublicCatalogue: vi.fn(),
    getPublicCatalogueMetadata: vi.fn(),
    getPublicCataloguePage: vi.fn(),
    getPublicProductBySlug: vi.fn(),
    getPublicProductsBySlugs: vi.fn(),
    logAdminActivity: vi.fn(),
    replaceAdminBrochure: vi.fn(),
    saveAdminCategory: vi.fn(),
    saveProductPromotion: vi.fn(),
    setAdminProductArchived: vi.fn(),
    updateAdminProduct: vi.fn(),
    updateContactEnquiry: vi.fn(),
    updateOrderRequest: vi.fn(),
    uploadAdminBrochure: vi.fn(),
    uploadBrochurePage: vi.fn(),
    uploadProductImage: vi.fn(),
  };
  const state = {
    customerAccounts,
    catalogueService,
    identity: null as any,
    roleRows: [] as any[],
    userRows: [] as any[],
    profileRows: [] as any[],
    // A queue is useful for operations whose SQL where-clause is deliberately opaque
    // to this in-memory adapter (for example, loading a specific system role).
    roleQueryQueue: [] as any[][],
    getDb: vi.fn(),
  };
  customerAccounts.getCustomerIdentityFromRequest.mockImplementation(async () => state.identity);
  return state;
});

vi.mock("./customerAccounts", () => fixtures.customerAccounts);
vi.mock("./catalogueService", () => fixtures.catalogueService);
vi.mock("./db", () => ({ getDb: fixtures.getDb }));

function userFixture(id = 41): User {
  return {
    id,
    openId: `joan-customer:${id}`,
    name: "Staff fixture",
    email: "staff@example.com",
    loginMethod: "joan-customer",
    role: "user",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    lastSignedIn: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function manusAdmin(): User {
  return {
    ...userFixture(1),
    openId: "manus-admin-fixture",
    name: "Legacy Manus administrator",
    email: "admin@example.com",
    loginMethod: "manus",
    role: "admin",
  };
}

function customerIdentity(options: {
  id?: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  accessRoleId?: number | null;
  staffUserId?: number | null;
} = {}) {
  return {
    id: options.id ?? 7,
    email: options.email ?? "staff@example.com",
    firstName: options.firstName ?? "Staff",
    lastName: options.lastName ?? "Fixture",
    accountStatus: "active" as const,
    accessRoleId: options.accessRoleId ?? 10,
    staffUserId: options.staffUserId ?? 41,
  };
}

function roleRow(id: number, slug: string, permissions: readonly string[], isSystem = false) {
  return {
    id,
    slug,
    name: slug,
    description: `${slug} fixture role`,
    permissionsJson: JSON.stringify(permissions),
    isSystem,
  };
}

function contextFor(user: User | null, headers: Record<string, string> = {}): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers } as TrpcContext["req"],
    res: { clearCookie: () => undefined, cookie: () => undefined } as TrpcContext["res"],
  };
}

function queryResult(rows: unknown[]) {
  const promise = Promise.resolve(rows);
  const query: any = {
    for: () => query,
    offset: () => query,
    then: promise.then.bind(promise),
  };
  return query;
}

function inMemoryDb() {
  const rowsFor = (table: unknown) => {
    if (table === accessRoles) {
      return fixtures.roleQueryQueue.length > 0 ? fixtures.roleQueryQueue.shift()! : fixtures.roleRows;
    }
    if (table === users) return fixtures.userRows;
    if (table === customerProfiles) return fixtures.profileRows;
    return [];
  };

  const select = () => {
    let table: unknown;
    const query: any = {
      from(nextTable: unknown) {
        table = nextTable;
        return query;
      },
      leftJoin() {
        return query;
      },
      where() {
        return query;
      },
      orderBy() {
        return queryResult(rowsFor(table));
      },
      groupBy() {
        return queryResult(rowsFor(table));
      },
      limit() {
        return queryResult(rowsFor(table));
      },
      offset() {
        return query;
      },
      then(onFulfilled: (value: unknown[]) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(rowsFor(table)).then(onFulfilled, onRejected);
      },
    };
    return query;
  };

  const tx = {
    select,
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    insert: () => ({ values: async () => [{ insertId: 901 }] }),
    delete: () => ({ where: async () => undefined }),
  };
  return {
    select,
    transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
  };
}

function configureCustomerRole(
  slug: string,
  permissions: readonly string[],
  options: { customerId?: number; roleId?: number; staffUserId?: number; email?: string } = {},
) {
  const roleId = options.roleId ?? 10;
  const staffUserId = options.staffUserId ?? 41;
  fixtures.identity = customerIdentity({
    id: options.customerId,
    email: options.email,
    accessRoleId: roleId,
    staffUserId,
  });
  fixtures.roleRows = [roleRow(roleId, slug, permissions)];
  fixtures.userRows = [userFixture(staffUserId)];
  fixtures.profileRows = [];
  fixtures.roleQueryQueue = [];
}

beforeEach(() => {
  fixtures.identity = null;
  fixtures.roleRows = [];
  fixtures.userRows = [];
  fixtures.profileRows = [];
  fixtures.roleQueryQueue = [];
  fixtures.customerAccounts.getCustomerIdentityFromRequest.mockImplementation(async () => fixtures.identity);
  fixtures.getDb.mockImplementation(async () => inMemoryDb());
  for (const mock of Object.values(fixtures.catalogueService)) mock.mockReset();
});

describe("shared permission semantics", () => {
  it("normalizes write/import grants to include their read capability", () => {
    expect(normalizePermissions(["orders.write"])).toEqual(["orders.read", "orders.write"]);
    expect(normalizePermissions(["customers.import"])).toEqual(["customers.read", "customers.import"]);
    expect(hasPermission(normalizePermissions(["roles.write"]), "roles.read")).toBe(true);
  });

  it("rejects unrecognized permissions instead of silently widening a role", () => {
    expect(() => normalizePermissions(["orders.write", "not-a-real-permission"])).toThrow("Непознато право");
    expect(parsePermissions(JSON.stringify(["not-a-real-permission"]))).toEqual([]);
    expect(parsePermissions("{malformed json")).toEqual([]);
    expect(parsePermissions(JSON.stringify(["orders.read", 42]))).toEqual([]);
  });

  it("does not fall back from unknown admin routes to the first permitted section", () => {
    expect(canVisitAdminSection(["products.read"], "/admin/unknown-section")).toBe(false);
    expect(canVisitAdminSection(["orders.read"], "/admin/products")).toBe(false);
    expect(firstAdminPath([])).toBeNull();
    expect(firstAdminPath(["orders.read"])).toBe("/admin/orders");
    expect(ADMIN_SECTION_PERMISSIONS["/admin/orders"]).toBe("orders.read");
  });
});

describe("staff access resolution", () => {
  it("returns no staff access for an unauthenticated request and denies admin data", async () => {
    const caller = appRouter.createCaller(contextFor(null));
    await expect(caller.staff.me()).resolves.toBeNull();
    await expect(caller.admin.orders()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not grant the newly registered ddeye32 customer any staff privilege from email alone", async () => {
    fixtures.identity = customerIdentity({ id: 88, email: "ddeye32@example.com", accessRoleId: null, staffUserId: null });
    fixtures.roleRows = [];
    fixtures.userRows = [];
    const caller = appRouter.createCaller(contextFor(null));
    await expect(caller.staff.me()).resolves.toMatchObject({
      email: "ddeye32@example.com",
      source: "customer",
      canAccess: false,
      permissions: [],
    });
    await expect(caller.admin.orders()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps the legacy Manus administrator compatibility bridge with all permissions", async () => {
    const caller = appRouter.createCaller(contextFor(manusAdmin()));
    fixtures.catalogueService.getAdminProducts.mockResolvedValueOnce({ products: ["legacy-admin-visible"] });
    const access = await caller.staff.me();
    expect(access).toMatchObject({ source: "manus", canAccess: true, permissions: ALL_PERMISSIONS });
    await expect(caller.admin.products()).resolves.toEqual({ products: ["legacy-admin-visible"] });
  });

  it("re-reads the role on every request so a revoked permission is stale-proof", async () => {
    configureCustomerRole("custom-orders", ["orders.read"]);
    const ctx = contextFor(null);
    const first = await getStaffAccess(ctx);
    expect(first?.permissions).toEqual(["orders.read"]);
    fixtures.roleRows[0].permissionsJson = JSON.stringify([]);
    const second = await getStaffAccess(ctx);
    expect(second?.permissions).toEqual([]);
    expect(second?.canAccess).toBe(false);
  });

  it("omits the internal user object from the public staff response", async () => {
    configureCustomerRole("custom-orders", ["orders.read"]);
    const access = await getStaffAccess(contextFor(null));
    expect(publicStaffAccess(access)).toMatchObject({ email: "staff@example.com", permissions: ["orders.read"] });
    expect(publicStaffAccess(access)).not.toHaveProperty("user");
  });
});

describe("mapped admin tRPC permission procedures", () => {
  it("denies both archive and restore to read-only product roles and operators", async () => {
    for (const permissions of [["products.read"], OPERATOR_PERMISSIONS]) {
      configureCustomerRole("limited-product-removal", permissions);
      const caller = appRouter.createCaller(contextFor(null));
      await expect(caller.admin.setProductArchived({ id: 501, archived: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.admin.setProductArchived({ id: 501, archived: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(fixtures.catalogueService.setAdminProductArchived).not.toHaveBeenCalled();
  });

  it("allows a product writer to archive with the server-resolved actor", async () => {
    configureCustomerRole("product-writer", ["products.read", "products.write"]);
    fixtures.catalogueService.setAdminProductArchived.mockResolvedValueOnce(undefined);
    await appRouter.createCaller(contextFor(null)).admin.setProductArchived({ id: 501, archived: true });
    expect(fixtures.catalogueService.setAdminProductArchived).toHaveBeenCalledWith(501, true, 41);
  });

  it("allows the operator to read and update orders and enquiries, but not products or roles", async () => {
    configureCustomerRole("operator", OPERATOR_PERMISSIONS);
    fixtures.catalogueService.getAdminOrders.mockResolvedValueOnce({ kind: "orders" });
    fixtures.catalogueService.getAdminContactEnquiries.mockResolvedValueOnce({ kind: "enquiries" });
    fixtures.catalogueService.updateOrderRequest.mockResolvedValueOnce({ kind: "order-updated" });
    fixtures.catalogueService.updateContactEnquiry.mockResolvedValueOnce({ kind: "enquiry-updated" });
    const caller = appRouter.createCaller(contextFor(null));

    await expect(caller.admin.orders()).resolves.toEqual({ kind: "orders" });
    await expect(caller.admin.contactEnquiries()).resolves.toEqual({ kind: "enquiries" });
    await expect(caller.admin.updateOrder({ id: 1, status: "contacted", adminNote: "called" })).resolves.toEqual({ kind: "order-updated" });
    await expect(caller.admin.updateContactEnquiry({ id: 2, status: "closed", adminNote: "answered" })).resolves.toEqual({ kind: "enquiry-updated" });
    await expect(caller.admin.products()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.access.roles()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows a custom read-only role to read orders but not perform an order write", async () => {
    configureCustomerRole("read-only-orders", ["orders.read"]);
    fixtures.catalogueService.getAdminOrders.mockResolvedValueOnce({ kind: "read-only-orders" });
    const caller = appRouter.createCaller(contextFor(null));

    await expect(caller.admin.orders()).resolves.toEqual({ kind: "read-only-orders" });
    await expect(caller.admin.updateOrder({ id: 1, status: "contacted", adminNote: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.products()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects an invalid permission at the access-router input boundary", async () => {
    const caller = appRouter.createCaller(contextFor(manusAdmin()));
    await expect(caller.access.saveRole({
      slug: "invalid-permission-role",
      name: "Invalid permission role",
      description: "",
      permissions: ["not-a-real-permission"] as any,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects a mutation from an unrelated origin before role persistence", async () => {
    const caller = appRouter.createCaller(contextFor(manusAdmin(), { origin: "https://evil.example", host: "joan.example" }));
    await expect(caller.access.saveRole({
      slug: "origin-check-role",
      name: "Origin check role",
      description: "",
      permissions: ["orders.read"],
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("accepts a same-site origin when a reverse proxy supplies the public host", () => {
    expect(isTrustedMutationOrigin({ headers: { origin: "https://preview.joan.example", host: "127.0.0.1:3000", "x-forwarded-host": "preview.joan.example" } })).toBe(true);
    expect(isTrustedMutationOrigin({ headers: { origin: "https://evil.example", host: "127.0.0.1:3000", "x-forwarded-host": "preview.joan.example" } })).toBe(false);
  });

  it("enforces least-privilege delegation when a role grants a permission the actor lacks", async () => {
    configureCustomerRole("role-manager", ["roles.read", "roles.write", "users.read"]);
    const caller = appRouter.createCaller(contextFor(null));
    await expect(caller.access.saveRole({
      slug: "overbroad-role",
      name: "Overbroad role",
      description: "",
      permissions: ["products.write"],
    })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const access = await getStaffAccess(contextFor(null));
    expect(() => assertDelegation(access!, ["products.read"])).toThrowError();
  });
});

describe("role-management safety invariants", () => {
  it("protects system roles from edits using only an in-memory transaction fixture", async () => {
    const actorRole = roleRow(2, "role-manager", ["roles.read", "roles.write", "users.read", "users.assign_roles"], false);
    const systemRole = roleRow(1, "operator", OPERATOR_PERMISSIONS, true);
    configureCustomerRole("role-manager", JSON.parse(actorRole.permissionsJson), { roleId: actorRole.id, customerId: 7, staffUserId: 41 });
    fixtures.roleRows = [actorRole];
    fixtures.roleQueryQueue = [[actorRole], [systemRole]];
    const actor = await getStaffAccess(contextFor(null));
    await expect(saveAccessRole(actor!, {
      id: systemRole.id,
      slug: "replacement-system-role",
      name: "Replacement system role",
      description: "",
      permissions: ["roles.write"],
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("prohibits an administrator from changing their own customer role", async () => {
    const actorRole = roleRow(2, "role-manager", ["roles.read", "roles.write", "users.read", "users.assign_roles"], false);
    const targetRole = roleRow(3, "other-role", ["roles.read"], false);
    configureCustomerRole("role-manager", JSON.parse(actorRole.permissionsJson), { roleId: actorRole.id, customerId: 7, staffUserId: 41 });
    fixtures.roleRows = [actorRole];
    fixtures.roleQueryQueue = [[actorRole], [targetRole]];
    fixtures.profileRows = [{ id: 7, accessRoleId: actorRole.id, accountStatus: "active", firstName: "Staff", lastName: "Fixture" }];
    const actor = await getStaffAccess(contextFor(null));
    await expect(assignAccessRole(actor!, 7, targetRole.id)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
