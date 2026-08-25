#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const exportRoot = path.resolve(process.env.PORTABLE_EXPORT_DIR || "/home/ubuntu/joan-portable-export");
const manifestPath = path.join(exportRoot, "manifests", "media-manifest.json");
const reportPath = path.join(exportRoot, "manifests", "media-download-report.json");
const concurrency = Number(process.env.PORTABLE_MEDIA_CONCURRENCY || 8);
const retries = 3;

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
let previous = new Map();
try {
  const priorReport = JSON.parse(await fs.readFile(reportPath, "utf8"));
  previous = new Map((priorReport.items || []).filter((item) => item.status === "downloaded").map((item) => [item.key, item]));
} catch {
  // First run has no previous report.
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const downloadItem = async (item) => {
  const destination = path.join(exportRoot, item.localPath);
  const prior = previous.get(item.key);
  if (prior) {
    try {
      const stat = await fs.stat(destination);
      if (stat.size === prior.bytes && stat.size > 0) return { ...prior, status: "skipped" };
    } catch {
      // A partial/manual deletion should be re-downloaded.
    }
  }

  await fs.mkdir(path.dirname(destination), { recursive: true });
  let lastError = "Unknown media download error";
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(item.sourceUrl, { redirect: "follow", signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = Buffer.from(await response.arrayBuffer());
      if (!data.length) throw new Error("Received an empty response");
      const checksum = crypto.createHash("sha256").update(data).digest("hex");
      const temporaryDestination = `${destination}.partial`;
      await fs.writeFile(temporaryDestination, data);
      await fs.rename(temporaryDestination, destination);
      return { key: item.key, sourceUrl: item.sourceUrl, localPath: item.localPath, bytes: data.length, sha256: checksum, status: "downloaded", attempts: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < retries) await delay(300 * attempt);
    }
  }
  return { key: item.key, sourceUrl: item.sourceUrl, localPath: item.localPath, status: "failed", error: lastError, attempts: retries };
};

const queue = [...manifest];
const results = [];
let completed = 0;
const worker = async () => {
  while (queue.length) {
    const item = queue.shift();
    if (!item) return;
    const result = await downloadItem(item);
    results.push(result);
    completed += 1;
    if (completed % 100 === 0 || completed === manifest.length) console.log(`Portable media: ${completed}/${manifest.length}`);
  }
};

await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
const failures = results.filter((item) => item.status === "failed");
const totalBytes = results.reduce((sum, item) => sum + (item.bytes || 0), 0);
const report = { generatedAt: new Date().toISOString(), itemCount: manifest.length, downloaded: results.filter((item) => item.status === "downloaded").length, skipped: results.filter((item) => item.status === "skipped").length, failed: failures.length, totalBytes, items: results.sort((a, b) => a.key.localeCompare(b.key)) };
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Portable media finished: ${report.downloaded} downloaded, ${report.skipped} resumed, ${report.failed} failed, ${report.totalBytes} bytes.`);
if (failures.length) process.exitCode = 1;
