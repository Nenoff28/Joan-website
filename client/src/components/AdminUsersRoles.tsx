import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  PERMISSION_GROUPS,
  hasPermission,
  type Permission,
} from "@shared/permissions";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Edit3,
  KeyRound,
  Loader2,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import "./adminUsersRoles.css";

type UserRecord = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  accountStatus: "pending_activation" | "active" | "disabled";
  roleId: number | null;
  roleSlug: string;
  roleName: string;
};

type RoleRecord = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
};

type RoleDraft = {
  id?: number;
  slug: string;
  name: string;
  description: string;
  permissions: Permission[];
};

type PendingGrant = {
  customerId: number;
  roleId: number;
  userName: string;
};

const accountStatusLabels: Record<UserRecord["accountStatus"], string> = {
  pending_activation: "Чака активиране",
  active: "Активен",
  disabled: "Деактивиран",
};

const accountStatusClasses: Record<UserRecord["accountStatus"], string> = {
  pending_activation: "aur-status aur-status-pending",
  active: "aur-status aur-status-active",
  disabled: "aur-status aur-status-disabled",
};

function displayUserName(user: UserRecord) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
  );
}

function isValidRoleSlug(slug: string) {
  return /^[a-z][a-z0-9-]*$/.test(slug.trim());
}

const permissionKeys = new Set<Permission>(
  PERMISSION_GROUPS.flatMap(group => group.permissions.map(item => item.key))
);

function isPermission(value: string): value is Permission {
  return permissionKeys.has(value as Permission);
}

function LoadingMessage({ text = "Зареждане на данните…" }: { text?: string }) {
  return (
    <div className="aur-feedback aur-feedback-loading" role="status">
      <Loader2 size={17} className="animate-spin" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

function ErrorMessage({ text }: { text: string }) {
  return (
    <div className="aur-feedback aur-feedback-error" role="alert">
      <AlertTriangle size={17} aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

function PermissionEditor({
  permissions,
  disabled,
  onChange,
}: {
  permissions: Permission[];
  disabled: boolean;
  onChange: (permission: Permission, checked: boolean) => void;
}) {
  return (
    <div className="aur-permission-groups">
      {PERMISSION_GROUPS.map(group => (
        <fieldset className="aur-permission-group" key={group.name}>
          <legend>{group.name}</legend>
          <div className="aur-permission-list">
            {group.permissions.map(permission => {
              const checked = permissions.includes(permission.key);
              return (
                <label className="aur-permission-item" key={permission.key}>
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={value =>
                      onChange(permission.key, value === true)
                    }
                  />
                  <span>{permission.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function UserAccessTable({
  users,
  roles,
  draftRoles,
  canAssign,
  canResetPassword,
  isSaving,
  onRoleDraftChange,
  onSaveRole,
  onResetPassword,
  resettingUserId,
}: {
  users: UserRecord[];
  roles: RoleRecord[];
  draftRoles: Partial<Record<number, number>>;
  canAssign: boolean;
  canResetPassword: boolean;
  isSaving: boolean;
  onRoleDraftChange: (customerId: number, value: string) => void;
  onSaveRole: (user: UserRecord) => void;
  onResetPassword: (user: UserRecord) => void;
  resettingUserId: number | null;
}) {
  return (
    <Table className="aur-users-table">
      <TableHeader>
        <TableRow>
          <TableHead>Профил</TableHead>
          <TableHead>Контакти</TableHead>
          <TableHead>Състояние</TableHead>
          <TableHead>Роля</TableHead>
          <TableHead className="aur-table-action-head">Действие</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map(user => {
          const currentRoleId =
            user.roleId ?? roles.find(role => role.slug === "customer")?.id;
          const selectedRole = draftRoles[user.id] ?? currentRoleId ?? "";
          const unchanged =
            typeof selectedRole === "number" && selectedRole === currentRoleId;
          return (
            <TableRow key={user.id}>
              <TableCell>
                <div className="aur-profile-cell">
                  <span className="aur-profile-avatar" aria-hidden="true">
                    {displayUserName(user)
                      .slice(0, 1)
                      .toLocaleUpperCase("bg-BG")}
                  </span>
                  <span>
                    <strong>{displayUserName(user)}</strong>
                    <small>Клиент #{user.id}</small>
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="aur-contact-cell">
                  <span>{user.email}</span>
                  <small>{user.phone || "Телефонът не е посочен"}</small>
                </div>
              </TableCell>
              <TableCell>
                <Badge className={accountStatusClasses[user.accountStatus]}>
                  {accountStatusLabels[user.accountStatus]}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="aur-role-assignment">
                  <select
                    aria-label={`Роля за ${displayUserName(user)}`}
                    value={String(selectedRole)}
                    disabled={!canAssign || isSaving}
                    onChange={event =>
                      onRoleDraftChange(user.id, event.target.value)
                    }
                  >
                    {selectedRole === "" && (
                      <option value="" disabled>
                        Няма назначена роля
                      </option>
                    )}
                    {roles.map(role => (
                      <option
                        key={role.id}
                        value={role.id}
                        disabled={
                          user.accountStatus !== "active" &&
                          role.slug !== "customer"
                        }
                      >
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <small>{user.roleSlug || "без роля"}</small>
                </div>
              </TableCell>
              <TableCell className="aur-table-action-cell">
                <div className="aur-user-actions">
                  {canAssign && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        isSaving || unchanged || typeof selectedRole !== "number"
                      }
                      onClick={() => onSaveRole(user)}
                    >
                      {isSaving ? (
                        <Loader2
                          size={14}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Save size={14} aria-hidden="true" />
                      )}
                      Запази
                    </Button>
                  )}
                  {canResetPassword && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={resettingUserId === user.id}
                      onClick={() => onResetPassword(user)}
                    >
                      {resettingUserId === user.id ? (
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <KeyRound size={14} aria-hidden="true" />
                      )}
                      Нова парола
                    </Button>
                  )}
                  {!canAssign && !canResetPassword && (
                    <span className="aur-read-only-label">Само преглед</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function AdminUsersRoles() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [draftRoles, setDraftRoles] = useState<Partial<Record<number, number>>>(
    {}
  );
  const [pendingGrant, setPendingGrant] = useState<PendingGrant | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number | "new" | null>(
    null
  );
  const [roleDraft, setRoleDraft] = useState<RoleDraft | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<RoleRecord | null>(null);
  const [passwordUser, setPasswordUser] = useState<UserRecord | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const staffQuery = trpc.staff.me.useQuery();
  const staff = staffQuery.data;
  const permissions = staff?.permissions ?? [];
  const canAccess = Boolean(staff?.canAccess);
  const canListUsers = canAccess && hasPermission(permissions, "users.read");
  const canAssignRoles =
    canAccess && hasPermission(permissions, "users.assign_roles");
  const canManagePasswords =
    canAccess && hasPermission(permissions, "users.manage_passwords");
  const canListRoles = canAccess && hasPermission(permissions, "roles.read");
  const canWriteRoles = canAccess && hasPermission(permissions, "roles.write");

  const usersInput = useMemo(
    () => ({ search: search.trim(), page }),
    [page, search]
  );
  const usersQuery = trpc.access.users.useQuery(usersInput, {
    enabled: canListUsers,
  });
  const rolesQuery = trpc.access.roles.useQuery(undefined, {
    enabled: canListRoles,
  });

  const users = usersQuery.data?.items ?? [];
  const roles = rolesQuery.data ?? [];
  const pageSize = usersQuery.data?.pageSize ?? 20;
  const totalUsers = usersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const currentPage = Math.min(page, totalPages);
  const selectedRole =
    selectedRoleId !== null && selectedRoleId !== "new"
      ? roles.find(role => role.id === selectedRoleId)
      : undefined;

  async function invalidateAccess() {
    await Promise.all([
      utils.access.users.invalidate(),
      utils.access.roles.invalidate(),
      utils.staff.me.invalidate(),
    ]);
  }

  const assignRole = trpc.access.assignRole.useMutation();
  const resetPassword = trpc.access.resetPassword.useMutation();
  const saveRole = trpc.access.saveRole.useMutation();
  const deleteRole = trpc.access.deleteRole.useMutation();

  function changePage(nextPage: number) {
    setPage(Math.max(1, Math.min(totalPages, nextPage)));
  }

  function setUserRoleDraft(customerId: number, value: string) {
    const roleId = Number(value);
    if (!Number.isInteger(roleId) || roleId < 1) return;
    setAssignmentError(null);
    setDraftRoles(current => ({ ...current, [customerId]: roleId }));
  }

  function commitAssignment(pending: PendingGrant) {
    setAssignmentError(null);
    assignRole.mutate(
      { customerId: pending.customerId, roleId: pending.roleId },
      {
        onSuccess: async () => {
          setDraftRoles(current => {
            const next = { ...current };
            delete next[pending.customerId];
            return next;
          });
          await invalidateAccess();
          toast.success("Ролята е променена.");
        },
        onError: error => {
          setAssignmentError(error.message);
          toast.error(error.message || "Ролята не можа да бъде променена.");
        },
      }
    );
  }

  function requestAssignment(user: UserRecord) {
    const roleId = draftRoles[user.id];
    if (!roleId || roleId === user.roleId) return;
    const role = roles.find(item => item.id === roleId);
    if (!role) return;
    const userName = `${displayUserName(user)} (${user.email})`;
    if (
      role.slug.toLocaleLowerCase("en-US") === "admin" &&
      user.roleSlug.toLocaleLowerCase("en-US") !== "admin"
    ) {
      setPendingGrant({ customerId: user.id, roleId, userName });
      return;
    }
    commitAssignment({ customerId: user.id, roleId, userName });
  }

  function openPasswordEditor(user: UserRecord) {
    setPasswordError(null);
    setNewPassword("");
    setPasswordConfirmation("");
    setPasswordUser(user);
  }

  function closePasswordEditor() {
    if (resetPassword.isPending) return;
    setPasswordUser(null);
    setPasswordError(null);
    setNewPassword("");
    setPasswordConfirmation("");
  }

  function saveNewPassword() {
    if (!passwordUser || !canManagePasswords) return;
    if (newPassword.length < 12) {
      setPasswordError("Новата парола трябва да е поне 12 символа.");
      return;
    }
    if (newPassword !== passwordConfirmation) {
      setPasswordError("Двете въведени пароли не съвпадат.");
      return;
    }
    setPasswordError(null);
    resetPassword.mutate(
      { customerId: passwordUser.id, newPassword },
      {
        onSuccess: () => {
          toast.success("Новата парола е зададена. Старите сесии са прекратени.");
          closePasswordEditor();
        },
        onError: error => {
          setPasswordError(error.message);
          toast.error(error.message || "Паролата не можа да бъде променена.");
        },
      }
    );
  }

  function startNewRole() {
    setRoleError(null);
    setSelectedRoleId("new");
    setRoleDraft({
      slug: "",
      name: "",
      description: "",
      permissions: [],
    });
  }

  function editRole(role: RoleRecord) {
    if (role.isSystem || !canWriteRoles) return;
    setRoleError(null);
    setSelectedRoleId(role.id);
    setRoleDraft({
      id: role.id,
      slug: role.slug,
      name: role.name,
      description: role.description ?? "",
      permissions: role.permissions.filter(isPermission),
    });
  }

  function changePermission(permission: Permission, checked: boolean) {
    setRoleDraft(current => {
      if (!current) return current;
      const next = new Set(current.permissions);
      if (checked) next.add(permission);
      else next.delete(permission);
      return { ...current, permissions: Array.from(next) };
    });
  }

  function saveRoleDraft() {
    if (!roleDraft || !canWriteRoles) return;
    const slug = roleDraft.slug.trim();
    const name = roleDraft.name.trim();
    if (!name || !isValidRoleSlug(slug)) {
      setRoleError(
        "Въведете име и slug с малки латински букви, цифри и тирета."
      );
      return;
    }
    setRoleError(null);
    saveRole.mutate(
      {
        ...(roleDraft.id ? { id: roleDraft.id } : {}),
        slug,
        name,
        description: roleDraft.description.trim(),
        permissions: roleDraft.permissions,
      },
      {
        onSuccess: async result => {
          setRoleDraft(current =>
            current ? { ...current, id: result.id } : current
          );
          setSelectedRoleId(result.id);
          await invalidateAccess();
          toast.success("Ролята е запазена.");
        },
        onError: error => {
          setRoleError(error.message);
          toast.error(error.message || "Ролята не можа да бъде запазена.");
        },
      }
    );
  }

  function confirmDeleteRole() {
    if (!roleToDelete || roleToDelete.isSystem || !canWriteRoles) return;
    const role = roleToDelete;
    deleteRole.mutate(
      { id: role.id },
      {
        onSuccess: async () => {
          setRoleToDelete(null);
          if (selectedRoleId === role.id) {
            setSelectedRoleId(null);
            setRoleDraft(null);
          }
          await invalidateAccess();
          toast.success("Ролята е изтрита.");
        },
        onError: error => {
          setRoleError(error.message);
          toast.error(error.message || "Ролята не може да бъде изтрита.");
        },
      }
    );
  }

  return (
    <section className="aur-shell" aria-labelledby="aur-title">
      <header className="aur-heading">
        <div>
          <p className="aur-eyebrow">ЖОАН · ДОСТЪП</p>
          <h1 id="aur-title">Потребители и роли</h1>
          <p>
            Управлявайте клиентските профили и достъпа на екипа от едно място, с
            индивидуални права според отговорностите им.
          </p>
        </div>
        <div className="aur-heading-mark" aria-hidden="true">
          <ShieldCheck size={23} />
          <span>Контролиран достъп</span>
        </div>
      </header>

      <div className="aur-system-note" role="note">
        <ShieldCheck size={17} aria-hidden="true" />
        <span>
          <strong>Ролите се проверяват на сървъра.</strong> Промяната важи от
          следващата заявка. Текущите пароли не се показват; при нужда задайте
          нова парола.
        </span>
      </div>

      {staffQuery.isLoading && <LoadingMessage text="Проверка на достъпа…" />}
      {staffQuery.error && (
        <ErrorMessage text="Достъпът не можа да бъде проверен. Обновете страницата и опитайте отново." />
      )}
      {!staffQuery.isLoading &&
        !staffQuery.error &&
        staff &&
        !staff.canAccess && (
          <ErrorMessage text="Нямате достъп до управлението на потребители и роли." />
        )}
      {!staffQuery.isLoading && !staffQuery.error && !staff && (
        <ErrorMessage text="Няма активен служебен профил за тази секция." />
      )}

      {!staffQuery.isLoading && !staffQuery.error && staff?.canAccess && (
        <div className="aur-sections">
          <Card className="aur-card aur-users-card">
            <CardHeader className="aur-card-header">
              <div>
                <p className="aur-card-kicker">КЛИЕНТСКИ ПРОФИЛИ</p>
                <CardTitle>Потребители</CardTitle>
                <CardDescription>
                  Име, контакти, статус и текуща роля. Чакащите профили трябва
                  първо да се активират, за да получат служебен достъп.
                </CardDescription>
              </div>
              <Badge className="aur-count-badge">
                <UsersRound size={13} aria-hidden="true" />
                {totalUsers} профила
              </Badge>
            </CardHeader>
            <CardContent className="aur-card-content">
              {!canListUsers ? (
                <div className="aur-capability-message">
                  Нямате право за преглед на потребителите.
                </div>
              ) : (
                <>
                  <div className="aur-toolbar">
                    <label className="aur-search-field">
                      <Search size={17} aria-hidden="true" />
                      <span className="sr-only">Търсене по име или email</span>
                      <Input
                        value={search}
                        placeholder="Търсене по име или email"
                        onChange={event => {
                          setSearch(event.target.value);
                          setPage(1);
                        }}
                      />
                    </label>
                    <span className="aur-toolbar-hint">
                      Страница {currentPage} от {totalPages}
                    </span>
                  </div>
                  {usersQuery.isLoading && <LoadingMessage />}
                  {usersQuery.error && (
                    <ErrorMessage text="Списъкът с потребители не можа да бъде зареден." />
                  )}
                  {!usersQuery.isLoading &&
                    !usersQuery.error &&
                    users.length === 0 && (
                      <div className="aur-empty-state">
                        <Search size={22} aria-hidden="true" />
                        <strong>Няма намерени профили</strong>
                        <span>
                          Променете търсенето или проверете следващата страница.
                        </span>
                      </div>
                    )}
                  {!usersQuery.isLoading &&
                    !usersQuery.error &&
                    users.length > 0 && (
                      <UserAccessTable
                        users={users}
                        roles={roles}
                        draftRoles={draftRoles}
                        canAssign={canAssignRoles}
                        canResetPassword={canManagePasswords}
                        isSaving={assignRole.isPending}
                        onRoleDraftChange={setUserRoleDraft}
                        onSaveRole={requestAssignment}
                        onResetPassword={openPasswordEditor}
                        resettingUserId={resetPassword.isPending ? passwordUser?.id ?? null : null}
                      />
                    )}
                  {assignmentError && <ErrorMessage text={assignmentError} />}
                  <div
                    className="aur-pagination"
                    aria-label="Пагинация на потребители"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1 || usersQuery.isFetching}
                      onClick={() => changePage(currentPage - 1)}
                    >
                      <ChevronLeft size={15} aria-hidden="true" />
                      Предишна
                    </Button>
                    <span>
                      {totalUsers === 0
                        ? "Няма резултати"
                        : `${(currentPage - 1) * pageSize + 1}–${Math.min(
                            currentPage * pageSize,
                            totalUsers
                          )} от ${totalUsers}`}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        currentPage >= totalPages || usersQuery.isFetching
                      }
                      onClick={() => changePage(currentPage + 1)}
                    >
                      Следваща
                      <ChevronRight size={15} aria-hidden="true" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="aur-card aur-roles-card">
            <CardHeader className="aur-card-header">
              <div>
                <p className="aur-card-kicker">МОДЕЛ НА ДОСТЪПА</p>
                <CardTitle>Роли</CardTitle>
                <CardDescription>
                  Системните роли са само за четене. Персонализираните роли се
                  редактират и запазват изрично.
                </CardDescription>
              </div>
              {canWriteRoles && (
                <Button type="button" size="sm" onClick={startNewRole}>
                  <Plus size={15} aria-hidden="true" />
                  Нова роля
                </Button>
              )}
            </CardHeader>
            <CardContent className="aur-card-content">
              {!canListRoles ? (
                <div className="aur-capability-message">
                  Нямате право за преглед на ролите.
                </div>
              ) : (
                <>
                  {rolesQuery.isLoading && <LoadingMessage />}
                  {rolesQuery.error && (
                    <ErrorMessage text="Ролите не можаха да бъдат заредени." />
                  )}
                  {!rolesQuery.isLoading && !rolesQuery.error && (
                    <div className="aur-role-workspace">
                      <div className="aur-role-list" aria-label="Списък с роли">
                        {roles.length === 0 ? (
                          <div className="aur-empty-state aur-empty-role-state">
                            <ShieldCheck size={22} aria-hidden="true" />
                            <strong>Няма налични роли</strong>
                            <span>
                              Добавете персонализирана роля, ако имате права.
                            </span>
                          </div>
                        ) : (
                          roles.map(role => (
                            <article
                              className={`aur-role-item ${
                                selectedRoleId === role.id ? "is-selected" : ""
                              }`}
                              key={role.id}
                            >
                              <button
                                type="button"
                                className="aur-role-select"
                                onClick={() => {
                                  if (role.isSystem) {
                                    setSelectedRoleId(role.id);
                                    setRoleDraft(null);
                                  } else if (canWriteRoles) {
                                    editRole(role);
                                  } else {
                                    setSelectedRoleId(role.id);
                                    setRoleDraft(null);
                                  }
                                }}
                                aria-label={`${role.name} — ${role.userCount} потребители`}
                              >
                                <span
                                  className="aur-role-icon"
                                  aria-hidden="true"
                                >
                                  {role.isSystem ? (
                                    <ShieldCheck size={17} />
                                  ) : (
                                    <UsersRound size={17} />
                                  )}
                                </span>
                                <span className="aur-role-copy">
                                  <strong>{role.name}</strong>
                                  <small>{role.slug}</small>
                                </span>
                                <span className="aur-role-users">
                                  <b>{role.userCount}</b>
                                  <small>потребители</small>
                                </span>
                              </button>
                              <div className="aur-role-meta">
                                <Badge
                                  className={
                                    role.isSystem
                                      ? "aur-system-badge"
                                      : "aur-custom-badge"
                                  }
                                >
                                  {role.isSystem
                                    ? "Системна · само за четене"
                                    : "Персонализирана"}
                                </Badge>
                                {canWriteRoles && !role.isSystem && (
                                  <div className="aur-role-actions">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={`Редактиране на ${role.name}`}
                                      onClick={() => editRole(role)}
                                    >
                                      <Edit3 size={15} aria-hidden="true" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      className="aur-delete-button"
                                      aria-label={`Изтриване на ${role.name}`}
                                      onClick={() => {
                                        setRoleError(null);
                                        setRoleToDelete(role);
                                      }}
                                    >
                                      <Trash2 size={15} aria-hidden="true" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </article>
                          ))
                        )}
                      </div>

                      {selectedRole && !roleDraft && (
                        <div className="aur-role-editor">
                          <div className="aur-editor-heading">
                            <div>
                              <h3>{selectedRole.name}</h3>
                              <p>{selectedRole.description}</p>
                            </div>
                            <Badge>Само преглед</Badge>
                          </div>
                          <div className="aur-role-form">
                            <p className="aur-form-help">
                              Правата за тази роля са посочени по-долу. За
                              различни права създайте персонализирана роля.
                            </p>
                            <PermissionEditor
                              permissions={selectedRole.permissions.filter(
                                isPermission
                              )}
                              disabled={true}
                              onChange={() => undefined}
                            />
                          </div>
                        </div>
                      )}
                      {canWriteRoles && roleDraft && (
                        <div className="aur-role-editor">
                          <div className="aur-editor-heading">
                            <div>
                              <p className="aur-card-kicker">
                                {selectedRoleId === "new"
                                  ? "НОВА РОЛЯ"
                                  : "РЕДАКЦИЯ"}
                              </p>
                              <h3>
                                {selectedRoleId === "new"
                                  ? "Персонализирана роля"
                                  : selectedRole?.name ||
                                    "Персонализирана роля"}
                              </h3>
                            </div>
                            <Badge className="aur-custom-badge">
                              Редактируема
                            </Badge>
                          </div>
                          <div className="aur-role-form">
                            <label>
                              Име на ролята
                              <Input
                                value={roleDraft.name}
                                onChange={event =>
                                  setRoleDraft(current =>
                                    current
                                      ? { ...current, name: event.target.value }
                                      : current
                                  )
                                }
                              />
                            </label>
                            <label>
                              Slug
                              <Input
                                value={roleDraft.slug}
                                pattern="[a-z][a-z0-9-]*"
                                onChange={event =>
                                  setRoleDraft(current =>
                                    current
                                      ? {
                                          ...current,
                                          slug: event.target.value.toLowerCase(),
                                        }
                                      : current
                                  )
                                }
                              />
                              <small>
                                Малки латински букви, цифри и тирета.
                              </small>
                            </label>
                            <label>
                              Описание
                              <Textarea
                                value={roleDraft.description}
                                rows={3}
                                onChange={event =>
                                  setRoleDraft(current =>
                                    current
                                      ? {
                                          ...current,
                                          description: event.target.value,
                                        }
                                      : current
                                  )
                                }
                              />
                            </label>
                            <div>
                              <p className="aur-form-label">Права</p>
                              <p className="aur-form-help">
                                Изберете само необходимите възможности. Записът
                                се нормализира и проверява от сървъра.
                              </p>
                              <PermissionEditor
                                permissions={roleDraft.permissions}
                                disabled={saveRole.isPending}
                                onChange={changePermission}
                              />
                            </div>
                            {roleError && <ErrorMessage text={roleError} />}
                          </div>
                          <CardFooter className="aur-editor-footer">
                            <Button
                              type="button"
                              disabled={saveRole.isPending}
                              onClick={saveRoleDraft}
                            >
                              {saveRole.isPending ? (
                                <Loader2
                                  size={15}
                                  className="animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Save size={15} aria-hidden="true" />
                              )}
                              Запази ролята
                            </Button>
                          </CardFooter>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <AlertDialog
        open={passwordUser !== null}
        onOpenChange={open => {
          if (!open) closePasswordEditor();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Задаване на нова парола</AlertDialogTitle>
            <AlertDialogDescription>
              Текущата парола не може да бъде видяна, защото се пази само като
              защитен hash. Задайте нова парола за {passwordUser ? displayUserName(passwordUser) : "потребителя"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="aur-password-form">
            <label>
              Нова парола
              <Input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                placeholder="Минимум 12 символа"
                onChange={event => setNewPassword(event.target.value)}
              />
            </label>
            <label>
              Повторете новата парола
              <Input
                type="password"
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={event => setPasswordConfirmation(event.target.value)}
              />
            </label>
            {passwordError && <ErrorMessage text={passwordError} />}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetPassword.isPending}>Отказ</AlertDialogCancel>
            <AlertDialogAction disabled={resetPassword.isPending} onClick={saveNewPassword}>
              {resetPassword.isPending ? "Записване…" : "Задай новата парола"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingGrant !== null}
        onOpenChange={open => {
          if (!open && !assignRole.isPending) setPendingGrant(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Потвърдете администраторския достъп
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ще дадете ролята „Администратор“ на{" "}
              {pendingGrant?.userName ?? "този потребител"}. Това може да
              предостави пълен достъп до управлението на магазина. Потвърждавате
              ли промяната?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отказ</AlertDialogCancel>
            <AlertDialogAction
              disabled={assignRole.isPending}
              onClick={() => {
                if (!pendingGrant) return;
                const grant = pendingGrant;
                setPendingGrant(null);
                commitAssignment(grant);
              }}
            >
              Потвърди достъпа
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={roleToDelete !== null}
        onOpenChange={open => {
          if (!open && !deleteRole.isPending) setRoleToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Изтриване на персонализирана роля
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ролята „{roleToDelete?.name ?? ""}" ще бъде изтрита. Ако има
              назначени потребители, сървърът може да отхвърли операцията.
              Искате ли да продължите?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отказ</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteRole.isPending}
              onClick={confirmDeleteRole}
            >
              {deleteRole.isPending ? "Изтриване…" : "Изтрий ролята"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
