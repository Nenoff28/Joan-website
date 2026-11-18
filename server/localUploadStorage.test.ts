import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { publicMediaUrl } from "../client/src/lib/media";

// Admin uploads (product/category images, brochures) only worked with Manus Forge storage.
// Without Forge they must be written to the local media folder and served unchanged from /media/.
describe("storagePut without Manus Forge storage", () => {
  const saved = { url: process.env.BUILT_IN_FORGE_API_URL, key: process.env.BUILT_IN_FORGE_API_KEY, dir: process.env.LOCAL_UPLOAD_DIR };
  let dir = "";
  afterEach(() => {
    process.env.BUILT_IN_FORGE_API_URL = saved.url ?? "";
    process.env.BUILT_IN_FORGE_API_KEY = saved.key ?? "";
    if (saved.dir === undefined) delete process.env.LOCAL_UPLOAD_DIR; else process.env.LOCAL_UPLOAD_DIR = saved.dir;
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("writes the file under uploads/ and returns a /manus-storage URL that maps to the same file", async () => {
    dir = mkdtempSync(join(tmpdir(), "joan-upload-"));
    process.env.BUILT_IN_FORGE_API_URL = "";
    process.env.BUILT_IN_FORGE_API_KEY = "";
    process.env.LOCAL_UPLOAD_DIR = dir;
    const { storagePut } = await import("./storage");
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const stored = await storagePut("catalogue/admin/test-image.png", bytes, "image/png");
    expect(stored.url).toMatch(/^\/manus-storage\/uploads\/catalogue\/admin\/test-image_[0-9a-f]{8}\.png$/);
    expect(publicMediaUrl(stored.url)).toBe(stored.url.replace("/manus-storage/", "/media/"));
    const file = join(dir, stored.key);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file)).toEqual(bytes);
  });

  it("refuses keys that escape the upload folder", async () => {
    dir = mkdtempSync(join(tmpdir(), "joan-upload-"));
    process.env.BUILT_IN_FORGE_API_URL = "";
    process.env.BUILT_IN_FORGE_API_KEY = "";
    process.env.LOCAL_UPLOAD_DIR = dir;
    const { storagePut } = await import("./storage");
    await expect(storagePut("../../evil.png", Buffer.from("x"), "image/png")).rejects.toThrow();
  });
});
