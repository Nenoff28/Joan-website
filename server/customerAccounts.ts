import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import * as XLSX from "xlsx";
import { customerActivationTokens, customerAddresses, customerCredentials, customerProfiles } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { getHistoricalOrdersForCustomer } from "./legacyOrders";

const CUSTOMER_SESSION_COOKIE = "__Host-joan_customer_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const ACTIVATION_TTL_MS = 1000 * 60 * 60 * 48;
const PASSWORD_MIN_LENGTH = 12;
const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
const PASSWORD_SCRYPT_COST = 16_384;
const PASSWORD_SCRYPT_BLOCK_SIZE = 8;
const PASSWORD_SCRYPT_PARALLELIZATION = 1;
const PASSWORD_SCRYPT_KEY_LENGTH = 64;

type WorkbookRow = Record<string, unknown>;
type CustomerStatus = "pending_activation" | "active" | "disabled";
type ActivationPurpose = "activation" | "password_reset";

export type LegacyCustomerImportPreview = {
  customerCount: number;
  addressCount: number;
  activeAndApprovedCount: number;
  disabledCount: number;
  customersWithEmailCount: number;
  duplicateEmailCount: number;
  missingRequiredFieldCount: number;
  headers: { customers: string[]; addresses: string[] };
};

type LegacyCustomer = {
  legacyCustomerId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  newsletterSubscribed: boolean;
  legacyWasApproved: boolean;
  legacyWasActive: boolean;
};

type LegacyAddress = {
  legacyCustomerId: number;
  firstName: string;
  lastName: string;
  company: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postcode: string | null;
  zone: string | null;
  country: string | null;
  isDefault: boolean;
};

function requiredDb() {
  return getDb().then((db) => {
    if (!db) throw new Error("Database connection is unavailable");
    return db;
  });
}

function normalizedText(value: unknown, maxLength = 512) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizedEmail(value: unknown) {
  return normalizedText(value, 320).toLocaleLowerCase("en-US");
}

function truthy(value: unknown) {
  const normalized = normalizedText(value, 16).toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "да";
}

function numberValue(value: unknown) {
  const parsed = Number(normalizedText(value, 32));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function xlsxRows(workbook: XLSX.WorkBook, sheetName: string): WorkbookRow[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Липсва задължителният лист „${sheetName}“ в Excel файла.`);
  return XLSX.utils.sheet_to_json<WorkbookRow>(sheet, { defval: "", raw: false });
}

function workbookHeaders(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  return (rows[0] ?? []).map((header) => normalizedText(header, 120));
}

function parseWorkbook(base64: string) {
  const encoded = base64.replace(/^data:[^;]+;base64,/, "");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMPORT_BYTES) throw new Error("Файлът с клиенти трябва да е между 1 байт и 8 MB.");
  const workbook = XLSX.read(bytes, { type: "buffer", cellFormula: false, cellHTML: false, cellText: true });
  const customerRows = xlsxRows(workbook, "Customers");
  const addressRows = xlsxRows(workbook, "Addresses");
  return { workbook, customerRows, addressRows };
}

function collectLegacyData(base64: string) {
  const { workbook, customerRows, addressRows } = parseWorkbook(base64);
  const customers: LegacyCustomer[] = [];
  const addresses: LegacyAddress[] = [];
  const emails = new Map<string, number>();
  let missingRequiredFieldCount = 0;
  let activeAndApprovedCount = 0;
  let disabledCount = 0;

  for (const row of customerRows) {
    const legacyCustomerId = numberValue(row.customer_id);
    const firstName = normalizedText(row.firstname, 160);
    const lastName = normalizedText(row.lastname, 160);
    const email = normalizedEmail(row.email);
    if (!legacyCustomerId || !firstName || !lastName || !email || !email.includes("@")) {
      missingRequiredFieldCount += 1;
      continue;
    }
    const legacyWasApproved = truthy(row.approved);
    const legacyWasActive = truthy(row.status);
    if (legacyWasApproved && legacyWasActive) activeAndApprovedCount += 1;
    else disabledCount += 1;
    emails.set(email, (emails.get(email) ?? 0) + 1);
    customers.push({ legacyCustomerId, firstName, lastName, email, phone: normalizedText(row.telephone, 64) || null, newsletterSubscribed: truthy(row.newsletter), legacyWasApproved, legacyWasActive });
  }

  for (const row of addressRows) {
    const legacyCustomerId = numberValue(row.customer_id);
    const firstName = normalizedText(row.firstname, 160);
    const lastName = normalizedText(row.lastname, 160);
    const addressLine1 = normalizedText(row.address_1, 512);
    const city = normalizedText(row.city, 160);
    if (!legacyCustomerId || !firstName || !lastName || !addressLine1 || !city) {
      missingRequiredFieldCount += 1;
      continue;
    }
    addresses.push({ legacyCustomerId, firstName, lastName, company: normalizedText(row.company, 255) || null, addressLine1, addressLine2: normalizedText(row.address_2, 512) || null, city, postcode: normalizedText(row.postcode, 32) || null, zone: normalizedText(row.zone, 160) || null, country: normalizedText(row.country, 160) || null, isDefault: truthy(row.default) });
  }

  const duplicateEmailCount = Array.from(emails.values()).filter((count) => count > 1).length;
  const preview: LegacyCustomerImportPreview = {
    customerCount: customers.length,
    addressCount: addresses.length,
    activeAndApprovedCount,
    disabledCount,
    customersWithEmailCount: customers.length,
    duplicateEmailCount,
    missingRequiredFieldCount,
    headers: { customers: workbookHeaders(workbook, "Customers"), addresses: workbookHeaders(workbook, "Addresses") },
  };
  return { customers, addresses, preview };
}

export function previewLegacyCustomerWorkbook(base64: string) {
  return collectLegacyData(base64).preview;
}

export function hashCustomerPassword(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) throw new Error(`Паролата трябва да е поне ${PASSWORD_MIN_LENGTH} символа.`);
  const salt = randomBytes(16).toString("base64url");
  const derived = scryptSync(password, salt, PASSWORD_SCRYPT_KEY_LENGTH, { N: PASSWORD_SCRYPT_COST, r: PASSWORD_SCRYPT_BLOCK_SIZE, p: PASSWORD_SCRYPT_PARALLELIZATION, maxmem: 64 * 1024 * 1024 }).toString("base64url");
  return `scrypt-v1$${PASSWORD_SCRYPT_COST}$${PASSWORD_SCRYPT_BLOCK_SIZE}$${PASSWORD_SCRYPT_PARALLELIZATION}$${salt}$${derived}`;
}

export function verifyCustomerPassword(password: string, storedHash: string) {
  const [version, cost, blockSize, parallelization, salt, expected] = storedHash.split("$");
  if (version !== "scrypt-v1" || !cost || !blockSize || !parallelization || !salt || !expected) return false;
  try {
    const derived = scryptSync(password, salt, PASSWORD_SCRYPT_KEY_LENGTH, { N: Number(cost), r: Number(blockSize), p: Number(parallelization), maxmem: 64 * 1024 * 1024 }).toString("base64url");
    const expectedBytes = Buffer.from(expected);
    const actualBytes = Buffer.from(derived);
    return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
  } catch {
    return false;
  }
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function sessionSecret() {
  if (!ENV.cookieSecret) throw new Error("Customer session signing is unavailable.");
  return createHash("sha256").update(`joan-customer-session:${ENV.cookieSecret}`).digest();
}

function readCookie(cookieHeader: string | undefined, key: string) {
  return cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${key}=`))?.slice(key.length + 1);
}

async function signCustomerSession(customerId: number, sessionVersion: number) {
  return new SignJWT({ scope: "customer", sessionVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(customerId))
    .setIssuer("joan-bg")
    .setAudience("joan-customer")
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(sessionSecret());
}

function sessionCookieOptions() {
  return { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: SESSION_TTL_SECONDS * 1000 };
}

export async function setCustomerSession(response: { cookie: (name: string, value: string, options: Record<string, unknown>) => void }, customerId: number, sessionVersion: number) {
  response.cookie(CUSTOMER_SESSION_COOKIE, await signCustomerSession(customerId, sessionVersion), sessionCookieOptions());
}

export function clearCustomerSession(response: { clearCookie: (name: string, options: Record<string, unknown>) => void }) {
  response.clearCookie(CUSTOMER_SESSION_COOKIE, { ...sessionCookieOptions(), maxAge: -1 });
}

export async function getCustomerFromRequest(cookieHeader: string | undefined) {
  const encoded = readCookie(cookieHeader, CUSTOMER_SESSION_COOKIE);
  if (!encoded) return null;
  try {
    const { payload } = await jwtVerify(encoded, sessionSecret(), { algorithms: ["HS256"], issuer: "joan-bg", audience: "joan-customer" });
    if (payload.scope !== "customer" || !payload.sub || typeof payload.sessionVersion !== "number") return null;
    const db = await requiredDb();
    const customerId = Number(payload.sub);
    if (!Number.isInteger(customerId) || customerId < 1) return null;
    const [row] = await db.select({ profile: customerProfiles, credential: customerCredentials }).from(customerProfiles).innerJoin(customerCredentials, eq(customerCredentials.customerId, customerProfiles.id)).where(eq(customerProfiles.id, customerId)).limit(1);
    if (!row || row.profile.accountStatus !== "active" || row.credential.sessionVersion !== payload.sessionVersion) return null;
    const addresses = await db.select().from(customerAddresses).where(eq(customerAddresses.customerId, customerId));
    const historicalOrders = await getHistoricalOrdersForCustomer(customerId);
    return { id: row.profile.id, firstName: row.profile.firstName, lastName: row.profile.lastName, email: row.profile.email, phone: row.profile.phone, addresses: addresses.map((address) => ({ id: address.id, firstName: address.firstName, lastName: address.lastName, company: address.company, addressLine1: address.addressLine1, addressLine2: address.addressLine2, city: address.city, postcode: address.postcode, zone: address.zone, country: address.country, isDefault: address.isDefault })), historicalOrders };
  } catch {
    return null;
  }
}

export async function importLegacyCustomers(base64: string, adminUserId: number) {
  const { customers, addresses, preview } = collectLegacyData(base64);
  if (!customers.length) throw new Error("Файлът не съдържа валидни клиентски профили за импорт.");
  if (preview.duplicateEmailCount > 0 || preview.missingRequiredFieldCount > 0) throw new Error("Файлът има дублирани имейли или непълни задължителни данни. Коригирайте го преди импорт.");
  const db = await requiredDb();
  let importedProfiles = 0;
  let importedAddresses = 0;

  await db.transaction(async (tx) => {
    const customerIdByLegacyId = new Map<number, number>();
    for (const customer of customers) {
      const [existing] = await tx.select().from(customerProfiles).where(eq(customerProfiles.legacyCustomerId, customer.legacyCustomerId)).limit(1);
      const targetStatus: CustomerStatus = customer.legacyWasApproved && customer.legacyWasActive ? "pending_activation" : "disabled";
      let customerId: number;
      if (existing) {
        if (existing.email !== customer.email) throw new Error("Открита е несъвместимост между legacy customer ID и имейл адрес. Импортът е прекратен.");
        await tx.update(customerProfiles).set({ firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone, newsletterSubscribed: customer.newsletterSubscribed, legacyWasApproved: customer.legacyWasApproved, legacyWasActive: customer.legacyWasActive, accountStatus: existing.accountStatus === "active" ? "active" : targetStatus }).where(eq(customerProfiles.id, existing.id));
        customerId = existing.id;
      } else {
        const [sameEmail] = await tx.select().from(customerProfiles).where(eq(customerProfiles.email, customer.email)).limit(1);
        if (sameEmail) throw new Error("Имейл адресът на legacy клиент вече е свързан с различен профил. Импортът е прекратен.");
        const result = await tx.insert(customerProfiles).values({ ...customer, accountStatus: targetStatus });
        customerId = Number(result[0].insertId);
        await tx.insert(customerCredentials).values({ customerId, passwordHash: null, passwordSetAt: null, sessionVersion: 1, failedLoginCount: 0, lockedUntil: null });
        importedProfiles += 1;
      }
      customerIdByLegacyId.set(customer.legacyCustomerId, customerId);
    }

    for (const [legacyCustomerId, customerId] of Array.from(customerIdByLegacyId.entries())) {
      await tx.delete(customerAddresses).where(eq(customerAddresses.customerId, customerId));
      const matching = addresses.filter((address) => address.legacyCustomerId === legacyCustomerId);
      for (let position = 0; position < matching.length; position += 1) {
        const address = matching[position];
        await tx.insert(customerAddresses).values({ customerId, legacyPosition: position, firstName: address.firstName, lastName: address.lastName, company: address.company, addressLine1: address.addressLine1, addressLine2: address.addressLine2, city: address.city, postcode: address.postcode, zone: address.zone, country: address.country, isDefault: address.isDefault });
        importedAddresses += 1;
      }
    }
  });

  return { importedProfiles, importedAddresses, pendingActivation: preview.activeAndApprovedCount, disabledProfiles: preview.disabledCount, importedByAdminUserId: adminUserId };
}

export async function createActivationToken(emailInput: string, purpose: ActivationPurpose) {
  const email = normalizedEmail(emailInput);
  const db = await requiredDb();
  const [profile] = await db.select().from(customerProfiles).where(eq(customerProfiles.email, email)).limit(1);
  if (!profile || profile.accountStatus === "disabled") return null;
  if (purpose === "activation" && profile.accountStatus === "active") return null;
  await db.update(customerActivationTokens).set({ usedAt: new Date() }).where(and(eq(customerActivationTokens.customerId, profile.id), eq(customerActivationTokens.purpose, purpose), isNull(customerActivationTokens.usedAt)));
  const rawToken = randomBytes(32).toString("base64url");
  await db.insert(customerActivationTokens).values({ customerId: profile.id, purpose, tokenHash: tokenHash(rawToken), expiresAt: new Date(Date.now() + ACTIVATION_TTL_MS), usedAt: null });
  return { token: rawToken, profile: { id: profile.id, firstName: profile.firstName, email: profile.email }, purpose, expiresAt: new Date(Date.now() + ACTIVATION_TTL_MS) };
}

export async function activateCustomerAccount(token: string, password: string, response: { cookie: (name: string, value: string, options: Record<string, unknown>) => void }) {
  const db = await requiredDb();
  const [activation] = await db.select().from(customerActivationTokens).where(and(eq(customerActivationTokens.tokenHash, tokenHash(token)), isNull(customerActivationTokens.usedAt), gt(customerActivationTokens.expiresAt, new Date()))).limit(1);
  if (!activation) throw new Error("Линкът за активиране е невалиден или е изтекъл.");
  const passwordHash = hashCustomerPassword(password);
  await db.transaction(async (tx) => {
    await tx.update(customerActivationTokens).set({ usedAt: new Date() }).where(eq(customerActivationTokens.id, activation.id));
    await tx.update(customerProfiles).set({ accountStatus: "active", activatedAt: new Date(), lastSignedInAt: new Date() }).where(eq(customerProfiles.id, activation.customerId));
    const [credential] = await tx.select().from(customerCredentials).where(eq(customerCredentials.customerId, activation.customerId)).limit(1);
    if (!credential) throw new Error("Липсва защитен запис за клиентския профил.");
    const sessionVersion = credential.sessionVersion + 1;
    await tx.update(customerCredentials).set({ passwordHash, passwordSetAt: new Date(), failedLoginCount: 0, lockedUntil: null, sessionVersion }).where(eq(customerCredentials.id, credential.id));
    await setCustomerSession(response, activation.customerId, sessionVersion);
  });
  return { success: true };
}

export async function loginCustomer(emailInput: string, password: string, response: { cookie: (name: string, value: string, options: Record<string, unknown>) => void }) {
  const db = await requiredDb();
  const email = normalizedEmail(emailInput);
  const [row] = await db.select({ profile: customerProfiles, credential: customerCredentials }).from(customerProfiles).innerJoin(customerCredentials, eq(customerCredentials.customerId, customerProfiles.id)).where(eq(customerProfiles.email, email)).limit(1);
  if (!row || row.profile.accountStatus !== "active" || !row.credential.passwordHash) throw new Error("Невалиден имейл или парола.");
  if (row.credential.lockedUntil && row.credential.lockedUntil > new Date()) throw new Error("Входът е временно заключен. Опитайте отново по-късно.");
  if (!verifyCustomerPassword(password, row.credential.passwordHash)) {
    const failedLoginCount = row.credential.failedLoginCount + 1;
    const lockedUntil = failedLoginCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await db.update(customerCredentials).set({ failedLoginCount: failedLoginCount >= 5 ? 0 : failedLoginCount, lockedUntil }).where(eq(customerCredentials.id, row.credential.id));
    throw new Error("Невалиден имейл или парола.");
  }
  await db.update(customerCredentials).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(customerCredentials.id, row.credential.id));
  await db.update(customerProfiles).set({ lastSignedInAt: new Date() }).where(eq(customerProfiles.id, row.profile.id));
  await setCustomerSession(response, row.profile.id, row.credential.sessionVersion);
  return { success: true };
}
