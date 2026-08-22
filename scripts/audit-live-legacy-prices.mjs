import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

const SOURCE_PATH = "/home/ubuntu/universal-export-audit/product.csv";
const OUTPUT_DIR = "/home/ubuntu/universal-export-audit";
const DETAIL_PATH = path.join(OUTPUT_DIR, "live-legacy-price-audit.ndjson");
const SUMMARY_PATH = path.join(OUTPUT_DIR, "live-legacy-price-audit-summary.json");
const CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.CONCURRENCY ?? 4)));
const LIMIT = Math.max(0, Number(process.env.LIMIT ?? 0));
const RETRIES = 2;

function text(value, length = 65535) {
  return String(value ?? "").trim().slice(0, length);
}

function decimal(value) {
  const parsed = Number(text(value, 64).replace(",", "."));
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
}

function eurFromMarkup(markup) {
  const match = markup.replace(/&nbsp;/g, " ").match(/([0-9]+(?:[.,][0-9]{1,2})?)\s*€/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function htmlText(markup) {
  return markup.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function sourceRows() {
  const [headers, ...rows] = parse(fs.readFileSync(SOURCE_PATH, "utf8"), {
    columns: false,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    trim: false,
  });
  const normalizedHeaders = headers.map((header, index) => text(header, 120) || `column_${index}`);
  return rows.map((values) => Object.fromEntries(normalizedHeaders.map((header, index) => [header, values[index] ?? ""])));
}

function readCompletedIds() {
  if (!fs.existsSync(DETAIL_PATH)) return new Set();
  const completed = new Set();
  for (const line of fs.readFileSync(DETAIL_PATH, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (record.legacyProductId) completed.add(String(record.legacyProductId));
    } catch {
      // Keep the audit resumable even if a process was interrupted mid-write.
    }
  }
  return completed;
}

async function fetchLiveRecord(product) {
  const keyword = text(product.seo_keyword_bg, 255) || text(product.seo_keyword_en, 255);
  const groupSpecialCandidate = decimal(product.special_price_for_group_1);
  const priceSpecialCandidate = decimal(product.price_special);
  const normalPriceCandidate = decimal(product.price);
  const hasDatedGroupSpecial = Boolean(text(product.special_price_for_group_1_start, 16) || text(product.special_price_for_group_1_end, 16));
  const today = new Date().toISOString().slice(0, 10);
  const groupWindowIsCurrent = (!text(product.special_price_for_group_1_start, 16) || text(product.special_price_for_group_1_start, 16) <= today)
    && (!text(product.special_price_for_group_1_end, 16) || text(product.special_price_for_group_1_end, 16) >= today);
  const sourceSpecialEur = groupSpecialCandidate && groupSpecialCandidate > 0 && groupSpecialCandidate < (normalPriceCandidate ?? Infinity) && groupWindowIsCurrent
    ? groupSpecialCandidate
    : priceSpecialCandidate && priceSpecialCandidate > 0 && priceSpecialCandidate < (normalPriceCandidate ?? Infinity) && !hasDatedGroupSpecial
      ? priceSpecialCandidate
      : null;
  const base = {
    legacyProductId: text(product.product_id, 32),
    sku: text(product.sku, 96) || text(product.model, 96) || null,
    name: text(product.name_bg, 500) || text(product.name_en, 500),
    keyword: keyword || null,
    url: `https://joan.bg/index.php?route=product/product&product_id=${encodeURIComponent(text(product.product_id, 32))}`,
    sourceNormalEur: decimal(product.price),
    sourceSpecialEur,
    sourceSpecialWindow: text(product.special_price_for_group_1_start, 16) && text(product.special_price_for_group_1_end, 16)
      ? `${text(product.special_price_for_group_1_start, 16)}..${text(product.special_price_for_group_1_end, 16)}`
      : null,
  };
  let lastError = null;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(base.url, {
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
        headers: { "user-agent": "JoanCatalogueMigrationAudit/1.0 (+https://joan.bg)" },
      });
      const html = await response.text();
      const oldMarkup = html.match(/<div\s+class="product-price-old"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? null;
      const newMarkup = html.match(/<div\s+class="product-price-new"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? null;
      const normalMarkup = html.match(/<div\s+class="product-price"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? null;
      const livePromotion = Boolean(newMarkup);
      const liveCurrentEur = eurFromMarkup(newMarkup ?? normalMarkup ?? "");
      const liveOldEur = eurFromMarkup(oldMarkup ?? "");
      const h1 = htmlText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
      const isProduct = Boolean(h1 && (normalMarkup || newMarkup || oldMarkup));
      const expectedCurrentEur = sourceSpecialEur ?? base.sourceNormalEur;
      const expectedOldEur = sourceSpecialEur ? base.sourceNormalEur : null;
      return {
        ...base,
        status: !response.ok ? `http_${response.status}` : isProduct ? "checked" : "not_product",
        finalUrl: response.url,
        liveName: h1 || null,
        livePromotion,
        liveCurrentEur,
        liveOldEur,
        livePriceMarkup: htmlText(newMarkup ?? normalMarkup ?? "") || null,
        matchesSource: isProduct && liveCurrentEur === expectedCurrentEur && liveOldEur === expectedOldEur,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < RETRIES) await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    }
  }
  return { ...base, status: "request_error", error: lastError };
}

async function main() {
  const products = sourceRows();
  const completedIds = readCompletedIds();
  const pending = products.filter((product) => !completedIds.has(text(product.product_id, 32)));
  const batch = LIMIT > 0 ? pending.slice(0, LIMIT) : pending;
  const writer = fs.createWriteStream(DETAIL_PATH, { flags: "a" });
  let cursor = 0;
  let checkedThisRun = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= batch.length) return;
      const result = await fetchLiveRecord(batch[index]);
      writer.write(`${JSON.stringify(result)}\n`);
      checkedThisRun += 1;
      if (checkedThisRun % 100 === 0) console.log(JSON.stringify({ progress: checkedThisRun, batch: batch.length, pending: pending.length, legacyProductId: result.legacyProductId, status: result.status }));
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await new Promise((resolve) => writer.end(resolve));

  const records = fs.readFileSync(DETAIL_PATH, "utf8").split("\n").flatMap((line) => {
    try { return line.trim() ? [JSON.parse(line)] : []; } catch { return []; }
  });
  const summary = {
    completedAt: new Date().toISOString(),
    sourceProductCount: products.length,
    auditedRecords: records.length,
    checked: records.filter((record) => record.status === "checked").length,
    matchesSource: records.filter((record) => record.matchesSource).length,
    priceOrPromotionMismatches: records.filter((record) => record.status === "checked" && !record.matchesSource).length,
    missingKeyword: records.filter((record) => record.status === "missing_keyword").length,
    notProduct: records.filter((record) => record.status === "not_product").length,
    requestErrors: records.filter((record) => record.status === "request_error").length,
    httpErrors: records.filter((record) => String(record.status).startsWith("http_")).length,
  };
  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
