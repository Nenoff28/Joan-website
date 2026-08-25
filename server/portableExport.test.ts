import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("portable local export tooling", () => {
  it("generates a manifest from catalogue and brochure media instead of hardcoding a sample", () => {
    const script = fs.readFileSync(path.resolve(import.meta.dirname, "../scripts/generate-portable-media-manifest.mjs"), "utf8");

    expect(script).toContain("catalogue_products");
    expect(script).toContain("catalogue_brochures");
    expect(script).toContain("media-manifest.json");
    expect(script).toContain("PORTABLE_EXPORT_DIR");
  });

  it("downloads and hashes portable media outside the web project", () => {
    const script = fs.readFileSync(path.resolve(import.meta.dirname, "../scripts/download-portable-media.mjs"), "utf8");

    expect(script).toContain("sha256");
    expect(script).toContain("media-download-report.json");
    expect(script).toContain("PORTABLE_MEDIA_CONCURRENCY");
    expect(script).not.toContain("storagePut");
  });

  it("exports a transaction snapshot without table locks or plain credential logging", () => {
    const script = fs.readFileSync(path.resolve(import.meta.dirname, "../scripts/export-portable-database.mjs"), "utf8");

    expect(script).toContain("REPEATABLE READ");
    expect(script).toContain("connection.beginTransaction()");
    expect(script).toContain("consistency: \"repeatable-read transaction snapshot; no table locks\"");
    expect(script).not.toContain("FLUSH TABLES");
    expect(script).not.toContain("console.log(databaseUrl)");
  });

  it("documents local media, database, and managed OAuth boundaries for the exported package", () => {
    const guide = fs.readFileSync(path.resolve(import.meta.dirname, "../docs/portable-local-runtime.md"), "utf8");

    expect(guide).toContain("LOCAL_MEDIA_ROOT");
    expect(guide).toContain("локална MySQL/MariaDB");
    expect(guide).toContain("managed OAuth");
    expect(guide).toContain("не влизат в Git");
  });
});
