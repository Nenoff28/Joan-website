import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { hashCustomerPassword, previewLegacyCustomerWorkbook, verifyCustomerPassword } from "./customerAccounts";

function buildLegacyWorkbookData(customers: Array<Record<string, unknown>>, addresses: Array<Record<string, unknown>>) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(customers), "Customers");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(addresses), "Addresses");
  return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${XLSX.write(workbook, { type: "base64", bookType: "xlsx" })}`;
}

describe("legacy customer migration guards", () => {
  it("uses a new salted password hash and never treats the legacy source as a password", () => {
    const hash = hashCustomerPassword("A secure new customer password 2026");
    expect(hash).toMatch(/^scrypt-v1\$/);
    expect(verifyCustomerPassword("A secure new customer password 2026", hash)).toBe(true);
    expect(verifyCustomerPassword("incorrect password", hash)).toBe(false);
  });

  it("summarizes valid customer and address rows without returning customer records", () => {
    const workbookData = buildLegacyWorkbookData([
      { customer_id: 7, firstname: "Sample", lastname: "Customer", email: "customer@example.test", telephone: "0888000000", newsletter: 1, status: 1, approved: 1 },
      { customer_id: 8, firstname: "Disabled", lastname: "Profile", email: "disabled@example.test", telephone: "", newsletter: 0, status: 0, approved: 0 },
    ], [
      { customer_id: 7, firstname: "Sample", lastname: "Customer", company: "", address_1: "Example 1", address_2: "", city: "Silistra", postcode: "7500", zone: "Silistra", country: "Bulgaria", default: 1 },
    ]);

    const preview = previewLegacyCustomerWorkbook(workbookData);

    expect(preview).toMatchObject({ customerCount: 2, addressCount: 1, activeAndApprovedCount: 1, disabledCount: 1, duplicateEmailCount: 0, missingRequiredFieldCount: 0 });
    expect(preview.headers.customers).toContain("customer_id");
    expect(preview.headers.addresses).toContain("address_1");
    expect(JSON.stringify(preview)).not.toContain("customer@example.test");
  });

  it("blocks customer workbooks that have duplicate emails or incomplete rows", () => {
    const workbookData = buildLegacyWorkbookData([
      { customer_id: 7, firstname: "Sample", lastname: "Customer", email: "same@example.test", status: 1, approved: 1 },
      { customer_id: 8, firstname: "Another", lastname: "Customer", email: "same@example.test", status: 1, approved: 1 },
      { customer_id: 9, firstname: "", lastname: "Missing", email: "missing@example.test", status: 1, approved: 1 },
    ], []);

    const preview = previewLegacyCustomerWorkbook(workbookData);

    expect(preview.duplicateEmailCount).toBe(1);
    expect(preview.missingRequiredFieldCount).toBe(1);
  });
});
