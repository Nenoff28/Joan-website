import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const termsSource = readSource("client/src/pages/Terms.tsx");
const returnsSource = readSource("client/src/pages/Returns.tsx");
const aboutSource = readSource("client/src/pages/About.tsx");
const accountSource = readSource("client/src/pages/CustomerAccount.tsx");
const fallbackProductSource = readSource("client/src/lib/storeData.ts");

describe("public former-site reference cleanup", () => {
  it("does not retain outgoing routes to the former Joan website in legal and returns content", () => {
    expect(termsSource).not.toContain("https://joan.bg/");
    expect(returnsSource).not.toContain("https://joan.bg/");
    expect(termsSource).not.toContain("originalTermsUrl");
    expect(returnsSource).not.toContain("originalTermsUrl");
  });

  it("keeps public copy focused on the current Joan website rather than a former or original site", () => {
    expect(termsSource).not.toMatch(/original terms|оригиналните условия|оригиналната публикация/i);
    expect(returnsSource).not.toMatch(/original site|оригиналният сайт|оригиналните условия|редизайн/i);
    expect(aboutSource).not.toMatch(/original about page|оригиналната страница|оригиналния сайт|original photo/i);
    expect(accountSource).not.toMatch(/former website|стария сайт|after migration|след прехвърлянето/i);
    expect(fallbackProductSource).not.toMatch(/оригиналния каталог|тестова версия/i);
  });
});
