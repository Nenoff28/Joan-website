import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("contact enquiry history", () => {
  it("defines a separate immutable history table and backfills existing admin notes", () => {
    const schema = fs.readFileSync(path.resolve(import.meta.dirname, "../drizzle/schema.ts"), "utf8");
    const migration = fs.readFileSync(path.resolve(import.meta.dirname, "../drizzle/0020_thankful_shen.sql"), "utf8");
    const service = fs.readFileSync(path.resolve(import.meta.dirname, "./catalogueService.ts"), "utf8");
    expect(schema).toContain('export const contactEnquiryHistory = mysqlTable("contact_enquiry_history"');
    expect(schema).toContain("contactEnquiryId: int(\"contactEnquiryId\").notNull().references(() => contactEnquiries.id)");
    expect(migration).toContain("INSERT INTO `contact_enquiry_history`");
    expect(migration).toContain("Системен импорт");
    expect(service).toContain("export async function getAdminContactEnquiryDetail");
    expect(service).toContain("await tx.insert(contactEnquiryHistory).values");
  });

  it("keeps the list navigable and protects the detail route with enquiries permissions", () => {
    const admin = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/Admin.tsx"), "utf8");
    const detail = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/AdminContactEnquiryDetail.tsx"), "utf8");
    const app = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/App.tsx"), "utf8");
    const router = fs.readFileSync(path.resolve(import.meta.dirname, "./routers.ts"), "utf8");
    expect(admin).toContain('href={`/admin/enquiries/${enquiry.id}`}');
    expect(detail).toContain('trpc.admin.contactEnquiryDetail.useQuery');
    expect(detail).toContain('permissions.includes("enquiries.read")');
    expect(detail).toContain('permissions.includes("enquiries.write")');
    expect(detail).toContain("История на статусите и коментарите");
    expect(app).toContain('path="/admin/enquiries/:id"');
    expect(router).toContain("contactEnquiryDetail: permissionProcedure(\"enquiries.read\")");
  });
});
