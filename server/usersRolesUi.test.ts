import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  resolve(process.cwd(), "client/src/components/AdminUsersRoles.tsx"),
  "utf8"
);
const styles = readFileSync(
  resolve(process.cwd(), "client/src/components/adminUsersRoles.css"),
  "utf8"
);

describe("users and roles administration UI contract", () => {
  it("uses the access and staff tRPC contracts with authorization query gates", () => {
    expect(component).toContain("trpc.staff.me.useQuery()");
    expect(component).toContain("trpc.access.users.useQuery(usersInput");
    expect(component).toContain("trpc.access.roles.useQuery(undefined");
    expect(component).toContain("enabled: canListUsers");
    expect(component).toContain("enabled: canListRoles");
    expect(component).toContain("trpc.access.assignRole.useMutation()");
    expect(component).toContain("trpc.access.saveRole.useMutation()");
    expect(component).toContain("trpc.access.deleteRole.useMutation()");
  });

  it("keeps role changes explicit and invalidates access data after mutations", () => {
    expect(component).toContain("onRoleDraftChange");
    expect(component).toContain("onSaveRole");
    expect(component).toContain("utils.access.users.invalidate()");
    expect(component).toContain("utils.access.roles.invalidate()");
    expect(component).toContain("utils.staff.me.invalidate()");
    expect(component).toContain("assignRole.mutate(");
    expect(component).toContain("saveRole.mutate(");
    expect(component).toContain("deleteRole.mutate(");
    expect(component).not.toContain("window.confirm");
    expect(component).not.toContain("confirm(");
  });

  it("uses AlertDialog for exact administrator grants and custom-role deletion", () => {
    expect(component).toContain(
      'role.slug.toLocaleLowerCase("en-US") === "admin"'
    );
    expect(component).toContain("Потвърдете администраторския достъп");
    expect(component).toContain("AlertDialogAction");
    expect(component).toContain("Изтриване на персонализирана роля");
    expect(component).toContain("сървърът може да отхвърли операцията");
  });

  it("does not expose credential values or invent fallback profile data", () => {
    expect(component).not.toMatch(/passwordHash|passwordSalt|clientSecret|sessionVersion/);
    expect(component).not.toMatch(/password|парол/i);
    expect(component).not.toContain("dummy");
    expect(component).not.toContain("mockUsers");
    expect(component).not.toContain("fallback");
    expect(component).toContain("accountStatusLabels");
    expect(component).toContain("roleName");
    expect(component).toContain("user.phone ||");
  });

  it("keeps system roles read-only, reports role user counts, and renders grouped permissions", () => {
    expect(component).toContain("role.isSystem ?");
    expect(component).toContain("!role.isSystem &&");
    expect(component).toContain("role.userCount");
    expect(component).toContain("PERMISSION_GROUPS.map");
    expect(component).toContain('hasPermission(permissions, "users.read")');
    expect(component).toContain('hasPermission(permissions, "roles.write")');
  });

  it("keeps the Bulgarian light card layout responsive and locally scoped", () => {
    expect(component).toContain('import "./adminUsersRoles.css"');
    expect(component).toContain("Потребители и роли");
    expect(component).toContain("КЛИЕНТСКИ ПРОФИЛИ");
    expect(component).toContain("Пагинация на потребители");
    expect(styles).toContain(".aur-sections");
    expect(styles).toContain(".aur-role-workspace");
    expect(styles).toContain("@media (max-width: 700px)");
    expect(styles).toContain(".aur-users-table");
  });
});
