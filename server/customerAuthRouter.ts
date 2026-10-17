import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "./_core/trpc";
import {
  assertCustomerAuthRateLimit,
  registerCustomerAccount,
} from "./customerAccounts";
import { getGoogleCustomerAuthStatus } from "./googleCustomerAuth";

const customerRegistrationInput = z.object({
  firstName: z.string().trim().min(1).max(160),
  lastName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(64).nullable().optional(),
  password: z.string().min(12).max(256),
  acceptedTerms: z.literal(true),
}).strict();

function requestAddress(request: { ip?: string; socket?: { remoteAddress?: string } }) {
  return String(request.ip ?? request.socket?.remoteAddress ?? "unknown").slice(0, 128) || "unknown";
}

/**
 * Mutations are same-origin by default. Browsers send Origin on these POSTs;
 * missing Origin is allowed for server-side callers/tests, while an explicit
 * cross-site Origin or Fetch Metadata signal is rejected.
 */
export function assertCustomerSameOrigin(request: {
  protocol: string;
  headers: Record<string, unknown>;
  get?: (name: string) => string | undefined;
}) {
  const originHeader = request.headers.origin;
  const origin = Array.isArray(originHeader) ? String(originHeader[0] ?? "") : String(originHeader ?? "");
  const fetchSiteHeader = request.headers["sec-fetch-site"];
  const fetchSite = Array.isArray(fetchSiteHeader) ? String(fetchSiteHeader[0] ?? "") : String(fetchSiteHeader ?? "");
  if (fetchSite === "cross-site") throw new TRPCError({ code: "FORBIDDEN", message: "Невалидна заявка." });
  if (!origin) return;
  let expectedOrigin: string;
  try {
    const host = String(request.get?.("host") ?? request.headers.host ?? "").split(",")[0]?.trim();
    if (!host) throw new Error("missing host");
    expectedOrigin = host;
    if (new URL(origin).host !== expectedOrigin) throw new Error("origin mismatch");
  } catch {
    throw new TRPCError({ code: "FORBIDDEN", message: "Невалидна заявка." });
  }
}

function authError(error: unknown) {
  if (error instanceof TRPCError) return error;
  return new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Регистрацията не е успешна." });
}

export const additionalCustomerProcedures = {
  register: publicProcedure.input(customerRegistrationInput).mutation(async ({ input, ctx }) => {
    assertCustomerSameOrigin(ctx.req);
    const emailKey = input.email.trim().toLocaleLowerCase("en-US");
    try {
      assertCustomerAuthRateLimit(`registration:ip:${requestAddress(ctx.req)}`);
      assertCustomerAuthRateLimit(`registration:email:${emailKey}`);
      return await registerCustomerAccount(input, ctx.res);
    } catch (error) {
      throw authError(error);
    }
  }),
  googleStatus: publicProcedure.query(() => getGoogleCustomerAuthStatus()),
};

export const customerAuthRouter = additionalCustomerProcedures;
