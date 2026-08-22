import { describe, expect, it } from "vitest";
import { previewLegacyOrders } from "./legacyOrders";

function csvData(rows: string[]) {
  return `data:text/csv;base64,${Buffer.from(rows.join("\n"), "utf8").toString("base64")}`;
}

describe("legacy historical order migration guards", () => {
  it("groups repeated line rows into one historical order and preserves aggregate-only preview data", () => {
    const input = csvData([
      "order_id,customer_id,email,store_name,order_status,currency_code,currency_value,total,total_in_order_currency,date_added,date_modified,product_id,product_name,product_model,product_quantity,product_price,product_total,product_tax",
      "12,7,customer@example.test,Joan,Изпратена,BGN,1,45.00,45.00,2026-01-05 10:00:00,2026-01-05 12:00:00,101,Example drill,DR-1,1,25.00,25.00,0",
      "12,7,customer@example.test,Joan,Изпратена,BGN,1,45.00,45.00,2026-01-05 10:00:00,2026-01-05 12:00:00,102,Example bit,BIT-1,2,10.00,20.00,0",
    ]);

    const preview = previewLegacyOrders(input);

    expect(preview).toMatchObject({ csvRows: 2, uniqueOrders: 1, orderLineCount: 2, uniqueSourceCustomerIds: 1, rowsWithoutSourceCustomerId: 0, rowsWithoutProductId: 0, malformedRows: 0, currencyCounts: { BGN: 2 } });
    expect(JSON.stringify(preview)).not.toContain("customer@example.test");
  });

  it("flags malformed rows instead of silently importing them", () => {
    const input = csvData([
      "order_id,customer_id,email,order_status,currency_code,currency_value,total,date_added,product_id,product_name,product_quantity,product_price,product_total",
      "not-a-number,7,customer@example.test,Изпратена,BGN,1,45.00,2026-01-05 10:00:00,101,Example drill,1,45.00,45.00",
    ]);

    const preview = previewLegacyOrders(input);

    expect(preview.uniqueOrders).toBe(0);
    expect(preview.malformedRows).toBe(1);
  });
});
