import { TRPCError } from "@trpc/server";
import { publicProcedure } from "./_core/trpc";
import { assertPermission, getStaffAccess } from "./accessControl";
import type { Permission } from "../shared/permissions";

function headerValues(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value : value ? [value] : [])
    .flatMap(item => item.split(","))
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeHost(value: string) {
  return value.replace(/^https?:\/\//, "").replace(/:443$|:80$/, "").toLowerCase();
}

function forwardedHosts(value: string | string[] | undefined) {
  return headerValues(value).flatMap(item => {
    const hostPart = item.match(/(?:^|;)\s*host=([^;]+)/i)?.[1] ?? item;
    return [hostPart.replace(/^"|"$/g, "")];
  });
}

export function isTrustedMutationOrigin(req: { headers: Record<string, string | string[] | undefined> }) {
  const originHeader = req.headers.origin;
  if (!originHeader || Array.isArray(originHeader)) return true;
  try {
    const origin = new URL(originHeader);
    if (!/^https?:$/.test(origin.protocol)) return false;
    const trustedHosts = new Set([
      ...headerValues(req.headers.host).map(normalizeHost),
      ...forwardedHosts(req.headers["x-forwarded-host"]).map(normalizeHost),
      ...forwardedHosts(req.headers["x-original-host"]).map(normalizeHost),
      ...forwardedHosts(req.headers.forwarded).map(normalizeHost),
    ]);
    if (trustedHosts.has(normalizeHost(origin.host))) return true;
    const canonicalOrigin = process.env.CANONICAL_ORIGIN?.trim();
    if (!canonicalOrigin) return false;
    const canonical = new URL(canonicalOrigin);
    return canonical.protocol === origin.protocol && normalizeHost(canonical.host) === normalizeHost(origin.host);
  } catch {
    return false;
  }
}

export function anyPermissionProcedure(permissions: readonly Permission[]) {
  return publicProcedure.use(async ({ ctx, next, type }) => {
    const staff = await getStaffAccess(ctx);
    const required =
      permissions.find(key => staff?.permissions.includes(key)) ??
      permissions[0];
    assertPermission(staff, required);
    if (type === "mutation" && !isTrustedMutationOrigin(ctx.req)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Невалиден източник на административната заявка.",
      });
    }
    return next({ ctx: { ...ctx, user: staff.user, staff } });
  });
}
export function permissionProcedure(permission: Permission) {
  return anyPermissionProcedure([permission]);
}
