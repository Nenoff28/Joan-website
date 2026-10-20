#!/usr/bin/env node

const baseUrl = (process.env.LOAD_TEST_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const paths = (process.env.LOAD_TEST_PATHS || "/,/products,/products?page=2,/checkout")
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean);
const requestsPerPath = Math.max(1, Number(process.env.LOAD_TEST_REQUESTS || 12));
const concurrency = Math.max(1, Number(process.env.LOAD_TEST_CONCURRENCY || 6));
const timeoutMs = Math.max(1000, Number(process.env.LOAD_TEST_TIMEOUT_MS || 15000));

const jobs = paths.flatMap((path) => Array.from({ length: requestsPerPath }, (_, index) => ({ path, index })));
const results = [];
let cursor = 0;

async function runJob(job) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${job.path}`, {
      signal: controller.signal,
      headers: { accept: "text/html,application/xhtml+xml" },
    });
    const body = await response.arrayBuffer();
    results.push({ path: job.path, status: response.status, ms: performance.now() - started, bytes: body.byteLength });
  } catch (error) {
    results.push({ path: job.path, status: 0, ms: performance.now() - started, bytes: 0, error: error instanceof Error ? error.message : String(error) });
  } finally {
    clearTimeout(timeout);
  }
}

async function worker() {
  while (true) {
    const job = jobs[cursor++];
    if (!job) return;
    await runJob(job);
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

const grouped = new Map();
for (const result of results) grouped.set(result.path, [...(grouped.get(result.path) || []), result]);
const report = {
  baseUrl,
  requestsPerPath,
  concurrency,
  timeoutMs,
  totalRequests: results.length,
  completed2xx: results.filter((result) => result.status >= 200 && result.status < 300).length,
  failed: results.filter((result) => result.status < 200 || result.status >= 300).length,
  routes: Object.fromEntries(Array.from(grouped.entries()).map(([path, routeResults]) => {
    const durations = routeResults.map((result) => result.ms);
    return [path, {
      requests: routeResults.length,
      statuses: Object.fromEntries([...new Set(routeResults.map((result) => result.status))].map((status) => [status, routeResults.filter((result) => result.status === status).length])),
      p50Ms: Math.round(percentile(durations, 0.5)),
      p95Ms: Math.round(percentile(durations, 0.95)),
      maxMs: Math.round(Math.max(...durations)),
      averageBytes: Math.round(routeResults.reduce((sum, result) => sum + result.bytes, 0) / routeResults.length),
      errors: routeResults.filter((result) => result.error).map((result) => result.error),
    }];
  })),
};

console.log(JSON.stringify(report, null, 2));
if (report.failed > 0) process.exitCode = 1;
