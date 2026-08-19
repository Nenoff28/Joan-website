import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextFor(role: "admin" | "user" | null): TrpcContext {
  return {
    user: role ? {
      id: 1,
      openId: `test-${role}`,
      email: "operator@example.com",
      name: "Test operator",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("administrator route access", () => {
  it("rejects an unauthenticated request before any admin data can be queried", async () => {
    const caller = appRouter.createCaller(contextFor(null));
    await expect(caller.admin.summary()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects an authenticated customer account from administrator management", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.admin.products()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
