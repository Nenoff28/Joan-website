import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const deliverySource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Delivery.tsx"),
  "utf8"
);
const cssSource = readFileSync(
  resolve(process.cwd(), "client/src/index.css"),
  "utf8"
);

describe("delivery page customer-facing copy", () => {
  it("uses direct first-person wording throughout the delivery guidance", () => {
    expect(deliverySource).toContain(
      "Подредили сме информацията за доставката"
    );
    expect(deliverySource).toContain("Как организираме доставката");
    expect(deliverySource).toContain("Когато направите поръчка до 16:00");
    expect(deliverySource).toContain("При поръчка след 16:00 изпращаме");
    expect(deliverySource).toContain(
      "Моля, имайте предвид, че сроковете могат да се променят"
    );
    expect(deliverySource).not.toContain("Публикуваните условия на Жоан");
    expect(deliverySource).not.toContain("Какво посочва Жоан");
    expect(deliverySource).not.toContain("Жоан посочва");
  });

  it("removes decorative 01, 02 and 03 labels from delivery boxes", () => {
    expect(deliverySource).not.toContain("<span>01</span>");
    expect(deliverySource).not.toContain("<span>02</span>");
    expect(deliverySource).not.toContain("<span>03</span>");
    expect(cssSource).not.toContain(".timeline-card > span");
  });
});
