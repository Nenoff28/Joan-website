export const PERMISSION_GROUPS = [
  {
    name: "Обзор",
    permissions: [
      {
        key: "dashboard.read",
        label: "Преглед на статистики и финансов обзор",
      },
    ],
  },
  {
    name: "Артикули",
    permissions: [
      { key: "products.read", label: "Преглед на продукти" },
      {
        key: "products.write",
        label: "Добавяне, редакция и премахване на продукти и снимки",
      },
    ],
  },
  {
    name: "Наличности",
    permissions: [
      { key: "inventory.read", label: "Преглед на наличности" },
      { key: "inventory.write", label: "Промяна на наличности" },
    ],
  },
  {
    name: "Промоции",
    permissions: [
      { key: "promotions.read", label: "Преглед на промоции" },
      { key: "promotions.write", label: "Промяна на промоционални цени" },
    ],
  },
  {
    name: "Категории",
    permissions: [
      { key: "categories.read", label: "Преглед на категории" },
      { key: "categories.write", label: "Редакция на категории" },
    ],
  },
  {
    name: "Брошури",
    permissions: [
      { key: "brochures.read", label: "Преглед на брошури" },
      { key: "brochures.write", label: "Качване и управление на брошури" },
    ],
  },
  {
    name: "Поръчки",
    permissions: [
      { key: "orders.read", label: "Преглед на поръчки и данни за доставка" },
      { key: "orders.write", label: "Промяна на статус и бележки на поръчки" },
    ],
  },
  {
    name: "Запитвания",
    permissions: [
      { key: "enquiries.read", label: "Преглед на контактни запитвания" },
      { key: "enquiries.write", label: "Обработка на запитвания" },
    ],
  },
  {
    name: "Клиенти",
    permissions: [
      { key: "customers.read", label: "Преглед на клиентски импорт" },
      { key: "customers.import", label: "Импорт на клиентски профили" },
    ],
  },
  {
    name: "Исторически поръчки",
    permissions: [
      { key: "legacy_orders.read", label: "Преглед на исторически импорт" },
      { key: "legacy_orders.import", label: "Импорт на исторически поръчки" },
    ],
  },
  {
    name: "Журнал",
    permissions: [
      { key: "activity.read", label: "Преглед на административната активност" },
    ],
  },
  {
    name: "Потребители",
    permissions: [
      { key: "users.read", label: "Преглед на потребители" },
      { key: "users.assign_roles", label: "Назначаване и отнемане на роли" },
    ],
  },
  {
    name: "Роли",
    permissions: [
      { key: "roles.read", label: "Преглед на роли" },
      { key: "roles.write", label: "Създаване, редакция и изтриване на роли" },
    ],
  },
] as const;
export type Permission =
  (typeof PERMISSION_GROUPS)[number]["permissions"][number]["key"];
export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap(group =>
  group.permissions.map(item => item.key)
);
export const OPERATOR_PERMISSIONS: Permission[] = [
  "orders.read",
  "orders.write",
  "enquiries.read",
  "enquiries.write",
];
export function hasPermission(
  permissions: readonly string[],
  permission: Permission
): boolean {
  return permissions.includes(permission);
}
export function normalizePermissions(input: readonly string[]): Permission[] {
  if (input.some(key => !ALL_PERMISSIONS.includes(key as Permission)))
    throw new Error("Непознато право за достъп.");
  const selected = new Set<Permission>(input as Permission[]);
  for (const key of Array.from(selected)) {
    if (key.endsWith(".write") || key.endsWith(".import"))
      selected.add(`${key.split(".")[0]}.read` as Permission);
    if (key === "products.write") selected.add("categories.read");
    if (key === "users.assign_roles") {
      selected.add("users.read");
      selected.add("roles.read");
    }
  }
  return ALL_PERMISSIONS.filter(key => selected.has(key));
}
export const ADMIN_SECTION_PERMISSIONS: Record<string, Permission> = {
  "/admin": "dashboard.read",
  "/admin/ai-content": "dashboard.read",
  "/admin/products": "products.read",
  "/admin/inventory": "inventory.read",
  "/admin/promotions": "promotions.read",
  "/admin/brochures": "brochures.read",
  "/admin/categories": "categories.read",
  "/admin/orders": "orders.read",
  "/admin/enquiries": "enquiries.read",
  "/admin/customers": "customers.read",
  "/admin/legacy-orders": "legacy_orders.read",
  "/admin/activity": "activity.read",
  "/admin/users-roles": "users.read",
};
export function canVisitAdminSection(
  permissions: readonly string[],
  path: string
): boolean {
  if (path === "/admin/users-roles")
    return (
      permissions.includes("users.read") || permissions.includes("roles.read")
    );
  const key = ADMIN_SECTION_PERMISSIONS[path];
  return Boolean(key && hasPermission(permissions, key));
}
export function firstAdminPath(permissions: readonly string[]): string | null {
  return (
    Object.keys(ADMIN_SECTION_PERMISSIONS).find(path =>
      canVisitAdminSection(permissions, path)
    ) ?? null
  );
}
