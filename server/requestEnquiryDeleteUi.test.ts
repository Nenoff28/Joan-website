import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const service = readFileSync(resolve(process.cwd(), "server/catalogueService.ts"), "utf8");
const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const orderDetail = readFileSync(resolve(process.cwd(), "client/src/pages/AdminOrderDetail.tsx"), "utf8");
const enquiryDetail = readFileSync(resolve(process.cwd(), "client/src/pages/AdminContactEnquiryDetail.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "client/src/pages/adminOrderDetail.css"), "utf8");

describe("request and enquiry deletion contract", () => {
  it("uses soft-delete and retains linked history/items", () => {
    expect(service).toContain("set({ isDeleted: true })");
    expect(service).toContain('action: "order.deleted"');
    expect(service).toContain('action: "contact_enquiry.deleted"');
    expect(service).toContain("orderRequests.isDeleted, false");
    expect(service).toContain("contactEnquiries.isDeleted, false");
    expect(service).toContain("Поръчката е изтрита и не може да се променя.");
    expect(service).toContain("Запитването е изтрито и не може да се променя.");
  });

  it("requires the existing write permissions and asks for confirmation in both detail pages", () => {
    expect(router).toContain('deleteOrder: permissionProcedure("orders.write")');
    expect(router).toContain('deleteContactEnquiry: permissionProcedure("enquiries.write")');
    for (const page of [orderDetail, enquiryDetail]) {
      expect(page).toContain("AlertDialog");
      expect(page).toContain("deleteOpen");
      expect(page).toContain("canWrite &&");
      expect(page).toContain("Изтрий");
      expect(page).toContain("Историята");
      expect(page).toContain("setLocation");
    }
    expect(styles).toContain(".ord-delete-button");
  });
});
