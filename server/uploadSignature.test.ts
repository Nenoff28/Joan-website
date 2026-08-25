import { describe, expect, it } from "vitest";
import { assertUploadSignature } from "./catalogueService";

describe("administrator upload signatures", () => {
  it("accepts matching file headers and rejects content disguised as an image", () => {
    expect(() => assertUploadSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")).not.toThrow();
    expect(() => assertUploadSignature(Buffer.from("%PDF-1.7"), "application/pdf")).not.toThrow();
    expect(() => assertUploadSignature(Buffer.from("<script>alert(1)</script>"), "image/png")).toThrow(/does not match/i);
  });
});
