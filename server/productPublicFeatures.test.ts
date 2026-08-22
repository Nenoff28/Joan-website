import { describe, expect, it } from "vitest";
import { publicProductFeatures } from "./catalogueService";

describe("public product features", () => {
  it("excludes serialized legacy option payloads while retaining customer-facing characteristics", () => {
    expect(publicProductFeatures(JSON.stringify([
      "Размер: M–XXL",
      "radio:Размер:M:+0.0000:0:1:+0.00000000:1:",
      "Материал: Нитрил",
    ]))).toEqual(["Размер: M–XXL", "Материал: Нитрил"]);
  });
});
