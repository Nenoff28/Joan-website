import { z } from "zod";
import { ALL_PERMISSIONS, type Permission } from "../shared/permissions";
import { publicProcedure, router } from "./_core/trpc";
import {
  assignAccessRole,
  deleteAccessRole,
  getStaffAccess,
  listAccessRoles,
  listAccessUsers,
  publicStaffAccess,
  saveAccessRole,
} from "./accessControl";
import { permissionProcedure } from "./permissionProcedures";

const permissionSchema = z.custom<Permission>(
  value =>
    typeof value === "string" && ALL_PERMISSIONS.includes(value as Permission),
  "Непознато право за достъп."
);
export const staffRouter = router({
  me: publicProcedure.query(async ({ ctx }) =>
    publicStaffAccess(await getStaffAccess(ctx))
  ),
});
export const accessRouter = router({
  users: permissionProcedure("users.read")
    .input(
      z.object({
        search: z.string().trim().max(160).default(""),
        page: z.number().int().min(1).max(100000).default(1),
      })
    )
    .query(({ input }) => listAccessUsers(input.search, input.page)),
  roles: permissionProcedure("roles.read").query(() => listAccessRoles()),
  saveRole: permissionProcedure("roles.write")
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        slug: z
          .string()
          .trim()
          .min(2)
          .max(80)
          .regex(
            /^[a-z][a-z0-9-]*$/,
            "Идентификаторът трябва да е на латиница."
          ),
        name: z.string().trim().min(2).max(160),
        description: z.string().trim().max(1500).default(""),
        permissions: z.array(permissionSchema).max(ALL_PERMISSIONS.length),
      })
    )
    .mutation(({ input, ctx }) => saveAccessRole(ctx.staff, input)),
  deleteRole: permissionProcedure("roles.write")
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input, ctx }) => deleteAccessRole(ctx.staff, input.id)),
  assignRole: permissionProcedure("users.assign_roles")
    .input(
      z.object({
        customerId: z.number().int().positive(),
        roleId: z.number().int().positive(),
      })
    )
    .mutation(({ input, ctx }) =>
      assignAccessRole(ctx.staff, input.customerId, input.roleId)
    ),
});
