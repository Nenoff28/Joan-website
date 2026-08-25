import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { registerStorageProxy } from "./_core/storageProxy";

const originalMediaRoot = process.env.LOCAL_MEDIA_ROOT;
const cleanupPaths: string[] = [];

afterEach(async () => {
  if (originalMediaRoot === undefined) delete process.env.LOCAL_MEDIA_ROOT;
  else process.env.LOCAL_MEDIA_ROOT = originalMediaRoot;
  await Promise.all(cleanupPaths.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe("local portable media serving", () => {
  it("serves local media at the existing manuscript-storage paths without managed credentials", async () => {
    const mediaRoot = await fs.mkdtemp(path.join(os.tmpdir(), "joan-local-media-"));
    cleanupPaths.push(mediaRoot);
    await fs.mkdir(path.join(mediaRoot, "products"), { recursive: true });
    await fs.writeFile(path.join(mediaRoot, "products", "sample.txt"), "independent local media");

    process.env.LOCAL_MEDIA_ROOT = mediaRoot;
    const app = express();
    registerStorageProxy(app);
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP server address");
      const response = await fetch(`http://127.0.0.1:${address.port}/manus-storage/products/sample.txt`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("independent local media");
      expect(response.headers.get("cache-control")).toContain("max-age");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });
});
