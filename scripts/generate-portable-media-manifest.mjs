#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const projectRoot = path.resolve(import.meta.dirname, "..");
const exportRoot = path.resolve(process.env.PORTABLE_EXPORT_DIR || "/home/ubuntu/joan-portable-export");
const sourceOrigin = (process.env.PORTABLE_SOURCE_ORIGIN || "https://joanredesign-gcqdscde.manus.space").replace(/\/+$/, "");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error("DATABASE_URL is required to generate a portable media manifest.");

const connection = await mysql.createConnection(databaseUrl);
const records = [];

const addValue = (value, source) => {
  if (typeof value !== "string" || !value.trim()) return;
  if (value.startsWith("/manus-storage/")) {
    records.push({ source, url: value, key: value.replace(/^\/manus-storage\//, "") });
  }
};

const addJsonUrls = (value, source) => {
  try {
    const parsed = JSON.parse(value || "[]");
    if (Array.isArray(parsed)) parsed.forEach((item, index) => addValue(item, `${source}[${index}]`));
  } catch {
    throw new Error(`Invalid JSON media value at ${source}.`);
  }
};

const [products] = await connection.query("SELECT id, imageUrl, galleryJson FROM catalogue_products");
for (const product of products) {
  addValue(product.imageUrl, `catalogue_products:${product.id}:imageUrl`);
  addJsonUrls(product.galleryJson, `catalogue_products:${product.id}:galleryJson`);
}

const [categories] = await connection.query("SELECT id, imageUrl FROM catalogue_categories");
for (const category of categories) addValue(category.imageUrl, `catalogue_categories:${category.id}:imageUrl`);

const [manufacturers] = await connection.query("SELECT id, imageUrl FROM catalogue_manufacturers");
for (const manufacturer of manufacturers) addValue(manufacturer.imageUrl, `catalogue_manufacturers:${manufacturer.id}:imageUrl`);

const [brochures] = await connection.query("SELECT id, sourcePdfUrl, pageUrlsJson FROM catalogue_brochures");
for (const brochure of brochures) {
  addValue(brochure.sourcePdfUrl, `catalogue_brochures:${brochure.id}:sourcePdfUrl`);
  addJsonUrls(brochure.pageUrlsJson, `catalogue_brochures:${brochure.id}:pageUrlsJson`);
}

const sourceFiles = [];
const walk = async (directory) => {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(fullPath);
    else if (/\.(?:ts|tsx|css|html)$/i.test(entry.name)) sourceFiles.push(fullPath);
  }
};
await walk(path.join(projectRoot, "client"));
for (const file of sourceFiles) {
  const text = await fs.readFile(file, "utf8");
  for (const match of text.matchAll(/\/manus-storage\/[^\s"'`)<]+/g)) {
    addValue(match[0], `source:${path.relative(projectRoot, file)}`);
  }
}

await connection.end();

const grouped = new Map();
for (const record of records) {
  const existing = grouped.get(record.key) || { key: record.key, sourceUrl: `${sourceOrigin}/manus-storage/${record.key}`, localPath: `media/${record.key}`, references: [] };
  existing.references.push(record.source);
  grouped.set(record.key, existing);
}

const manifest = [...grouped.values()].sort((a, b) => a.key.localeCompare(b.key));
const outputDir = path.join(exportRoot, "manifests");
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "media-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await fs.writeFile(
  path.join(outputDir, "media-inventory-summary.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), mediaItems: manifest.length, databaseReferences: records.filter((record) => !record.source.startsWith("source:")).length, sourceCodeReferences: records.filter((record) => record.source.startsWith("source:")).length }, null, 2)}\n`,
);

console.log(`Portable media manifest: ${manifest.length} unique files written to ${outputDir}`);
