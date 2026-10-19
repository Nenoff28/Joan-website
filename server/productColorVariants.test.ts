import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { derivePaintVariantGroup, paintVariantLabel } from "./catalogueService";

const productPage = readFileSync(resolve(process.cwd(), "client/src/pages/Product.tsx"), "utf8");
const stylesheet = readFileSync(resolve(process.cwd(), "client/src/pages/productColorVariants.css"), "utf8");

const casaBella = (name: string, brand = "Casa Bella", categoryName = "Бои, Лакове, Мазилки") => derivePaintVariantGroup({ name, brand, categoryName });

describe("paint color variants", () => {
  it("groups same-brand and same-product paint colors across different sizes", () => {
    const white = casaBella("Боя Каса Белла САТЕН бяла 0,650мл.");
    expect(white).toBeTruthy();
    expect(casaBella("Боя Каса Белла САТЕН вишнева 0,650мл.")).toBe(white);
    expect(casaBella("Боя Каса Белла САТЕН черна 0,650мл.")).toBe(white);
    expect(casaBella("Боя Каса Белла САТЕН бяла 1л.")).toBe(white);
    expect(casaBella("Боя Каса Белла САТЕН бяла 2,5л.")).toBe(white);
  });

  it("does not merge another model, brand or non-paint product", () => {
    const base = casaBella("Боя Каса Белла САТЕН бяла 0,650мл.");
    expect(casaBella("Боя Каса Белла МАТ бяла 1л.")).not.toBe(base);
    expect(casaBella("Боя Каса Белла САТЕН бяла 0,650мл.", "ЛЕКО")).not.toBe(base);
    expect(derivePaintVariantGroup({ name: "Тениска синя 0,650мл.", brand: "Casa Bella", categoryName: "Работно облекло" })).toBeNull();
  });

  it("recognizes variants from different paint manufacturers", () => {
    const protecta = derivePaintVariantGroup({ name: "Боя Протекта 3 в 1 сребриста 0,500мл.", brand: "Protecta", categoryName: "Бои, Лакове, Мазилки" });
    expect(protecta).toBe(derivePaintVariantGroup({ name: "Боя Протекта 3 в 1 старо злато 0,500мл.", brand: "Protecta", categoryName: "Бои, Лакове, Мазилки" }));

    const kittfort = derivePaintVariantGroup({ name: "Латекс CL 01 КРЕМ 1,5кг.", brand: "Kittfort", categoryName: "Бои, Лакове, Мазилки" });
    expect(kittfort).toBe(derivePaintVariantGroup({ name: "Латекс CL 02 ВАНИЛИЯ 1,5кг.", brand: "Kittfort", categoryName: "Бои, Лакове, Мазилки" }));

    const dupliColor = derivePaintVariantGroup({ name: "Спрей VERY WELL 9005 черен гланц 400мл.", brand: "Dupli-Color", categoryName: "Бои, Лакове, Мазилки" });
    expect(dupliColor).toBe(derivePaintVariantGroup({ name: "Спрей VERY WELL 9010 бял гланц 400мл.", brand: "Dupli-Color", categoryName: "Бои, Лакове, Мазилки" }));
  });

  it("prefers the descriptive color over a RAL code in the visible label", () => {
    expect(paintVariantLabel("Боя Мефисто RAL5015 синя 0,650мл. - Оргахим")).toBe("синя");
    expect(paintVariantLabel("Боя ЛЕКО RAL 9005 Черна 650мл.")).toBe("черна");
    expect(paintVariantLabel("Боя ЛЕКО RAL 9005 2,5л.")).toBe("ral 9005");
  });

  it("renders an accessible color menu and navigates to the selected slug", () => {
    expect(productPage).toContain("product-color-variants");
    expect(productPage).toContain('aria-haspopup="listbox"');
    expect(productPage).toContain('role="option"');
    expect(productPage).toContain('setLocation(`/product/${variant.slug}`)');
    expect(productPage).toContain("variant.sizeLabel");
    expect(productPage).toContain("variant.isOutOfStock");
    expect(stylesheet).toContain("product-color-picker-menu");
    expect(stylesheet).toContain("overflow-y: auto");
    expect(stylesheet).toContain("product-color-stock");
  });
});
