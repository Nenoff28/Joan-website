import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { storagePut } from "../server/storage.ts";

const MAP_PATH = "/home/ubuntu/universal-export-audit/legacy-image-storage-map.json";
const REPORT_PATH = "/home/ubuntu/universal-export-audit/legacy-image-transfer-report.json";
const LEGACY_ROOT = "https://joan.bg/image/";
const FALLBACK_SOURCE = "https://joan.bg/image/no_image.png";
const MAX_BYTES = 16 * 1024 * 1024;
const CONCURRENCY = 12;
const limit = Number(process.env.IMAGE_TRANSFER_LIMIT || 0);

function readMap() { try { return JSON.parse(fs.readFileSync(MAP_PATH, "utf8")); } catch { return {}; } }
function persistMap(map) { fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2)); }
function validLegacyUrl(value) { return typeof value === "string" && value.startsWith(LEGACY_ROOT) && value !== LEGACY_ROOT; }
function normalizeSource(value) { return value === LEGACY_ROOT || !validLegacyUrl(value) || /\/catalog\/?$/i.test(value) ? FALLBACK_SOURCE : value; }
function contentTypeToExtension(contentType, source) { if (contentType.includes("png")) return "png"; if (contentType.includes("webp")) return "webp"; if (contentType.includes("gif")) return "gif"; if (contentType.includes("avif")) return "avif"; const extension = path.extname(new URL(source).pathname).replace(".", "").toLowerCase(); return ["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(extension) ? extension : "jpg"; }

async function transferOne(source, map) {
  if (map[source]) return map[source];
  const response = await fetch(encodeURI(source), { redirect: "follow", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`download status ${response.status}`);
  const contentType = response.headers.get("content-type") || "application/octet-stream";
  if (!contentType.startsWith("image/")) throw new Error(`unexpected content type ${contentType}`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_BYTES) throw new Error(`image exceeds ${MAX_BYTES} byte limit`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) throw new Error(`image exceeds ${MAX_BYTES} byte limit`);
  const hash = crypto.createHash("sha256").update(source).digest("hex");
  const stored = await storagePut(`catalogue/opencart-images/${hash}.${contentTypeToExtension(contentType, source)}`, bytes, contentType);
  map[source] = stored.url;
  persistMap(map);
  return stored.url;
}

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const map = readMap();
  const failures = [];
  try {
    const [rows] = await connection.query("SELECT id, imageUrl, galleryJson FROM catalogue_products WHERE legacyProductId IS NOT NULL");
    const sources = new Set();
    for (const row of rows) { sources.add(normalizeSource(row.imageUrl)); try { for (const value of JSON.parse(row.galleryJson || "[]")) sources.add(normalizeSource(value)); } catch { sources.add(FALLBACK_SOURCE); } }
    const pending = [...sources].filter((source) => !map[source]);
    const queue = limit > 0 ? pending.slice(0, limit) : pending;
    let completed = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (queue.length) { const source = queue.shift(); if (!source) return; try { await transferOne(source, map); completed += 1; } catch (error) { failures.push({ source, reason: error instanceof Error ? error.message : "unknown transfer failure" }); } } }));
    if (limit > 0 || failures.length) { const report = { mode: "transfer-only", totalSources: sources.size, alreadyMapped: Object.keys(map).length - completed, completed, failures }; fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2)); console.log(JSON.stringify({ mode: report.mode, totalSources: report.totalSources, completed: report.completed, failures: failures.length })); return; }
    let productsUpdated = 0;
    for (const row of rows) { const imageUrl = map[normalizeSource(row.imageUrl)]; let gallery; try { gallery = JSON.parse(row.galleryJson || "[]").map(normalizeSource).map((source) => map[source]).filter(Boolean); } catch { gallery = []; } if (!gallery.length) gallery = [imageUrl]; if (!imageUrl || gallery.some((url) => !url)) throw new Error("completed map is missing a product image reference"); await connection.execute("UPDATE catalogue_products SET imageUrl = ?, galleryJson = ? WHERE id = ?", [imageUrl, JSON.stringify([...new Set(gallery)]), row.id]); productsUpdated += 1; }
    const [[remaining]] = await connection.query("SELECT COUNT(*) AS count FROM catalogue_products WHERE legacyProductId IS NOT NULL AND (imageUrl LIKE 'https://joan.bg/%' OR galleryJson LIKE '%https://joan.bg/%')");
    const report = { mode: "complete", totalSources: sources.size, managedStorageAssets: Object.keys(map).length, productsUpdated, remainingLegacyImageReferences: Number(remaining.count), failures };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } finally { await connection.end(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
