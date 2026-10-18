import { z } from "zod";

export const productPayloadSchema = z.object({
  categoryId: z.number().int().positive("Изберете категория на артикула."),
  subcategoryIds: z.array(z.number().int().positive("Изберете валидна подкатегория.")).max(4, "Изберете най-много четири нива на подкатегории.").refine(ids => new Set(ids).size === ids.length, "Подкатегориите не могат да се повтарят.").optional(),
  slug: z.string().trim().min(3, "URL адресът трябва да има поне 3 знака.").max(160, "URL адресът е прекалено дълъг.").regex(/^[a-z0-9-]+$/, "URL адресът използва само малки латински букви, цифри и тирета."),
  seoTitle: z.string().trim().max(70, "SEO заглавието трябва да е до 70 знака.").nullable().optional(),
  seoDescription: z.string().trim().max(200, "SEO описанието трябва да е до 200 знака.").nullable().optional(),
  seoKeywords: z.string().trim().max(255, "Ключовите думи трябва да са до 255 знака.").nullable().optional(),
  seoRobots: z.enum(["index,follow", "noindex,follow"]).optional(),
  sku: z.string().trim().max(96, "Вътрешният код трябва да е до 96 знака.").nullable().optional(),
  brand: z.string().trim().max(160, "Марката трябва да е до 160 знака.").nullable().optional(),
  name: z.string().trim().min(3, "Името трябва да съдържа поне 3 знака.").max(500, "Името трябва да е до 500 знака."),
  description: z.string().trim().min(10, "Описанието трябва да съдържа поне 10 знака."),
  imageUrl: z.string().trim().min(1, "Добавете основна снимка."),
  gallery: z.array(z.string().trim().min(1)).min(1, "Добавете поне една снимка на артикула.").max(10, "Можете да добавите най-много 10 снимки."),
  imageAlt: z.string().trim().min(3, "Текстът за снимките трябва да има поне 3 знака."),
  priceEur: z.number().nonnegative("Цената не може да е отрицателна.").nullable().optional(),
  oldPriceEur: z.number().nonnegative("Старата цена не може да е отрицателна.").nullable().optional(),
  discountLabel: z.string().trim().max(48, "Промо етикетът трябва да е до 48 знака.").nullable().optional(),
  availability: z.enum(["in_stock", "on_request", "out_of_stock"]),
  stockQuantity: z.number().int("Количеството трябва да е цяло число.").min(0, "Количеството не може да е отрицателно.").max(999999, "Количеството трябва да е до 999999."),
  features: z.array(z.string().trim().min(1).max(180, "Всеки технически ред трябва да е до 180 знака.")).max(30, "Добавете най-много 30 технически реда."),
  isActive: z.boolean(),
});

const fieldLabels: Record<string, string> = {
  name: "Име", categoryId: "Категория", subcategoryIds: "Подкатегория", description: "Описание", slug: "URL адрес",
  sku: "Вътрешен код", brand: "Марка", imageUrl: "Основна снимка", gallery: "Снимки",
  imageAlt: "Текст на снимките", priceEur: "Цена", oldPriceEur: "Стара цена",
  stockQuantity: "Количество", features: "Технически данни", availability: "Наличност",
  seoTitle: "SEO заглавие", seoDescription: "SEO описание", seoKeywords: "Ключови думи",
};
export function productFieldErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = /[А-Яа-я]/.test(issue.message)
      ? issue.message : `Проверете полето „${fieldLabels[key] ?? "Данни за артикула"}“.`;
  }
  return errors;
}

// tRPC may wrap Zod issues as JSON in error.message. Never render that JSON.
export function readableProductError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Записът не бе завършен. Опитайте отново.";
  try {
    const issues = JSON.parse(message);
    if (Array.isArray(issues)) {
      if (issues.some(issue => issue.path?.[0] === "description" && issue.code === "too_small"))
        return "Описанието трябва да съдържа поне 10 знака.";
      return Object.values(productFieldErrors(issues)).join(" ") || "Проверете попълнените данни.";
    }
  } catch { /* Plain server error, not validation JSON. */ }
  return /[А-Яа-я]/.test(message) ? message : "Записът не бе завършен. Проверете данните и опитайте отново.";
}
