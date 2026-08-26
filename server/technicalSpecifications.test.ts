import { describe, expect, it } from "vitest";
import { splitProductDescription } from "./technicalSpecifications";

describe("splitProductDescription", () => {
  it("moves labelled bullet specifications into technical data and preserves prose", () => {
    const result = splitProductDescription("• Размер: 231 мм\n• Цвят: бял\n\nПодходящ за вътрешна употреба.", ["Модел: 18096"]);
    expect(result.description).toBe("Подходящ за вътрешна употреба.");
    expect(result.technicalSpecs).toEqual([{ label: "Размер", value: "231 мм" }, { label: "Цвят", value: "бял" }, { label: "Модел", value: "18096" }]);
  });

  it("extracts a named inline technical block without altering the source prose", () => {
    const result = splitProductDescription("Помощник за моравата. Технически данни: Номинална мощност (W): 1300 Работна ширина (mm): 320", []);
    expect(result.description).toBe("Помощник за моравата.");
    expect(result.technicalSpecs).toEqual([{ label: "Номинална мощност (W)", value: "1300" }, { label: "Работна ширина (mm)", value: "320" }]);
  });

  it("leaves unlabelled description copy intact", () => {
    const result = splitProductDescription("Качествен продукт за ежедневна употреба.", ["Модел: 42"]);
    expect(result.description).toBe("Качествен продукт за ежедневна употреба.");
    expect(result.technicalSpecs).toEqual([{ label: "Модел", value: "42" }]);
  });

  it("does not duplicate an all-specification description as product prose", () => {
    const result = splitProductDescription("• Обем: 280 мл\n• Употреба: закрито\n• 280 мл", []);
    expect(result.description).toBe("");
    expect(result.technicalSpecs).toEqual([{ label: "Обем", value: "280 мл" }, { label: "Употреба", value: "закрито" }]);
  });

  it("preserves a packaging value after an additional-information heading", () => {
    const result = splitProductDescription("Свързващ грунд.\n\nДопълнителна информация: Туба 5 кг\n\nПокриваемост м2: 2", []);
    expect(result.description).toBe("Свързващ грунд.");
    expect(result.technicalSpecs).toEqual([{ label: "Опаковка", value: "Туба 5 кг" }, { label: "Покриваемост м2", value: "2" }]);
  });

  it("moves short unlabelled bullet characteristics into technical data", () => {
    const result = splitProductDescription("• Може да се боядисва\n• Употреба на закрито", []);
    expect(result.description).toBe("");
    expect(result.technicalSpecs).toEqual([{ label: "Характеристика", value: "Може да се боядисва" }, { label: "Характеристика", value: "Употреба на закрито" }]);
  });
});
