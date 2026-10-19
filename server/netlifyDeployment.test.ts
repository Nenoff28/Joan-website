import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Netlify deployment contract", () => {
  it("publishes the real Vite output and builds the serverless function", () => {
    const config = read("netlify.toml");
    const packageJson = JSON.parse(read("package.json")) as { scripts: { build: string } };
    expect(config).toContain('command = "pnpm run build"');
    expect(config).toContain('publish = "dist/public"');
    expect(config).toContain('functions = "netlify/functions"');
    expect(config).toContain('included_files = ["dist/public/**", "dist/server-ssr/**"]');
    expect(packageJson.scripts.build).toContain("vite build --config vite.config.ssr.ts");
    expect(packageJson.scripts.build).toContain("esbuild server/index.ts");
  });

  it("keeps the same-origin API, storage, SSR and static routes on Express", () => {
    const config = read("netlify.toml");
    const functionSource = read("netlify/functions/server.ts");
    const appSource = read("server/_core/index.ts");
    expect(config).toContain('from = "/api/*"');
    expect(config).toContain('from = "/manus-storage/*"');
    expect(config).toContain('to = "/.netlify/functions/server/:splat"');
    expect(functionSource).toContain("createProductionApp");
    expect(functionSource).toContain("serverless(app, { basePath:");
    expect(functionSource).toContain('basePath: "/.netlify/functions/server"');
    expect(appSource).toContain('app.use("/api/trpc"');
    expect(appSource).toContain("registerStorageProxy(app)");
    expect(appSource).toContain("serveStatic(app)");
  });

  it("does not turn managed media or database content into fake static data", () => {
    const storageSource = read("server/_core/storageProxy.ts");
    const envSource = read("server/_core/env.ts");
    const dbSource = read("server/db.ts");
    expect(envSource).toContain("BUILT_IN_FORGE_API_KEY");
    expect(storageSource).toContain("ENV.forgeApiKey");
    expect(storageSource).toContain("LOCAL_MEDIA_ROOT");
    expect(dbSource).toContain("DATABASE_URL");
    expect(read("server/catalogueService.ts")).toContain("getPublicSitemapEntries");
  });
});
