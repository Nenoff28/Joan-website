/**
 * Bootstrap the first JOAN administrator without Manus OAuth.
 *
 * The admin panel only lets an existing administrator assign staff roles, so the very first
 * administrator cannot be created from the UI. This script performs the same steps as
 * `assignCustomerRole` (server/accessControl.ts) for one e-mail address:
 *   1. find or create the customer profile (+ empty credentials row),
 *   2. give it the system "admin" access role and link a `users` row (`joan-customer:<id>`),
 *   3. print a single-use link (48 h) where the owner sets their own password.
 * The password is never passed to or printed by this script.
 *
 * Usage (DATABASE_URL from .env):
 *   node node_modules/tsx/dist/cli.mjs scripts/bootstrap-admin.mts --email owner@example.com --first-name Име --last-name Фамилия [--origin https://joan.bg]
 * Test accounts only: add --password-env VAR to set the password from an environment variable instead of a link.
 */
import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { accessRoles, adminActivities, customerCredentials, customerProfiles, users } from "../drizzle/schema";
import { getDb } from "../server/db";
import { createActivationToken, hashCustomerPassword } from "../server/customerAccounts";

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1]?.trim() : undefined;
}

const email = arg("email")?.toLowerCase();
const firstName = arg("first-name") || "Администратор";
const lastName = arg("last-name") || "Жоан";
const origin = (arg("origin") || process.env.CANONICAL_ORIGIN || "http://localhost:3000").replace(/\/+$/, "");
const passwordEnv = arg("password-env");

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: --email <address> [--first-name X --last-name Y --origin URL]");
  process.exit(1);
}
const password = passwordEnv ? process.env[passwordEnv] : undefined;
if (passwordEnv && (!password || password.length < 12)) {
  console.error(`Environment variable ${passwordEnv} must hold a password of at least 12 characters.`);
  process.exit(1);
}

const db = await getDb();
if (!db) throw new Error("DATABASE_URL is not configured.");

const result = await db.transaction(async (tx) => {
  const [adminRole] = await tx.select().from(accessRoles).where(eq(accessRoles.slug, "admin")).limit(1);
  if (!adminRole) throw new Error('System role "admin" is missing (access_roles).');

  let [profile] = await tx.select().from(customerProfiles).where(eq(customerProfiles.email, email)).limit(1);
  if (!profile) {
    const inserted = await tx.insert(customerProfiles).values({ email, firstName, lastName, accountStatus: "pending_activation" });
    [profile] = await tx.select().from(customerProfiles).where(eq(customerProfiles.id, Number(inserted[0].insertId))).limit(1);
  }
  if (profile.accountStatus === "disabled") throw new Error("This profile is disabled; re-enable it deliberately before granting admin rights.");

  const [credential] = await tx.select().from(customerCredentials).where(eq(customerCredentials.customerId, profile.id)).limit(1);
  if (!credential) await tx.insert(customerCredentials).values({ customerId: profile.id });

  let staffUserId = profile.staffUserId;
  if (!staffUserId) {
    const inserted = await tx.insert(users).values({ openId: `joan-customer:${profile.id}`, name: `${profile.firstName} ${profile.lastName}`.trim(), email: profile.email, loginMethod: "joan-customer", role: "user" });
    staffUserId = Number(inserted[0].insertId);
  }
  await tx.update(customerProfiles).set({ accessRoleId: adminRole.id, staffUserId }).where(eq(customerProfiles.id, profile.id));

  if (password) {
    await tx.update(customerProfiles).set({ accountStatus: "active", activatedAt: new Date(), emailVerifiedAt: new Date() }).where(eq(customerProfiles.id, profile.id));
    await tx.update(customerCredentials).set({ passwordHash: hashCustomerPassword(password), passwordSetAt: new Date(), failedLoginCount: 0, lockedUntil: null }).where(and(eq(customerCredentials.customerId, profile.id)));
  }

  await tx.insert(adminActivities).values({ adminUserId: staffUserId, action: "customer.role_bootstrapped", entityType: "customer_profile", entityId: profile.id, metadataJson: JSON.stringify({ roleId: adminRole.id, roleName: adminRole.name, previousRoleId: profile.accessRoleId, via: "scripts/bootstrap-admin.mts" }) });
  return { profileId: profile.id, wasActive: profile.accountStatus === "active" };
});

if (password) {
  console.log(`Administrator ready: profile #${result.profileId} (${email}). Log in at ${origin}/account, then open ${origin}/admin.`);
} else {
  const token = await createActivationToken(email, result.wasActive ? "password_reset" : "activation");
  if (!token) throw new Error("Could not create an activation link.");
  console.log(`Administrator role granted to profile #${result.profileId} (${email}).`);
  console.log(`Open this single-use link within 48 hours to set your password:\n${origin}/account/activate?token=${token.token}`);
  console.log(`Then open ${origin}/admin.`);
}
process.exit(0);
