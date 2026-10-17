import { asc, count, eq, like, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  accessRoles,
  adminActivities,
  customerProfiles,
  users,
  type User,
} from "../drizzle/schema";
import {
  ALL_PERMISSIONS,
  normalizePermissions,
  type Permission,
} from "../shared/permissions";
import type { TrpcContext } from "./_core/context";
import { getCustomerIdentityFromRequest } from "./customerAccounts";
import { getDb } from "./db";

export type StaffAccess = {
  user: User | null;
  id: number | null;
  name: string;
  email: string;
  customerId: number | null;
  role: { id: number | null; slug: string; name: string; isSystem: boolean };
  permissions: Permission[];
  canAccess: boolean;
  source: "customer" | "manus";
};
export function parsePermissions(json: string): Permission[] {
  try {
    const input: unknown = JSON.parse(json);
    if (!Array.isArray(input) || input.some(key => typeof key !== "string"))
      return [];
    return normalizePermissions(input);
  } catch {
    return [];
  }
}
async function database() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Базата данни временно не е достъпна.",
    });
  return db;
}
export async function getStaffAccess(
  ctx: TrpcContext
): Promise<StaffAccess | null> {
  // Compatibility bridge only for already-approved Manus administrators. Ordinary Manus users never gain rights.
  if (ctx.user?.role === "admin")
    return {
      user: ctx.user,
      id: ctx.user.id,
      name: ctx.user.name ?? "Администратор",
      email: ctx.user.email ?? "",
      customerId: null,
      role: { id: null, slug: "admin", name: "Администратор", isSystem: true },
      permissions: [...ALL_PERMISSIONS],
      canAccess: true,
      source: "manus",
    };
  const identity = await getCustomerIdentityFromRequest(ctx.req.headers.cookie);
  if (!identity) return null;
  const db = await database();
  const [role] = identity.accessRoleId
    ? await db
        .select()
        .from(accessRoles)
        .where(eq(accessRoles.id, identity.accessRoleId))
        .limit(1)
    : [];
  const permissions = role ? parsePermissions(role.permissionsJson) : [];
  const [actor] = identity.staffUserId
    ? await db
        .select()
        .from(users)
        .where(eq(users.id, identity.staffUserId))
        .limit(1)
    : [];
  return {
    user: actor ?? null,
    id: actor?.id ?? null,
    customerId: identity.id,
    name: `${identity.firstName} ${identity.lastName}`.trim(),
    email: identity.email,
    role: role
      ? {
          id: role.id,
          slug: role.slug,
          name: role.name,
          isSystem: role.isSystem,
        }
      : { id: null, slug: "customer", name: "Клиент", isSystem: true },
    permissions,
    canAccess: permissions.length > 0 && Boolean(actor),
    source: "customer",
  };
}
export function publicStaffAccess(access: StaffAccess | null) {
  if (!access) return null;
  const { user: _user, ...safe } = access;
  return safe;
}
export function assertPermission(
  access: StaffAccess | null,
  permission: Permission
): asserts access is StaffAccess & { user: User; id: number } {
  if (
    !access?.canAccess ||
    !access.user ||
    !access.id ||
    !access.permissions.includes(permission)
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Нямате права за това действие.",
    });
}
export function assertDelegation(
  actor: StaffAccess,
  permissions: readonly Permission[]
) {
  if (permissions.some(key => !actor.permissions.includes(key)))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Не можете да давате права, които самите вие нямате.",
    });
}

export async function listAccessUsers(search: string, page: number) {
  const db = await database();
  const query = search.trim().slice(0, 160);
  const condition = query
    ? or(
        like(customerProfiles.email, `%${query}%`),
        like(customerProfiles.firstName, `%${query}%`),
        like(customerProfiles.lastName, `%${query}%`)
      )
    : undefined;
  const pageSize = 25;
  const [totals, rows] = await Promise.all([
    db.select({ total: count() }).from(customerProfiles).where(condition),
    db
      .select({
        id: customerProfiles.id,
        email: customerProfiles.email,
        firstName: customerProfiles.firstName,
        lastName: customerProfiles.lastName,
        phone: customerProfiles.phone,
        accountStatus: customerProfiles.accountStatus,
        roleId: customerProfiles.accessRoleId,
        roleSlug: accessRoles.slug,
        roleName: accessRoles.name,
      })
      .from(customerProfiles)
      .leftJoin(accessRoles, eq(customerProfiles.accessRoleId, accessRoles.id))
      .where(condition)
      .orderBy(asc(customerProfiles.email))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);
  return {
    items: rows.map(row => ({
      ...row,
      roleSlug: row.roleSlug ?? "customer",
      roleName: row.roleName ?? "Клиент",
    })),
    total: Number(totals[0]?.total ?? 0),
    page,
    pageSize,
  };
}
export async function listAccessRoles() {
  const db = await database();
  const [roles, totals] = await Promise.all([
    db.select().from(accessRoles).orderBy(asc(accessRoles.id)),
    db
      .select({ roleId: customerProfiles.accessRoleId, total: count() })
      .from(customerProfiles)
      .groupBy(customerProfiles.accessRoleId),
  ]);
  return roles.map(role => ({
    id: role.id,
    slug: role.slug,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: parsePermissions(role.permissionsJson),
    userCount:
      Number(totals.find(row => row.roleId === role.id)?.total ?? 0) +
      (role.slug === "customer"
        ? Number(totals.find(row => row.roleId === null)?.total ?? 0)
        : 0),
  }));
}
export async function saveAccessRole(
  actor: StaffAccess,
  input: {
    id?: number;
    slug: string;
    name: string;
    description: string;
    permissions: Permission[];
  }
) {
  assertPermission(actor, "roles.write");
  const permissions = normalizePermissions(input.permissions);
  assertDelegation(actor, permissions);
  if (["customer", "operator", "admin"].includes(input.slug))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Системните роли са защитени. Създайте персонализирана роля.",
    });
  const db = await database();
  return db.transaction(async tx => {
    const [existing] = input.id
      ? await tx
          .select()
          .from(accessRoles)
          .where(eq(accessRoles.id, input.id))
          .limit(1)
          .for("update")
      : [];
    if (input.id && !existing)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Ролята не е намерена.",
      });
    if (existing?.isSystem)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Системните роли не могат да се редактират.",
      });
    if (existing)
      assertDelegation(actor, parsePermissions(existing.permissionsJson));
    if (
      existing?.id === actor.role.id &&
      (!permissions.includes("users.assign_roles") ||
        !permissions.includes("roles.write"))
    )
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Не можете да отнемете собствения си достъп до управление на роли.",
      });
    const [sameSlug] = await tx
      .select({ id: accessRoles.id })
      .from(accessRoles)
      .where(eq(accessRoles.slug, input.slug))
      .limit(1);
    if (sameSlug && sameSlug.id !== input.id)
      throw new TRPCError({
        code: "CONFLICT",
        message: "Вече има роля с този идентификатор.",
      });
    const values = {
      slug: input.slug,
      name: input.name,
      description: input.description || null,
      permissionsJson: JSON.stringify(permissions),
    };
    let id = input.id;
    if (id)
      await tx.update(accessRoles).set(values).where(eq(accessRoles.id, id));
    else {
      const result = await tx
        .insert(accessRoles)
        .values({ ...values, isSystem: false });
      id = Number(result[0].insertId);
    }
    await tx
      .insert(adminActivities)
      .values({
        adminUserId: actor.id,
        action: existing ? "role.updated" : "role.created",
        entityType: "access_role",
        entityId: id,
        metadataJson: JSON.stringify({
          name: input.name,
          slug: input.slug,
          permissions,
          previousPermissions: existing
            ? parsePermissions(existing.permissionsJson)
            : [],
          actorCustomerId: actor.customerId,
        }),
      });
    return { id: id! };
  });
}
export async function deleteAccessRole(actor: StaffAccess, id: number) {
  assertPermission(actor, "roles.write");
  const db = await database();
  return db.transaction(async tx => {
    const [role] = await tx
      .select()
      .from(accessRoles)
      .where(eq(accessRoles.id, id))
      .limit(1)
      .for("update");
    if (!role)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Ролята не е намерена.",
      });
    if (role.isSystem)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Системните роли не могат да се изтриват.",
      });
    assertDelegation(actor, parsePermissions(role.permissionsJson));
    const [assigned] = await tx
      .select({ id: customerProfiles.id })
      .from(customerProfiles)
      .where(eq(customerProfiles.accessRoleId, id))
      .limit(1);
    if (assigned)
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "Ролята се използва. Първо променете ролите на назначените потребители.",
      });
    await tx.delete(accessRoles).where(eq(accessRoles.id, id));
    await tx
      .insert(adminActivities)
      .values({
        adminUserId: actor.id,
        action: "role.deleted",
        entityType: "access_role",
        entityId: id,
        metadataJson: JSON.stringify({
          name: role.name,
          slug: role.slug,
          actorCustomerId: actor.customerId,
        }),
      });
    return { success: true };
  });
}
export async function assignAccessRole(
  actor: StaffAccess,
  customerId: number,
  roleId: number
) {
  assertPermission(actor, "users.assign_roles");
  const db = await database();
  return db.transaction(async tx => {
    const [role] = await tx
      .select()
      .from(accessRoles)
      .where(eq(accessRoles.id, roleId))
      .limit(1)
      .for("update");
    if (!role)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Ролята не е намерена.",
      });
    assertDelegation(actor, parsePermissions(role.permissionsJson));
    const [profile] = await tx
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.id, customerId))
      .limit(1)
      .for("update");
    if (!profile)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Профилът не е намерен.",
      });
    if (profile.id === actor.customerId)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Не можете да променяте собствената си роля. Използвайте друг администратор.",
      });
    if (profile.accessRoleId) {
      const [previous] = await tx
        .select()
        .from(accessRoles)
        .where(eq(accessRoles.id, profile.accessRoleId))
        .limit(1);
      if (previous)
        assertDelegation(actor, parsePermissions(previous.permissionsJson));
    }
    if (role.slug !== "customer" && profile.accountStatus !== "active")
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Профилът трябва първо да бъде активиран, преди да получи служебна роля.",
      });
    let staffUserId = profile.staffUserId;
    if (!staffUserId && role.slug !== "customer") {
      const result = await tx
        .insert(users)
        .values({
          openId: `joan-customer:${profile.id}`,
          name: `${profile.firstName} ${profile.lastName}`.trim(),
          email: profile.email,
          loginMethod: "joan-customer",
          role: "user",
        });
      staffUserId = Number(result[0].insertId);
    }
    await tx
      .update(customerProfiles)
      .set({ accessRoleId: roleId, staffUserId })
      .where(eq(customerProfiles.id, customerId));
    // Rights are resolved from the DB on every request; revoking a role does not trust stale JWT claims.
    await tx
      .insert(adminActivities)
      .values({
        adminUserId: actor.id,
        action: "customer.role_assigned",
        entityType: "customer_profile",
        entityId: customerId,
        metadataJson: JSON.stringify({
          roleId,
          roleName: role.name,
          previousRoleId: profile.accessRoleId,
          name: `${profile.firstName} ${profile.lastName}`,
          actorCustomerId: actor.customerId,
        }),
      });
    return { success: true };
  });
}
