import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const faqSource = readFileSync(resolve(process.cwd(), "client/src/pages/FAQ.tsx"), "utf8");
const returnsSource = readFileSync(resolve(process.cwd(), "client/src/pages/Returns.tsx"), "utf8");
const contactSource = readFileSync(resolve(process.cwd(), "client/src/pages/Contact.tsx"), "utf8");
const termsSource = readFileSync(resolve(process.cwd(), "client/src/pages/Terms.tsx"), "utf8");

describe("customer-support pages", () => {
  it("uses a dedicated FAQ route instead of leaving return FAQs embedded in the return process", () => {
    expect(appSource).toContain('<Route path={"/faq"} component={FAQ} />');
    expect(faqSource).toContain("Често задавани въпроси");
    expect(faqSource).toContain("Какво е входящ номер за връщане (RMA)?");
    expect(returnsSource).not.toContain("Какво е входящ номер за връщане (RMA)?");
  });

  it("submits contact enquiries through the validated tRPC workflow and provides a reference-number success state", () => {
    expect(contactSource).toContain("trpc.contact.createEnquiry.useMutation");
    expect(contactSource).toContain("referenceNumber");
    expect(contactSource).toContain("Запитването е изпратено успешно.");
    expect(contactSource).not.toContain("Формата е готова за интеграция");
  });

  it("presents owner-authorized original Joan terms as readable sections with a source link", () => {
    expect(termsSource).toContain("https://joan.bg/index.php?route=information/information/agree&information_id=5");
    expect(termsSource).toContain("Право на отказ и гаранция");
    expect(termsSource).toContain("Лични данни и бисквитки");
    expect(termsSource).toContain("Пълна оригинална версия");
  });
});
