import { describe, expect, it } from "vitest";
import { alignInternalCodeFeatures, alignInternalCodeTechnicalSpecs, splitProductDescription } from "./technicalSpecifications";

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

  it("removes model rows from the public technical table", () => {
    expect(alignInternalCodeTechnicalSpecs([
      { label: "Модел", value: "33037" },
      { label: "Размер", value: "M" },
    ], "12829")).toEqual([{ label: "Размер", value: "M" }]);
  });

  it("removes internal code rows from the public technical table", () => {
    expect(alignInternalCodeTechnicalSpecs([{ label: "Вътрешен код", value: "12829" }], "12829")).toEqual([]);
  });

  it("publishes admin technical rows serialized with an em dash", () => {
    const result = splitProductDescription("Описание на продукта", ["Височина — 190 см", "Материал — Неръждаема стомана"]);
    expect(result.description).toBe("Описание на продукта");
    expect(result.technicalSpecs).toEqual([
      { label: "Височина", value: "190 см" },
      { label: "Материал", value: "Неръждаема стомана" },
    ]);
  });

  it("splits serialized multiline features and removes model rows", () => {
    expect(alignInternalCodeFeatures(["Монтаж: Вертикален\\nНоминален обем: 80 л\\nМодел: 33037", "Размер: M"], "12829")).toEqual(["Монтаж: Вертикален", "Номинален обем: 80 л", "Размер: M"]);
  });

  it("splits legacy inline technical pairs for the public product page", () => {
    const features = alignInternalCodeFeatures(["Номинален обем: 80 л Номинална мощност: 2 kW Водосъдържател: Емайлиран Монтаж: Вертикален Размери: 462 x 835 mm"], "12829");
    expect(splitProductDescription("", features).technicalSpecs).toEqual([
      { label: "Номинален обем", value: "80 л" },
      { label: "Номинална мощност", value: "2 kW" },
      { label: "Водосъдържател", value: "Емайлиран" },
      { label: "Монтаж", value: "Вертикален" },
      { label: "Размери", value: "462 x 835 mm" },
    ]);
  });

  it("keeps every Tesy legacy parameter separate after generation and publish", () => {
    const source = "Номинална вместимост: 80л Номинална мощност: 3 kW Максимално количество вода с комфортна температура от 40°С: 177л Време за загряване от 15°С до 65°С: 1час 33мин Номинално напрежение: 230V-50Hz Номинално налягане [MPa]: 0.8 Вид водосъдържател: Стъклокерамично покритие Функции: Устройство против замръзване Ел. Ключ Терморегулатор Магнезиев аноден протектор Възвратно-предпазен клапан Влагоустойчив електрически ключ Монтаж: Вертикален Размери:79 x 44 x 46 см Тегло:22 кг";
    const specs = splitProductDescription("", alignInternalCodeFeatures([source], "118909")).technicalSpecs;
    expect(specs).toEqual([
      { label: "Номинална вместимост", value: "80 л" },
      { label: "Номинална мощност", value: "3 kW" },
      { label: "Максимално количество вода с комфортна температура от 40°С", value: "177 л" },
      { label: "Време за загряване от 15°С до 65°С", value: "1 час 33 мин" },
      { label: "Номинално напрежение", value: "230 V-50 Hz" },
      { label: "Номинално налягане [MPa]", value: "0.8" },
      { label: "Вид водосъдържател", value: "Стъклокерамично покритие" },
      { label: "Функции", value: "Устройство против замръзване Ел. Ключ Терморегулатор Магнезиев аноден протектор Възвратно-предпазен клапан Влагоустойчив електрически ключ" },
      { label: "Монтаж", value: "Вертикален" },
      { label: "Размери", value: "79 x 44 x 46 см" },
      { label: "Тегло", value: "22 кг" },
    ]);
  });
});
