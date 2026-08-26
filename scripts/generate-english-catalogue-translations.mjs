#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createPool } from "mysql2/promise";

const cyrillic = /[\u0400-\u04FF]/;
const allowedKinds = new Set(["products", "categories", "all"]);
const args = new Map(process.argv.slice(2).map((value, index, values) => value.startsWith("--") ? [value.slice(2), values[index + 1] ?? "true"] : []));
const kind = args.get("kind") ?? "all";
const batchSize = Math.max(1, Math.min(12, Number(args.get("batch-size") ?? 8)));
const concurrency = Math.max(1, Math.min(6, Number(args.get("concurrency") ?? 4)));
const limit = args.has("limit") ? Math.max(1, Number(args.get("limit"))) : undefined;
const model = args.get("model") ?? "gpt-5-mini";

if (!allowedKinds.has(kind)) throw new Error("--kind must be products, categories or all");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!process.env.BUILT_IN_FORGE_API_URL || !process.env.BUILT_IN_FORGE_API_KEY) throw new Error("Built-in translation service environment is required");

const pool = createPool({ uri: process.env.DATABASE_URL, connectionLimit: concurrency + 2 });
const hash = (value) => createHash("sha256").update(value).digest("hex");
const plain = (value) => typeof value === "string" ? value.trim() : "";
const jsonArray = (value) => { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : []; } catch { return []; } };
const jsonTree = (value) => { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };
const hasCyrillic = (value) => cyrillic.test(JSON.stringify(value));
const chunks = (entries, size) => Array.from({ length: Math.ceil(entries.length / size) }, (_, index) => entries.slice(index * size, index * size + size));

function productSourceHash(row) {
  return hash([row.brand ?? "", row.name, row.description, row.imageAlt, row.featuresJson, row.legacySeoKeywordBg ?? "", row.legacyMetaTitleBg ?? "", row.legacyMetaDescriptionBg ?? ""].join("\u001F"));
}

function categorySourceHash(row) {
  return hash([row.name, row.description, row.subcategoriesJson, row.legacySeoKeywordBg ?? "", row.legacyMetaTitleBg ?? "", row.legacyMetaDescriptionBg ?? ""].join("\u001F"));
}

function normalizedProduct(row) {
  return {
    id: row.id,
    brand: plain(row.brand),
    name: plain(row.name),
    description: plain(row.description),
    imageAlt: plain(row.imageAlt),
    features: jsonArray(row.featuresJson),
    seoKeywords: plain(row.legacySeoKeywordBg),
    seoTitle: plain(row.legacyMetaTitleBg),
    seoDescription: plain(row.legacyMetaDescriptionBg),
  };
}

function normalizedCategory(row) {
  return {
    id: row.id,
    name: plain(row.name),
    description: plain(row.description),
    subcategories: jsonTree(row.subcategoriesJson),
    seoKeywords: plain(row.legacySeoKeywordBg),
    seoTitle: plain(row.legacyMetaTitleBg),
    seoDescription: plain(row.legacyMetaDescriptionBg),
  };
}

const translationSchema = (entryKind) => ({
  name: `catalogue_${entryKind}_translation_batch`,
  strict: true,
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: entryKind === "product"
          ? {
              type: "object",
              properties: {
                id: { type: "integer" }, brand: { type: "string" }, name: { type: "string" }, description: { type: "string" }, imageAlt: { type: "string" }, features: { type: "array", items: { type: "string" } }, seoKeywords: { type: "string" }, seoTitle: { type: "string" }, seoDescription: { type: "string" },
              },
              required: ["id", "brand", "name", "description", "imageAlt", "features", "seoKeywords", "seoTitle", "seoDescription"],
              additionalProperties: false,
            }
          : {
              type: "object",
              properties: {
                id: { type: "integer" }, name: { type: "string" }, description: { type: "string" }, subcategoriesJson: { type: "string" }, seoKeywords: { type: "string" }, seoTitle: { type: "string" }, seoDescription: { type: "string" },
              },
              required: ["id", "name", "description", "subcategoriesJson", "seoKeywords", "seoTitle", "seoDescription"],
              additionalProperties: false,
            },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
});

async function translateBatch(entryKind, entries) {
  const content = entryKind === "product" ? entries.map(normalizedProduct) : entries.map(normalizedCategory);
  const instructions = entryKind === "product"
    ? "Translate every human-readable Bulgarian customer-facing product field to natural, accurate English. Preserve brand names, model codes, SKU-like identifiers, dimensions, quantities, units, standards, HTML tags and technical values exactly. Do not add facts, marketing claims, features or omissions. Translate every feature string. Translate visible words inside HTML while retaining the tags and their order. SEO text must be concise, accurate English. Return the same ids and all fields, even when source values are empty. No Cyrillic characters may remain in translated text."
    : "Translate every human-readable Bulgarian category field to natural, accurate English. Preserve technical names, brands, model codes, dimensions and values. Translate every label at every depth of subcategoriesJson while preserving its exact JSON structure and non-text values. Do not add or omit categories, details or claims. SEO text must be concise, accurate English. Return the same ids and all fields, even when source values are empty. No Cyrillic characters may remain in translated text.";
  const response = await fetch(`${process.env.BUILT_IN_FORGE_API_URL.replace(/\/+$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_completion_tokens: 6000, messages: [{ role: "system", content: "You are a meticulous professional Bulgarian-to-English catalogue translator. Output only the specified JSON." }, { role: "user", content: `${instructions}\n\nSource entries:\n${JSON.stringify(content)}` }], response_format: { type: "json_schema", json_schema: translationSchema(entryKind) } }),
  });
  if (!response.ok) throw new Error(`Translation service returned ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const text = payload.choices?.[0]?.message?.content;
  const result = JSON.parse(text);
  if (!Array.isArray(result.items) || result.items.length !== entries.length) throw new Error(`Expected ${entries.length} ${entryKind} translations; received ${result.items?.length ?? 0}`);
  const expected = new Set(entries.map((entry) => entry.id));
  const seen = new Set();
  for (const item of result.items) {
    if (!expected.has(item.id) || seen.has(item.id)) throw new Error(`Translation response contains an unexpected or duplicate ${entryKind} id`);
    seen.add(item.id);
    if (hasCyrillic(item)) throw new Error(`Translation response still contains Cyrillic text for ${entryKind} ${item.id}`);
  }
  return result.items;
}

async function writeProducts(rows, translated) {
  const sourceById = new Map(rows.map((row) => [row.id, row]));
  for (const item of translated) {
    const source = sourceById.get(item.id);
    await pool.execute(
      `INSERT INTO catalogue_product_english (productId, brand, name, description, imageAlt, featuresJson, seoKeywords, seoTitle, seoDescription, sourceContentHash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE brand = VALUES(brand), name = VALUES(name), description = VALUES(description), imageAlt = VALUES(imageAlt), featuresJson = VALUES(featuresJson), seoKeywords = VALUES(seoKeywords), seoTitle = VALUES(seoTitle), seoDescription = VALUES(seoDescription), sourceContentHash = VALUES(sourceContentHash), translatedAt = NOW()`,
      [item.id, item.brand || null, item.name, item.description, item.imageAlt, JSON.stringify(item.features), item.seoKeywords || null, item.seoTitle || null, item.seoDescription || null, productSourceHash(source)],
    );
  }
}

async function writeCategories(rows, translated) {
  const sourceById = new Map(rows.map((row) => [row.id, row]));
  for (const item of translated) {
    const source = sourceById.get(item.id);
    await pool.execute(
      `INSERT INTO catalogue_category_english (categoryId, name, description, subcategoriesJson, seoKeywords, seoTitle, seoDescription, sourceContentHash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), subcategoriesJson = VALUES(subcategoriesJson), seoKeywords = VALUES(seoKeywords), seoTitle = VALUES(seoTitle), seoDescription = VALUES(seoDescription), sourceContentHash = VALUES(sourceContentHash), translatedAt = NOW()`,
      [item.id, item.name, item.description, item.subcategoriesJson, item.seoKeywords || null, item.seoTitle || null, item.seoDescription || null, categorySourceHash(source)],
    );
  }
}

async function sourceRows(entryKind) {
  if (entryKind === "product") {
    const [rows] = await pool.query(`SELECT p.id, p.brand, p.name, p.description, p.imageAlt, p.featuresJson, p.legacySeoKeywordBg, p.legacyMetaTitleBg, p.legacyMetaDescriptionBg
      FROM catalogue_products p LEFT JOIN catalogue_product_english e ON e.productId = p.id
      WHERE e.productId IS NULL OR e.sourceContentHash <> SHA2(CONCAT_WS(CHAR(31), COALESCE(p.brand, ''), p.name, p.description, p.imageAlt, p.featuresJson, COALESCE(p.legacySeoKeywordBg, ''), COALESCE(p.legacyMetaTitleBg, ''), COALESCE(p.legacyMetaDescriptionBg, '')), 256)
      ORDER BY p.id`);
    return rows;
  }
  const [rows] = await pool.query(`SELECT c.id, c.name, c.description, c.subcategoriesJson, c.legacySeoKeywordBg, c.legacyMetaTitleBg, c.legacyMetaDescriptionBg
    FROM catalogue_categories c LEFT JOIN catalogue_category_english e ON e.categoryId = c.id
    WHERE e.categoryId IS NULL OR e.sourceContentHash <> SHA2(CONCAT_WS(CHAR(31), c.name, c.description, c.subcategoriesJson, COALESCE(c.legacySeoKeywordBg, ''), COALESCE(c.legacyMetaTitleBg, ''), COALESCE(c.legacyMetaDescriptionBg, '')), 256)
    ORDER BY c.id`);
  return rows;
}

async function runKind(entryKind) {
  let rows = await sourceRows(entryKind);
  if (limit) rows = rows.slice(0, limit);
  const pending = rows.filter((row) => hasCyrillic(entryKind === "product" ? normalizedProduct(row) : normalizedCategory(row)));
  const alreadyEnglish = rows.filter((row) => !pending.includes(row));
  if (alreadyEnglish.length) {
    if (entryKind === "product") await writeProducts(alreadyEnglish, alreadyEnglish.map(normalizedProduct));
    else await writeCategories(alreadyEnglish, alreadyEnglish.map(normalizedCategory));
  }
  console.log(`${entryKind}: ${pending.length} source rows require translation; ${alreadyEnglish.length} source rows already contain no Cyrillic.`);
  let completed = 0;
  const batches = chunks(pending, batchSize);
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const current = batches[next++];
      const translated = await translateBatch(entryKind, current);
      if (entryKind === "product") await writeProducts(current, translated);
      else await writeCategories(current, translated);
      completed += current.length;
      console.log(`${entryKind}: ${completed}/${pending.length} translations saved`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, worker));
}

try {
  if (kind === "products" || kind === "all") await runKind("product");
  if (kind === "categories" || kind === "all") await runKind("category");
} finally {
  await pool.end();
}
