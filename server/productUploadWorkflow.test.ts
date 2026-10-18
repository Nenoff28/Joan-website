import { beforeEach, describe, expect, it, vi } from "vitest";

const { storagePutMock, getDbMock } = vi.hoisted(() => ({
  storagePutMock: vi.fn(),
  getDbMock: vi.fn(),
}));

vi.mock("./storage", () => ({
  storagePut: storagePutMock,
}));

vi.mock("./db", () => ({
  getDb: getDbMock,
}));

import { uploadProductImage } from "./catalogueService";

const PNG_BYTES = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const pngDataUrl = (bytes: Buffer = PNG_BYTES) => `data:image/png;base64,${bytes.toString("base64")}`;

function successfulAuditDb() {
  return {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([]),
    })),
  };
}

describe("uploadProductImage backend workflow boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDbMock.mockResolvedValue(successfulAuditDb());
    let sequence = 0;
    storagePutMock.mockImplementation(async (requestedKey: string) => {
      sequence += 1;
      const key = `${requestedKey.replace(/\.png$/i, "")}_${sequence}.png`;
      return { key, url: `/manus-storage/${key}` };
    });
  });

  it("rejects a data URL whose bytes do not match the declared PNG signature", async () => {
    await expect(
      uploadProductImage(
        { dataUrl: `data:image/png;base64,${Buffer.from("not-a-png").toString("base64")}`, fileName: "rejected.png" },
        17,
      ),
    ).rejects.toThrow(/content does not match/i);
    expect(storagePutMock).not.toHaveBeenCalled();
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("rejects image payloads larger than the 10 MB limit before storage", async () => {
    const overLimitBytes = Buffer.alloc(10 * 1024 * 1024 + 1, 0);
    await expect(
      uploadProductImage({ dataUrl: pngDataUrl(overLimitBytes), fileName: "too-large.png" }, 17),
    ).rejects.toThrow(/between 1 byte and 10 MB/i);
    expect(storagePutMock).not.toHaveBeenCalled();
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("passes the same requested filename to mocked storage while storage handles unique keys", async () => {
    const first = await uploadProductImage({ dataUrl: pngDataUrl(), fileName: "same filename.png" }, 17);
    const second = await uploadProductImage({ dataUrl: pngDataUrl(), fileName: "same filename.png" }, 17);

    expect(storagePutMock).toHaveBeenNthCalledWith(1, "catalogue/admin/same-filename-png.png", PNG_BYTES, "image/png");
    expect(storagePutMock).toHaveBeenNthCalledWith(2, "catalogue/admin/same-filename-png.png", PNG_BYTES, "image/png");
    expect(first.key).not.toBe(second.key);
    expect(first.url).toMatch(/^\/manus-storage\//);
    expect(second.url).toMatch(/^\/manus-storage\//);
  });

  it("surfaces audit failure after storage succeeds without attempting another write", async () => {
    const auditError = new Error("simulated audit persistence failure");
    const insertMock = vi.fn(() => ({ values: vi.fn().mockRejectedValue(auditError) }));
    getDbMock.mockResolvedValueOnce({ insert: insertMock });

    await expect(
      uploadProductImage({ dataUrl: pngDataUrl(), fileName: "audit-review.png" }, 17),
    ).rejects.toThrow("simulated audit persistence failure");
    expect(storagePutMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});
