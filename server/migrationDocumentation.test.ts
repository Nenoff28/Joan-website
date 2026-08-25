import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("self-hosted migration documentation tooling", () => {
  it("includes a non-destructive source-versus-target database validation tool", () => {
    const script = fs.readFileSync(path.resolve(import.meta.dirname, "../scripts/verify-database-migration.mjs"), "utf8");

    expect(script).toContain("SOURCE_DATABASE_URL");
    expect(script).toContain("TARGET_DATABASE_URL");
    expect(script).toContain("SHOW CREATE TABLE");
    expect(script).toContain("sha256");
    expect(script).toContain("database-migration-validation.json");
    expect(script).not.toContain("DROP DATABASE");
    expect(script).not.toContain("DELETE FROM");
  });

  it("keeps the required production, migration and disaster-recovery documents actionable", () => {
    const production = fs.readFileSync(path.resolve(import.meta.dirname, "../PRODUCTION_DEPLOYMENT.md"), "utf8");
    const migration = fs.readFileSync(path.resolve(import.meta.dirname, "../DATABASE_MIGRATION.md"), "utf8");
    const recovery = fs.readFileSync(path.resolve(import.meta.dirname, "../DISASTER_RECOVERY.md"), "utf8");

    expect(production).toContain("Node 22.12+");
    expect(production).toContain("LOCAL_MEDIA_ROOT");
    expect(production).toContain("SuperPro server has **no Node.js installed**");
    expect(migration).toContain("verify-database-migration.mjs");
    expect(migration).toContain("write freeze");
    expect(migration).toContain("catalogue_products");
    expect(recovery).toContain("DNS / application rollback procedure");
    expect(recovery).toContain("MX/TXT email records");
  });
});
