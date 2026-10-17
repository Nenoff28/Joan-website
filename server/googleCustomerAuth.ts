import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT, createRemoteJWKSet } from "jose";
import { customerCredentials, customerGoogleIdentities, customerProfiles } from "../drizzle/schema";
import {
  getCustomerSessionSigningKey,
  normalizeCustomerEmail,
  setCustomerSession,
} from "./customerAccounts";
import { getDb } from "./db";

export const GOOGLE_CUSTOMER_CALLBACK_PATH = "/api/customer/google/callback";
export const DEFAULT_GOOGLE_REDIRECT_URI = "https://joanredesign-gcqdscde.manus.space/api/customer/google/callback";
export const GOOGLE_CUSTOMER_SCOPES = ["openid", "email", "profile"] as const;
export const GOOGLE_STATE_COOKIE = "__Host-joan_customer_google_state";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"] as const;
const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_STATE_TTL_SECONDS = 10 * 60;
const GOOGLE_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: GOOGLE_STATE_TTL_SECONDS * 1000,
};
const GOOGLE_STATE_CLEAR_OPTIONS = { ...GOOGLE_STATE_COOKIE_OPTIONS, maxAge: -1 };
const GOOGLE_JWKS = createRemoteJWKSet(new URL(GOOGLE_JWKS_URI));

export type GoogleCustomerAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  configured: boolean;
};

export type GoogleCustomerStatus = {
  configured: boolean;
  provider: "google";
  redirectUri: string;
  scopes: readonly ["openid", "email", "profile"];
};

type GoogleStateClaims = {
  state: string;
  nonce: string;
  codeVerifier: string;
};

type GoogleIdTokenClaims = {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  given_name?: unknown;
  family_name?: unknown;
  nonce?: unknown;
};

export class GoogleCustomerAuthError extends Error {
  constructor(public readonly kind: "not_configured" | "invalid_request" | "provider_error" | "conflict" | "disabled") {
    super(kind);
    this.name = "GoogleCustomerAuthError";
  }
}

function readCookie(cookieHeader: string | undefined, name: string) {
  for (const part of cookieHeader?.split(";") ?? []) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${name}=`)) continue;
    return decodeURIComponent(trimmed.slice(name.length + 1));
  }
  return null;
}

function safeEqual(left: string, right: string) {
  // Hashing first keeps the compared buffers the same length while preserving a
  // constant-time comparison for state and nonce values.
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function isSafeGoogleRedirectUri(value: string) {
  try {
    const parsed = new URL(value);
    const localDevelopment = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !(localDevelopment && parsed.protocol === "http:")) return false;
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return false;
    return parsed.pathname === GOOGLE_CUSTOMER_CALLBACK_PATH;
  } catch {
    return false;
  }
}

export function getGoogleCustomerAuthConfig(): GoogleCustomerAuthConfig {
  const clientId = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
  const configuredRedirect = (process.env.GOOGLE_REDIRECT_URI ?? "").trim();
  const redirectUri = configuredRedirect || DEFAULT_GOOGLE_REDIRECT_URI;
  return {
    clientId,
    clientSecret,
    redirectUri,
    configured: Boolean(clientId && clientSecret && isSafeGoogleRedirectUri(redirectUri)),
  };
}

export function getGoogleCustomerAuthStatus(): GoogleCustomerStatus {
  const config = getGoogleCustomerAuthConfig();
  return {
    configured: config.configured,
    provider: "google",
    redirectUri: config.redirectUri,
    scopes: GOOGLE_CUSTOMER_SCOPES,
  };
}

function stateCookieValue(claims: GoogleStateClaims) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("joan-bg-google-customer")
    .setAudience("joan-customer-google-flow")
    .setExpirationTime(`${GOOGLE_STATE_TTL_SECONDS}s`)
    .sign(getCustomerSessionSigningKey());
}

async function verifyStateCookie(encoded: string) {
  const { payload } = await jwtVerify(encoded, getCustomerSessionSigningKey(), {
    algorithms: ["HS256"],
    issuer: "joan-bg-google-customer",
    audience: "joan-customer-google-flow",
  });
  if (typeof payload.state !== "string" || typeof payload.nonce !== "string" || typeof payload.codeVerifier !== "string") throw new GoogleCustomerAuthError("invalid_request");
  return payload as unknown as GoogleStateClaims;
}

function randomValue(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

const consumedStates = new Map<string, number>();
function consumeState(state: string) {
  const now = Date.now();
  for (const [key, timestamp] of Array.from(consumedStates.entries())) if (now - timestamp > GOOGLE_STATE_TTL_SECONDS * 1000) consumedStates.delete(key);
  if (consumedStates.has(state)) return false;
  // Bound the process-local replay guard. The signed HttpOnly cookie remains
  // the primary browser binding; this also closes same-process concurrent replay.
  if (consumedStates.size >= 4096) consumedStates.delete(consumedStates.keys().next().value as string);
  consumedStates.set(state, now);
  return true;
}

function safeRedirect(response: Response, result: "error" | "conflict" = "error") {
  const query = result === "conflict" ? "?google=conflict" : "?google=error";
  return response.redirect(303, `/account${query}`);
}

function errorRedirect(response: Response, error: unknown) {
  if (error instanceof GoogleCustomerAuthError && error.kind === "conflict") return safeRedirect(response, "conflict");
  return safeRedirect(response, "error");
}

function requireConfigured(config: GoogleCustomerAuthConfig) {
  if (!config.configured) throw new GoogleCustomerAuthError("not_configured");
}

export async function startGoogleCustomerAuth(response: Response) {
  const config = getGoogleCustomerAuthConfig();
  requireConfigured(config);
  const state = randomValue();
  const nonce = randomValue();
  const codeVerifier = randomValue(48);
  response.cookie(
    GOOGLE_STATE_COOKIE,
    await stateCookieValue({ state, nonce, codeVerifier }),
    GOOGLE_STATE_COOKIE_OPTIONS,
  );
  const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  authorizationUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_CUSTOMER_SCOPES.join(" "),
    state,
    nonce,
    code_challenge: pkceChallenge(codeVerifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return authorizationUrl.toString();
}

async function exchangeCode(config: GoogleCustomerAuthConfig, code: string, codeVerifier: string) {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });
  const result = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!result.ok) throw new GoogleCustomerAuthError("provider_error");
  const payload = await result.json() as { id_token?: unknown };
  if (typeof payload.id_token !== "string" || !payload.id_token) throw new GoogleCustomerAuthError("provider_error");
  return payload.id_token;
}

export async function verifyGoogleIdToken(idToken: string, config = getGoogleCustomerAuthConfig()) {
  requireConfigured(config);
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    algorithms: ["RS256"],
    issuer: [...GOOGLE_ISSUERS],
    audience: config.clientId,
  });
  const claims = payload as GoogleIdTokenClaims;
  if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 255) throw new GoogleCustomerAuthError("provider_error");
  if (typeof claims.email !== "string" || !claims.email_verified || claims.email_verified !== true) throw new GoogleCustomerAuthError("provider_error");
  const email = normalizeCustomerEmail(claims.email);
  if (!email || !email.includes("@") || email.length > 320) throw new GoogleCustomerAuthError("provider_error");
  return {
    subject: claims.sub,
    email,
    firstName: typeof claims.given_name === "string" ? claims.given_name.trim().slice(0, 160) : "",
    lastName: typeof claims.family_name === "string" ? claims.family_name.trim().slice(0, 160) : "",
    nonce: typeof claims.nonce === "string" ? claims.nonce : "",
  };
}

function requiredDb() {
  return getDb().then((db) => {
    if (!db) throw new GoogleCustomerAuthError("provider_error");
    return db;
  });
}

async function signInGoogleCustomer(identity: Awaited<ReturnType<typeof verifyGoogleIdToken>>, expectedNonce: string, response: Response) {
  if (!safeEqual(identity.nonce, expectedNonce)) throw new GoogleCustomerAuthError("provider_error");
  const db = await requiredDb();
  let customerId = 0;
  let sessionVersion = 0;
  await db.transaction(async (tx) => {
    const [existingIdentity] = await tx.select({ identity: customerGoogleIdentities, profile: customerProfiles }).from(customerGoogleIdentities).innerJoin(customerProfiles, eq(customerProfiles.id, customerGoogleIdentities.customerId)).where(eq(customerGoogleIdentities.subject, identity.subject)).limit(1);
    if (existingIdentity) {
      if (existingIdentity.profile.accountStatus !== "active") throw new GoogleCustomerAuthError("disabled");
      const [credential] = await tx.select().from(customerCredentials).where(eq(customerCredentials.customerId, existingIdentity.profile.id)).limit(1);
      if (!credential) throw new GoogleCustomerAuthError("provider_error");
      customerId = existingIdentity.profile.id;
      sessionVersion = credential.sessionVersion;
      await tx.update(customerProfiles).set({ lastSignedInAt: new Date() }).where(eq(customerProfiles.id, customerId));
      return;
    }

    // Never link an existing password/legacy profile from an email match. The
    // only supported linking flow requires an authenticated customer plus a
    // separate explicit intent, which is intentionally not part of this route.
    const [sameEmail] = await tx.select({ id: customerProfiles.id }).from(customerProfiles).where(eq(customerProfiles.email, identity.email)).limit(1);
    if (sameEmail) throw new GoogleCustomerAuthError("conflict");

    const result = await tx.insert(customerProfiles).values({
      legacyCustomerId: null,
      email: identity.email,
      firstName: identity.firstName || identity.email.split("@")[0].slice(0, 160),
      lastName: identity.lastName || "Customer",
      phone: null,
      accessRoleId: null,
      staffUserId: null,
      emailVerifiedAt: new Date(),
      newsletterSubscribed: false,
      legacyWasApproved: false,
      legacyWasActive: false,
      accountStatus: "active",
      activatedAt: new Date(),
      lastSignedInAt: new Date(),
    });
    customerId = Number(result[0].insertId);
    sessionVersion = 1;
    await tx.insert(customerCredentials).values({ customerId, passwordHash: null, passwordSetAt: null, sessionVersion, failedLoginCount: 0, lockedUntil: null });
    await tx.insert(customerGoogleIdentities).values({ customerId, subject: identity.subject });
  });
  await setCustomerSession(response, customerId, sessionVersion);
}

export async function handleGoogleCustomerCallback(request: Request, response: Response) {
  const config = getGoogleCustomerAuthConfig();
  response.clearCookie(GOOGLE_STATE_COOKIE, GOOGLE_STATE_CLEAR_OPTIONS);
  try {
    requireConfigured(config);
    const stateFromCookie = readCookie(request.headers.cookie, GOOGLE_STATE_COOKIE);
    const stateFromQuery = typeof request.query.state === "string" ? request.query.state : "";
    const code = typeof request.query.code === "string" ? request.query.code : "";
    if (!stateFromCookie || !stateFromQuery || !code) throw new GoogleCustomerAuthError("invalid_request");
    const state = await verifyStateCookie(stateFromCookie);
    if (!safeEqual(state.state, stateFromQuery) || !consumeState(state.state)) throw new GoogleCustomerAuthError("invalid_request");
    const idToken = await exchangeCode(config, code, state.codeVerifier);
    const identity = await verifyGoogleIdToken(idToken, config);
    await signInGoogleCustomer(identity, state.nonce, response);
    return response.redirect(303, "/account?google=success");
  } catch (error) {
    return errorRedirect(response, error);
  }
}

export function registerGoogleCustomerAuthRoutes(app: Express) {
  app.get("/api/customer/google/start", async (_request, response) => {
    try {
      const authorizationUrl = await startGoogleCustomerAuth(response);
      return response.redirect(302, authorizationUrl);
    } catch (error) {
      if (error instanceof GoogleCustomerAuthError && error.kind === "not_configured") {
        return response.status(503).json({ error: "Google customer login is not configured." });
      }
      return response.status(500).json({ error: "Google customer login is temporarily unavailable." });
    }
  });

  app.get("/api/customer/google/callback", (request, response) => handleGoogleCustomerCallback(request, response));
}
