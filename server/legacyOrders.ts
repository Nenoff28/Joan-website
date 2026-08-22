import { eq, inArray } from "drizzle-orm";
import * as XLSX from "xlsx";
import { customerProfiles, legacyCustomerOrderLines, legacyCustomerOrders } from "../drizzle/schema";
import { getDb } from "./db";

const MAX_LEGACY_ORDER_IMPORT_BYTES = 8 * 1024 * 1024;

type CsvRow = Record<string, unknown>;

type ImportedOrderLine = {
  legacyProductId: number | null;
  productName: string;
  productModel: string | null;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  lineTax: string | null;
};

type ImportedOrder = {
  legacyOrderId: number;
  legacyCustomerId: number | null;
  customerEmail: string | null;
  storeName: string | null;
  orderStatus: string;
  currencyCode: string;
  currencyValue: string;
  total: string;
  totalInOrderCurrency: string | null;
  orderedAt: Date;
  legacyModifiedAt: Date | null;
  lines: ImportedOrderLine[];
};

export type LegacyOrderImportPreview = {
  csvRows: number;
  uniqueOrders: number;
  orderLineCount: number;
  uniqueSourceCustomerIds: number;
  rowsWithoutSourceCustomerId: number;
  rowsWithoutProductId: number;
  malformedRows: number;
  orderStatusCounts: Record<string, number>;
  currencyCounts: Record<string, number>;
};

function requiredDb() {
  return getDb().then((db) => {
    if (!db) throw new Error("Database connection is unavailable");
    return db;
  });
}

function text(value: unknown, maxLength = 512) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizedEmail(value: unknown) {
  const valueText = text(value, 320).toLocaleLowerCase("en-US");
  return valueText.includes("@") ? valueText : null;
}

function positiveInt(value: unknown) {
  const parsed = Number(text(value, 32));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function nonNegativeInt(value: unknown, fallback = 0) {
  const parsed = Number(text(value, 32));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function decimalValue(value: unknown, fallback = "0.00") {
  const raw = text(value, 64).replace(",", ".");
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : fallback;
}

function nullableDecimalValue(value: unknown) {
  const raw = text(value, 64);
  return raw ? decimalValue(raw) : null;
}

function utcDate(value: unknown) {
  const raw = text(value, 64);
  if (!raw || raw === "0000-00-00 00:00:00") return null;
  const date = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  return Number.isNaN(date.valueOf()) ? null : date;
}

function readCsvRows(base64: string): CsvRow[] {
  const encoded = base64.replace(/^data:[^;]+;base64,/, "");
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > MAX_LEGACY_ORDER_IMPORT_BYTES) throw new Error("Файлът с поръчки трябва да е между 1 байт и 8 MB.");
  const workbook = XLSX.read(bytes, { type: "buffer", raw: false, codepage: 65001, cellFormula: false, cellHTML: false, cellText: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
  if (!firstSheet) throw new Error("CSV файлът с поръчки няма разпознаваем работен лист.");
  return XLSX.utils.sheet_to_json<CsvRow>(firstSheet, { defval: "", raw: false });
}

function collectLegacyOrders(base64: string) {
  const rows = readCsvRows(base64);
  const orderByLegacyId = new Map<number, ImportedOrder>();
  const statuses = new Map<string, number>();
  const currencies = new Map<string, number>();
  const customerIds = new Set<number>();
  let rowsWithoutSourceCustomerId = 0;
  let rowsWithoutProductId = 0;
  let malformedRows = 0;

  for (const row of rows) {
    const legacyOrderId = positiveInt(row.order_id);
    const legacyProductId = positiveInt(row.product_id);
    const orderedAt = utcDate(row.date_added);
    if (!legacyProductId) rowsWithoutProductId += 1;
    if (!legacyOrderId || !legacyProductId || !orderedAt) {
      malformedRows += 1;
      continue;
    }
    const legacyCustomerId = positiveInt(row.customer_id);
    if (legacyCustomerId) customerIds.add(legacyCustomerId);
    else rowsWithoutSourceCustomerId += 1;
    const status = text(row.order_status, 160) || "Неуточнен статус";
    const currencyCode = text(row.currency_code, 8).toUpperCase() || "BGN";
    statuses.set(status, (statuses.get(status) ?? 0) + 1);
    currencies.set(currencyCode, (currencies.get(currencyCode) ?? 0) + 1);

    let order = orderByLegacyId.get(legacyOrderId);
    if (!order) {
      order = {
        legacyOrderId,
        legacyCustomerId,
        customerEmail: normalizedEmail(row.email),
        storeName: text(row.store_name, 255) || null,
        orderStatus: status,
        currencyCode,
        currencyValue: decimalValue(row.currency_value, "1.00000000"),
        total: decimalValue(row.total),
        totalInOrderCurrency: nullableDecimalValue(row.total_in_order_currency),
        orderedAt,
        legacyModifiedAt: utcDate(row.date_modified),
        lines: [],
      };
      orderByLegacyId.set(legacyOrderId, order);
    }
    order.lines.push({
      legacyProductId,
      productName: text(row.product_name, 500) || "Артикул от историческа поръчка",
      productModel: text(row.product_model, 160) || null,
      quantity: Math.max(1, nonNegativeInt(row.product_quantity, 1)),
      unitPrice: decimalValue(row.product_price),
      lineTotal: decimalValue(row.product_total),
      lineTax: nullableDecimalValue(row.product_tax),
    });
  }

  const preview: LegacyOrderImportPreview = {
    csvRows: rows.length,
    uniqueOrders: orderByLegacyId.size,
    orderLineCount: Array.from(orderByLegacyId.values()).reduce((total, order) => total + order.lines.length, 0),
    uniqueSourceCustomerIds: customerIds.size,
    rowsWithoutSourceCustomerId,
    rowsWithoutProductId,
    malformedRows,
    orderStatusCounts: Object.fromEntries(statuses),
    currencyCounts: Object.fromEntries(currencies),
  };
  return { orders: Array.from(orderByLegacyId.values()), preview };
}

export function previewLegacyOrders(base64: string) {
  return collectLegacyOrders(base64).preview;
}

export async function importLegacyOrders(base64: string) {
  const { orders, preview } = collectLegacyOrders(base64);
  if (!orders.length || preview.malformedRows) throw new Error("Файлът с поръчки има невалидни редове и не може да бъде импортиран.");
  const db = await requiredDb();
  const profiles = await db.select({ id: customerProfiles.id, legacyCustomerId: customerProfiles.legacyCustomerId, email: customerProfiles.email }).from(customerProfiles);
  if (!profiles.length) throw new Error("Първо импортирайте и проверете клиентските профили, преди да прехвърлите историческите поръчки.");
  const profileByLegacyId = new Map(profiles.map((profile) => [profile.legacyCustomerId, profile.id]));
  const profileByEmail = new Map(profiles.map((profile) => [profile.email.toLocaleLowerCase("en-US"), profile.id]));
  let linkedByLegacyCustomerId = 0;
  let linkedByEmail = 0;
  let unlinkedGuestOrRemoved = 0;
  let importedOrders = 0;
  let importedOrderLines = 0;

  await db.transaction(async (tx) => {
    for (const order of orders) {
      const customerIdByLegacy = order.legacyCustomerId ? profileByLegacyId.get(order.legacyCustomerId) : undefined;
      const customerIdByEmail = !customerIdByLegacy && order.customerEmail ? profileByEmail.get(order.customerEmail) : undefined;
      const customerId = customerIdByLegacy ?? customerIdByEmail ?? null;
      if (customerIdByLegacy) linkedByLegacyCustomerId += 1;
      else if (customerIdByEmail) linkedByEmail += 1;
      else unlinkedGuestOrRemoved += 1;

      const [existing] = await tx.select().from(legacyCustomerOrders).where(eq(legacyCustomerOrders.legacyOrderId, order.legacyOrderId)).limit(1);
      let orderRecordId: number;
      const header = { legacyOrderId: order.legacyOrderId, customerId, legacyCustomerId: order.legacyCustomerId, storeName: order.storeName, orderStatus: order.orderStatus, currencyCode: order.currencyCode, currencyValue: order.currencyValue, total: order.total, totalInOrderCurrency: order.totalInOrderCurrency, orderedAt: order.orderedAt, legacyModifiedAt: order.legacyModifiedAt };
      if (existing) {
        await tx.update(legacyCustomerOrders).set(header).where(eq(legacyCustomerOrders.id, existing.id));
        await tx.delete(legacyCustomerOrderLines).where(eq(legacyCustomerOrderLines.legacyOrderRecordId, existing.id));
        orderRecordId = existing.id;
      } else {
        const result = await tx.insert(legacyCustomerOrders).values(header);
        orderRecordId = Number(result[0].insertId);
        importedOrders += 1;
      }
      for (let linePosition = 0; linePosition < order.lines.length; linePosition += 1) {
        const line = order.lines[linePosition];
        await tx.insert(legacyCustomerOrderLines).values({ legacyOrderRecordId: orderRecordId, legacyProductId: line.legacyProductId, linePosition, productName: line.productName, productModel: line.productModel, quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: line.lineTotal, lineTax: line.lineTax });
        importedOrderLines += 1;
      }
    }
  });
  return { importedOrders, importedOrderLines, linkedByLegacyCustomerId, linkedByEmail, unlinkedGuestOrRemoved, preview };
}

export async function getHistoricalOrdersForCustomer(customerId: number) {
  const db = await requiredDb();
  const orders = await db.select().from(legacyCustomerOrders).where(eq(legacyCustomerOrders.customerId, customerId)).orderBy(legacyCustomerOrders.orderedAt);
  if (!orders.length) return [];
  const lines = await db.select().from(legacyCustomerOrderLines).where(inArray(legacyCustomerOrderLines.legacyOrderRecordId, orders.map((order) => order.id)));
  return orders.map((order) => ({ legacyOrderId: order.legacyOrderId, orderStatus: order.orderStatus, currencyCode: order.currencyCode, total: order.total, totalInOrderCurrency: order.totalInOrderCurrency, orderedAt: order.orderedAt, lines: lines.filter((line) => line.legacyOrderRecordId === order.id).map((line) => ({ productName: line.productName, productModel: line.productModel, quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: line.lineTotal })) }));
}
