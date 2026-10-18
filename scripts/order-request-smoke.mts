import { chromium } from "playwright";
import { getDb } from "/home/ubuntu/joan-bg-redesign/server/db";
import { getAdminOrders } from "/home/ubuntu/joan-bg-redesign/server/catalogueService";
import { orderRequestItems, orderRequests } from "/home/ubuntu/joan-bg-redesign/drizzle/schema";
import { eq } from "drizzle-orm";

const marker = `QA Browser Request ${Date.now()}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const apiResponses: Array<{ status: number; body: string }> = [];
page.on("response", async response => {
  if (response.url().includes("/api/trpc/catalogue.createOrderRequest")) {
    apiResponses.push({ status: response.status(), body: await response.text().catch(() => "") });
  }
});
let requestId: number | undefined;
try {
  await page.goto("http://localhost:3000/checkout?product=rakavitsi-bi-colour&qty=1", { waitUntil: "networkidle" });
  await page.getByLabel("Име и фамилия").fill(marker);
  await page.getByLabel("Email").fill("qa-browser-request@example.com");
  await page.getByLabel("Телефон").fill("0888123456");
  await page.getByLabel("Адрес").fill("ул. QA 12");
  await page.getByRole("combobox").nth(0).fill("Силистра");
  await page.getByRole("option", { name: "Силистра", exact: true }).click();
  await page.getByRole("combobox").nth(1).fill("Силистра");
  await page.getByRole("option", { name: "гр. Силистра", exact: true }).click();
  await page.getByLabel("Пощенски код").fill("7500");
  await page.getByLabel(/Разбирам, че тази заявка|Разбирам, че това е заявка/).check();
  await page.getByRole("button", { name: "Изпрати заявката" }).click();
  await page.waitForSelector(".checkout-success", { timeout: 10000 });
  const successText = await page.locator(".checkout-success").innerText();
  const db = await getDb();
  const created = await db!.select({ id: orderRequests.id, requestNumber: orderRequests.requestNumber, status: orderRequests.status }).from(orderRequests).where(eq(orderRequests.fullName, marker));
  requestId = created[0]?.id;
  const adminRows = await getAdminOrders();
  const adminRow = adminRows.find((row: any) => row.fullName === marker);
  if (!created.length || !adminRow || !adminRow.items?.length) throw new Error(`Admin visibility failed: ${JSON.stringify({ created, adminRow })}`);
  console.log(JSON.stringify({ ok: true, successText, apiResponses, created, admin: { id: adminRow.id, requestNumber: adminRow.requestNumber, itemCount: adminRow.items.length, status: adminRow.status }, exactCleanup: false }, null, 2));
} finally {
  const db = await getDb();
  const rows = await db!.select({ id: orderRequests.id }).from(orderRequests).where(eq(orderRequests.fullName, marker));
  for (const row of rows) {
    await db!.delete(orderRequestItems).where(eq(orderRequestItems.orderRequestId, row.id));
    await db!.delete(orderRequests).where(eq(orderRequests.id, row.id));
  }
  console.log(JSON.stringify({ cleanup: rows.map(row => row.id) }));
  await browser.close();
}
