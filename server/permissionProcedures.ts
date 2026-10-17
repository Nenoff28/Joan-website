import { TRPCError } from "@trpc/server";
import { publicProcedure } from "./_core/trpc";
import { assertPermission, getStaffAccess } from "./accessControl";
import type { Permission } from "../shared/permissions";

export function anyPermissionProcedure(permissions: readonly Permission[]) {
  return publicProcedure.use(async ({ ctx, next, type }) => {
    const staff = await getStaffAccess(ctx);
    const required =
      permissions.find(key => staff?.permissions.includes(key)) ??
      permissions[0];
    assertPermission(staff, required);
    if (type === "mutation" && ctx.req.headers.origin) {
      const origin =
        typeof ctx.req.headers.origin === "string"
          ? ctx.req.headers.origin
          : "";
      const host = ctx.req.headers.host;
      try {
        if (!host || new URL(origin).host !== host) throw new Error("origin");
      } catch {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Невалиден източник на административната заявка.",
        });
      }
    }
    return next({ ctx: { ...ctx, user: staff.user, staff } });
  });
}
export function permissionProcedure(permission: Permission) {
  return anyPermissionProcedure([permission]);
}
