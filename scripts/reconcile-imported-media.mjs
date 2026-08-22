import fs from "node:fs";
import mysql from "mysql2/promise";

const OUTPUT = "/home/ubuntu/universal-export-audit/media_reconciliation_report.json";
const concurrency = 20;

function isImageUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value) && (/\/image\//i.test(value) || /\.(?:avif|gif|jpe?g|png|webp)(?:[?#]|$)/i.test(value));
}

async function checkUrl(url) {
  try {
    let response = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(12_000) });
    if (response.status !== 200 || !(response.headers.get("content-type") || "").startsWith("image/")) {
      response = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, redirect: "follow", signal: AbortSignal.timeout(12_000) });
    }
    return { status: response.status, contentType: response.headers.get("content-type") || "missing" };
  } catch {
    return { status: "network_error", contentType: "missing" };
  }
}

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [primaryRows] = await connection.query("SELECT imageUrl FROM catalogue_products WHERE legacyProductId IS NOT NULL AND MOD(legacyProductId, 25) = 0 ORDER BY legacyProductId");
    const [galleryRows] = await connection.query("SELECT galleryJson FROM catalogue_products WHERE legacyProductId IS NOT NULL AND galleryJson LIKE '%https%' ORDER BY legacyProductId LIMIT 500");
    const urls = new Set(primaryRows.map((row) => row.imageUrl).filter(isImageUrl));
    for (const row of galleryRows) {
      try {
        for (const url of JSON.parse(row.galleryJson)) if (isImageUrl(url)) urls.add(url);
      } catch { /* Invalid gallery JSON is reported by gallery counts elsewhere; do not reveal row data. */ }
    }
    const queue = [...urls];
    const statuses = {};
    const contentTypes = {};
    const failures = [];
    let invalid = 0;
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const url = queue.shift();
        const result = await checkUrl(url);
        const status = String(result.status);
        statuses[status] = (statuses[status] ?? 0) + 1;
        contentTypes[result.contentType] = (contentTypes[result.contentType] ?? 0) + 1;
        if (![200, 206].includes(result.status) || !result.contentType.startsWith("image/")) { invalid += 1; failures.push(url); }
      }
    }));
    const report = { sampledUniqueImageUrls: urls.size, statuses, contentTypes, invalidOrNonImageResponses: invalid, failures };
    fs.writeFileSync(OUTPUT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally {
    await connection.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
