import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("SuperHosting readiness materials", () => {
  it("documents the Node.js decision branches and staging-first safety rules", () => {
    const guide = fs.readFileSync(path.resolve(import.meta.dirname, "../docs/superpro-cpanel-readiness.md"), "utf8");

    expect(guide).toContain("Setup Node.js App");
    expect(guide).toContain("Node 20.10");
    expect(guide).toContain("staging");
    expect(guide).toContain("DNS cutover");
    expect(guide).toContain("superhosting-preflight.mjs");
  });

  it("keeps the preflight script secret-safe and non-destructive", () => {
    const script = fs.readFileSync(path.resolve(import.meta.dirname, "../scripts/superhosting-preflight.mjs"), "utf8");

    expect(script).toContain("minimumRuntime = [20, 11, 0]");
    expect(script).toContain("does not read or print secret values");
    expect(script).not.toMatch(/fetch\(|axios|mysql|storagePut|process\.env\.[A-Z_]+/);
  });

  it("defines a staging release without secrets, customer exports, or public-root deployment", () => {
    const releaseGuide = fs.readFileSync(path.resolve(import.meta.dirname, "../docs/superhosting-staging-release-contents.md"), "utf8");

    expect(releaseGuide).toContain("release-manifest.json");
    expect(releaseGuide).toContain("node_modules/");
    expect(releaseGuide).toContain(".env");
    expect(releaseGuide).toContain("public_html");
    expect(releaseGuide).toContain("rollback");
  });

  it("keeps cPanel day-one work staging-first with a clear Node.js go/no-go decision", () => {
    const checklist = fs.readFileSync(path.resolve(import.meta.dirname, "../docs/superhosting-cpanel-day-one-checklist.md"), "utf8");

    expect(checklist).toContain("Setup Node.js App");
    expect(checklist).toContain("Node 20.11");
    expect(checklist).toContain("Не пипаме DNS");
    expect(checklist).toContain("rollback");
  });

  it("requires backup, restore, capacity and monitoring evidence before a high-volume cutover", () => {
    const readiness = fs.readFileSync(path.resolve(import.meta.dirname, "../docs/managed-hosting-high-volume-readiness.md"), "utf8");

    expect(readiness).toContain("не е SLA");
    expect(readiness).toContain("restore proof");
    expect(readiness).toContain("load test");
    expect(readiness).toContain("Monitoring");
    expect(readiness).toContain("не одобрено за high-volume production cutover");
  });
});
