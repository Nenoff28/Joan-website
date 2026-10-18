import { z } from "zod";

export type CategoryNodeInput = { label: string; children?: CategoryNodeInput[] };

const categoryNodeSchema: z.ZodType<CategoryNodeInput> = z.lazy(() => z.object({
  label: z.string().trim().min(1, "Етикетът на подкатегорията е задължителен.").max(160, "Етикетът на подкатегорията е до 160 знака."),
  children: z.array(categoryNodeSchema).max(24, "Една категория може да има най-много 24 подкатегории.").optional(),
}));

const latinSlug = z.string().trim().min(3, "URL адресът трябва да има поне 3 знака.").max(128, "URL адресът е прекалено дълъг.").regex(/^[a-z0-9-]+$/, "URL адресът използва само малки латински букви, цифри и тирета.");

/** Shared wire contract for creating and editing both native roots and children. */
export const categoryPayloadSchema = z.object({
  slug: latinSlug,
  name: z.string().trim().min(2, "Името трябва да съдържа поне 2 знака.").max(255, "Името е до 255 знака."),
  description: z.string().trim().default(""),
  imageUrl: z.string().trim().default(""),
  icon: z.string().trim().default("house").pipe(z.string().min(1, "Иконата е задължителна.").max(64, "Иконата е до 64 знака.")),
  sortOrder: z.number().int("Редът трябва да е цяло число.").min(0, "Редът не може да е отрицателен.").max(999, "Редът е до 999."),
  isActive: z.boolean(),
  parentId: z.number().int("Родителят трябва да е цяло число.").positive("Родителят трябва да е положителен идентификатор.").nullable().optional(),
  subcategories: z.array(categoryNodeSchema).max(24, "Една категория може да има най-много 24 подкатегории.").optional(),
}).superRefine((value, context) => {
  if ((value.parentId == null) && !value.imageUrl) {
    context.addIssue({ code: "custom", path: ["imageUrl"], message: "Главната категория изисква снимка." });
  }
});

export type CategoryPayload = z.infer<typeof categoryPayloadSchema>;

type ValidationIssue = { path?: readonly PropertyKey[]; message?: string; code?: string };

function issueMessage(issue: ValidationIssue) {
  if (issue.message && /[А-Яа-я]/.test(issue.message)) return issue.message;
  const field = String(issue.path?.[0] ?? "form");
  if (field === "slug") return "URL адресът използва само малки латински букви и тирета и трябва да има от 3 до 128 знака.";
  if (field === "name") return "Името трябва да съдържа поне 2 знака.";
  if (field === "imageUrl") return "Главната категория изисква снимка.";
  if (field === "parentId") return "Родителят трябва да е положителен идентификатор или празен за главна категория.";
  if (field === "sortOrder") return "Редът трябва да е цяло число между 0 и 999.";
  if (field === "icon") return "Иконата е задължителна и трябва да е до 64 знака.";
  return "Проверете попълнените данни за категорията.";
}

function extractIssues(error: unknown): ValidationIssue[] {
  if (error && typeof error === "object") {
    const candidate = error as { issues?: unknown; data?: { zodError?: unknown } };
    if (Array.isArray(candidate.issues)) return candidate.issues as ValidationIssue[];
    const wrapped = candidate.data?.zodError;
    if (wrapped && typeof wrapped === "object" && (wrapped as { fieldErrors?: unknown }).fieldErrors && typeof (wrapped as { fieldErrors: unknown }).fieldErrors === "object") {
      const fieldErrors = (wrapped as { fieldErrors: Record<string, unknown> }).fieldErrors;
      return Object.entries(fieldErrors).flatMap(([field, value]) => Array.isArray(value) ? value.map((message) => ({ path: [field], message: String(message) })) : []);
    }
    if (wrapped && typeof wrapped === "object" && Array.isArray((wrapped as { issues?: unknown }).issues)) return (wrapped as { issues: ValidationIssue[] }).issues;
    if (typeof wrapped === "string") {
      try { return extractIssues(JSON.parse(wrapped)); } catch { /* continue with plain message */ }
    }
  }
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (message) {
    try {
      const parsed = JSON.parse(message) as unknown;
      if (Array.isArray(parsed)) return parsed as ValidationIssue[];
      if (parsed && typeof parsed === "object") return extractIssues(parsed);
    } catch { /* plain server error */ }
  }
  return [];
}

/** Converts raw Zod/tRPC errors into a short Bulgarian message safe for the UI. */
export function categoryValidationMessage(error: unknown): string {
  const issues = extractIssues(error);
  if (issues.length) return Array.from(new Set(issues.map(issueMessage))).join(" ");
  const message = error instanceof Error ? error.message : "";
  return message && /[А-Яа-я]/.test(message) ? message : "Записът на категорията не бе завършен. Проверете данните и опитайте отново.";
}
