import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import mysql from "mysql2/promise";
import XLSX from "xlsx";
import { parse } from "csv-parse/sync";

const ROOT = "/home/ubuntu/universal-export-audit";
const CUSTOMER_WORKBOOK = "/home/ubuntu/opencart-export-audit/kuni-export/customers-2026-08-22.xlsx";
const PRODUCT_CATEGORY_PATHS = "/home/ubuntu/universal-export-audit/product_category_paths.json";
const REPORT_PATH = "/home/ubuntu/universal-export-audit/import_execution_report.json";
const REQUIRED_SOURCES = ["product.csv", "category.csv", "manufacturer.csv", "order.csv"];

function cell(value, length = 65535) {
  return String(value ?? "").trim().slice(0, length);
}

function email(value) {
  const result = cell(value, 320).toLowerCase();
  return result.includes("@") ? result : null;
}

function positiveInt(value) {
  const parsed = Number(cell(value, 32));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function truthy(value) {
  return ["1", "true", "yes", "да"].includes(cell(value, 16).toLowerCase());
}

function decimal(value, fallback = "0.00", scale = 2) {
  const parsed = Number(cell(value, 64).replace(",", "."));
  return Number.isFinite(parsed) ? parsed.toFixed(scale) : fallback;
}

function date(value) {
  const raw = cell(value, 64);
  if (!raw || raw === "0000-00-00 00:00:00") return null;
  const parsed = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function slug(value, prefix) {
  const normalized = cell(value, 300).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${prefix}-${normalized || "record"}`.slice(0, 160).replace(/-+$/g, "");
}

function sourceImage(value) {
  const raw = cell(value, 4096);
  if (!raw) return "https://joan.bg/image/no_image.png";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://joan.bg/${raw.replace(/^\/+/, "")}`;
}

function isImageUrl(value) {
  const url = cell(value, 4096);
  return /^https?:\/\//i.test(url) && (/\/image\//i.test(url) || /\.(?:avif|gif|jpe?g|png|webp)(?:[?#]|$)/i.test(url));
}

function urls(value) {
  const raw = cell(value, 65535);
  if (!raw) return [];
  const matches = raw.match(/https?:\/\/[^\s|;]+/g);
  if (matches?.length) return [...new Set(matches.filter(isImageUrl))];
  return raw.split(/[|;]/).map(sourceImage).filter(isImageUrl);
}

function hashFile(filename) {
  return crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
}

function csvRows(filename) {
  const [headers, ...rows] = parse(fs.readFileSync(filename, "utf8"), { columns: false, bom: true, skip_empty_lines: true, relax_column_count: true, relax_quotes: true, trim: false });
  const normalizedHeaders = headers.map((header) => cell(header, 120));
  const isProductFile = path.basename(filename) === "product.csv";
  return rows.map((values) => {
    const record = Object.fromEntries(normalizedHeaders.map((header, index) => [header, values[index] ?? ""]));
    if (isProductFile) {
      const derivedCategory = values.find((value) => cell(value, 65535).includes(">"));
      if (derivedCategory) record.product_category = derivedCategory;
      if (!cell(record.name_bg, 500)) record.name_bg = record.name_en;
      if (!cell(record.description_bg, 65535)) record.description_bg = record.description_en;
      const imageValues = values.filter((value, index) => index > 11 && isImageUrl(value));
      if (imageValues.length && !cell(record.additional_images, 65535)) record.additional_images = imageValues.join("|");
    }
    return record;
  });
}

function xlsxRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Missing required customer workbook sheet: ${sheetName}`);
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
}

function firstProductCategory(value) {
  return cell(value, 65535).split("|").map((item) => item.trim()).filter(Boolean)[0] ?? "";
}

const topCategoryMap = new Map([
  ["Инструменти", "instrumenti"], ["Градина", "gradina"], ["За Дома", "za-doma"], ["Баня", "banya"], ["Осветление и Ел. материали", "osvetlenie"], ["Осветление и ел.материали", "osvetlenie"], ["Подови и Стенни покрития", "podovi-i-stenni-pokritiya"], ["В и К", "v-i-k"], ["ВиК", "v-i-k"], ["Врати, Обков, Крепежи", "vrati-obkov-krepezhi"], ["Бои, Лакове, Мазилки", "boi-lakove-mazilki"], ["Строителство", "stroitelstvo"], ["Работно облекло", "rabotno-obleklo"],
]);

function staticCategorySlug(rawPath) {
  const parts = rawPath.split(">").map((part) => part.trim()).filter(Boolean);
  const candidate = parts[0] === "Строителни Материали" ? parts[1] : parts[0];
  return topCategoryMap.get(candidate) ?? "stroitelstvo";
}

function toCategoryTree(row, childrenByParent) {
  const children = childrenByParent.get(String(row.category_id)) ?? [];
  return children.map((child) => ({ label: cell(child.name_bg, 255) || cell(child.name_en, 255) || `Категория ${child.category_id}`, ...(childrenByParent.has(String(child.category_id)) ? { children: toCategoryTree(child, childrenByParent) } : {}) }));
}

async function queryRows(connection, sql, values = []) {
  const [rows] = await connection.execute(sql, values);
  return rows;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is unavailable.");
  for (const filename of REQUIRED_SOURCES) {
    if (!fs.existsSync(path.join(ROOT, filename))) throw new Error(`Missing required source: ${filename}`);
  }
  if (!fs.existsSync(CUSTOMER_WORKBOOK)) throw new Error("Missing approved OpenCart customer workbook.");
  if (!fs.existsSync(PRODUCT_CATEGORY_PATHS)) throw new Error("Missing verified product-category sidecar.");

  const products = csvRows(path.join(ROOT, "product.csv"));
  const categories = csvRows(path.join(ROOT, "category.csv"));
  const manufacturers = csvRows(path.join(ROOT, "manufacturer.csv"));
  const orderRows = csvRows(path.join(ROOT, "order.csv"));
  const customerWorkbook = XLSX.readFile(CUSTOMER_WORKBOOK, { raw: false, cellFormula: false, cellHTML: false, cellText: true });
  const customerRows = xlsxRows(customerWorkbook, "Customers");
  const addressRows = xlsxRows(customerWorkbook, "Addresses");
  const productCategoryPaths = JSON.parse(fs.readFileSync(PRODUCT_CATEGORY_PATHS, "utf8"));

  if (products.length !== 10965 || categories.length !== 467 || manufacturers.length !== 195 || orderRows.length !== 1038 || customerRows.length !== 274 || Object.keys(productCategoryPaths).length !== 10965) {
    throw new Error(`Source preflight counts differ from the verified export package. No data was written: ${JSON.stringify({ products: products.length, categories: categories.length, manufacturers: manufacturers.length, orderRows: orderRows.length, customerRows: customerRows.length })}`);
  }
  if (process.env.PREFLIGHT_ONLY === "1") {
    console.log(JSON.stringify({ verified: true, products: products.length, categories: categories.length, manufacturers: manufacturers.length, orderRows: orderRows.length, customerRows: customerRows.length, addressRows: addressRows.length, productCategorySidecar: Object.keys(productCategoryPaths).length }, null, 2));
    return;
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const report = { startedAt: new Date().toISOString(), sourceSha256: Object.fromEntries([...REQUIRED_SOURCES.map((filename) => [filename, hashFile(path.join(ROOT, filename))]), ["customers-2026-08-22.xlsx", hashFile(CUSTOMER_WORKBOOK)]]), imported: {}, security: { excluded: ["legacy password hashes", "legacy salts", "legacy tokens", "customer IP addresses", "order payment addresses", "order payment methods", "order IP data", "order browser data", "legacy reviews"] } };

  try {
    await connection.beginTransaction();

    const staticRows = await queryRows(connection, "SELECT id, slug FROM catalogue_categories WHERE legacyCategoryId IS NULL");
    const staticCategoryId = new Map(staticRows.map((row) => [row.slug, row.id]));
    if (staticCategoryId.size < 11) throw new Error("The existing Joan top-level category foundation is incomplete.");

    const customerIdByLegacyId = new Map();
    const profileIdByEmail = new Map();
    let importedProfiles = 0;
    let importedAddresses = 0;
    for (const row of customerRows) {
      const legacyCustomerId = positiveInt(row.customer_id);
      const firstName = cell(row.firstname, 160);
      const lastName = cell(row.lastname, 160);
      const addressEmail = email(row.email);
      if (!legacyCustomerId || !firstName || !lastName || !addressEmail) throw new Error("The customer workbook contains an incomplete required profile row.");
      const [existing] = await queryRows(connection, "SELECT id, email, accountStatus FROM customer_profiles WHERE legacyCustomerId = ? LIMIT 1", [legacyCustomerId]);
      const targetStatus = truthy(row.approved) && truthy(row.status) ? "pending_activation" : "disabled";
      let profileId;
      if (existing) {
        if (String(existing.email).toLowerCase() !== addressEmail) throw new Error("A legacy customer ID maps to a different email address.");
        await connection.execute("UPDATE customer_profiles SET firstName=?, lastName=?, phone=?, newsletterSubscribed=?, legacyWasApproved=?, legacyWasActive=?, accountStatus=? WHERE id=?", [firstName, lastName, cell(row.telephone, 64) || null, truthy(row.newsletter), truthy(row.approved), truthy(row.status), existing.accountStatus === "active" ? "active" : targetStatus, existing.id]);
        profileId = existing.id;
      } else {
        const [sameEmail] = await queryRows(connection, "SELECT id FROM customer_profiles WHERE email = ? LIMIT 1", [addressEmail]);
        if (sameEmail) throw new Error("A legacy customer email is already associated with a different profile.");
        const [result] = await connection.execute("INSERT INTO customer_profiles (legacyCustomerId,email,firstName,lastName,phone,newsletterSubscribed,legacyWasApproved,legacyWasActive,accountStatus) VALUES (?,?,?,?,?,?,?,?,?)", [legacyCustomerId, addressEmail, firstName, lastName, cell(row.telephone, 64) || null, truthy(row.newsletter), truthy(row.approved), truthy(row.status), targetStatus]);
        profileId = result.insertId;
        await connection.execute("INSERT INTO customer_credentials (customerId,passwordHash,passwordSetAt,sessionVersion,failedLoginCount,lockedUntil) VALUES (?,NULL,NULL,1,0,NULL)", [profileId]);
        importedProfiles += 1;
      }
      customerIdByLegacyId.set(legacyCustomerId, profileId);
      profileIdByEmail.set(addressEmail, profileId);
    }
    for (const [legacyCustomerId, profileId] of customerIdByLegacyId) {
      await connection.execute("DELETE FROM customer_addresses WHERE customerId = ?", [profileId]);
      const matching = addressRows.filter((row) => positiveInt(row.customer_id) === legacyCustomerId);
      for (let position = 0; position < matching.length; position += 1) {
        const row = matching[position];
        const firstName = cell(row.firstname, 160);
        const lastName = cell(row.lastname, 160);
        const line1 = cell(row.address_1, 512);
        const city = cell(row.city, 160);
        if (!firstName || !lastName || !line1 || !city) continue;
        await connection.execute("INSERT INTO customer_addresses (customerId,legacyPosition,firstName,lastName,company,addressLine1,addressLine2,city,postcode,zone,country,isDefault) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", [profileId, position, firstName, lastName, cell(row.company, 255) || null, line1, cell(row.address_2, 512) || null, city, cell(row.postcode, 32) || null, cell(row.zone, 160) || null, cell(row.country, 160) || null, truthy(row.default)]);
        importedAddresses += 1;
      }
    }
    report.imported.customers = { profilesInserted: importedProfiles, addressRowsInserted: importedAddresses };

    const categoryIdByFullPath = new Map();
    const childrenByParent = new Map();
    for (const row of categories) {
      const parent = cell(row.parent_id, 32) || "0";
      const list = childrenByParent.get(parent) ?? [];
      list.push(row);
      childrenByParent.set(parent, list);
    }
    for (const row of categories) {
      const legacyCategoryId = positiveInt(row.category_id);
      if (!legacyCategoryId) throw new Error("The category export contains an invalid category ID.");
      const categoryName = cell(row.name_bg, 255) || cell(row.name_en, 255) || `Категория ${legacyCategoryId}`;
      const categorySlug = slug(categoryName, `legacy-${legacyCategoryId}`);
      const tree = toCategoryTree(row, childrenByParent);
      await connection.execute("INSERT INTO catalogue_categories (legacyCategoryId,legacyParentCategoryId,slug,name,description,imageUrl,icon,subcategoriesJson,legacySeoKeywordBg,legacySeoKeywordEn,legacyMetaTitleBg,legacyMetaTitleEn,legacyMetaDescriptionBg,legacyMetaDescriptionEn,legacyCanonicalUrl,legacyMetaRobots,sortOrder,isActive) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE legacyParentCategoryId=VALUES(legacyParentCategoryId), name=VALUES(name), description=VALUES(description), imageUrl=VALUES(imageUrl), subcategoriesJson=VALUES(subcategoriesJson), legacySeoKeywordBg=VALUES(legacySeoKeywordBg), legacySeoKeywordEn=VALUES(legacySeoKeywordEn), legacyMetaTitleBg=VALUES(legacyMetaTitleBg), legacyMetaTitleEn=VALUES(legacyMetaTitleEn), legacyMetaDescriptionBg=VALUES(legacyMetaDescriptionBg), legacyMetaDescriptionEn=VALUES(legacyMetaDescriptionEn), legacyCanonicalUrl=VALUES(legacyCanonicalUrl), legacyMetaRobots=VALUES(legacyMetaRobots), sortOrder=VALUES(sortOrder), isActive=VALUES(isActive)", [legacyCategoryId, positiveInt(row.parent_id), categorySlug, categoryName, cell(row.description_bg, 65535) || cell(row.description_en, 65535) || `Категория ${categoryName}`, sourceImage(row.image), "layers", JSON.stringify(tree), cell(row.seo_keyword_bg, 255) || null, cell(row.seo_keyword_en, 255) || null, cell(row.meta_title_bg, 500) || null, cell(row.meta_title_en, 500) || null, cell(row.meta_description_bg, 65535) || null, cell(row.meta_description_en, 65535) || null, cell(row.seo_canonical, 4096) || null, cell(row.meta_robots, 255) || null, Number(cell(row.sort_order, 16) || 0), false]);
      const [stored] = await queryRows(connection, "SELECT id FROM catalogue_categories WHERE legacyCategoryId = ? LIMIT 1", [legacyCategoryId]);
      categoryIdByFullPath.set(cell(row.full_path_bg, 1024), stored.id);
    }
    report.imported.categories = { rowsUpserted: categories.length, activePublicTopCategoriesRetained: staticCategoryId.size };

    const manufacturerNameByLegacyId = new Map();
    let manufacturersUpserted = 0;
    for (const row of manufacturers) {
      const legacyManufacturerId = positiveInt(row.manufacturer_id);
      if (!legacyManufacturerId) continue;
      const name = cell(row.name_bg, 255) || cell(row.name, 255) || cell(row.name_en, 255) || `Марка ${legacyManufacturerId}`;
      await connection.execute("INSERT INTO catalogue_manufacturers (legacyManufacturerId,slug,name,nameEn,description,imageUrl,sortOrder,isActive) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),nameEn=VALUES(nameEn),description=VALUES(description),imageUrl=VALUES(imageUrl),sortOrder=VALUES(sortOrder),isActive=VALUES(isActive)", [legacyManufacturerId, slug(name, `brand-${legacyManufacturerId}`), name, cell(row.name_en, 255) || null, cell(row.description_bg, 65535) || cell(row.description_en, 65535) || null, cell(row.image) ? sourceImage(row.image) : null, Number(cell(row.sort_order, 16) || 0), true]);
      manufacturerNameByLegacyId.set(legacyManufacturerId, name);
      manufacturersUpserted += 1;
    }
    report.imported.manufacturers = { rowsUpserted: manufacturersUpserted };

    await connection.execute("UPDATE catalogue_products SET isActive = 0 WHERE legacyProductId IS NULL");
    const preparedProducts = [];
    const categoryPathsByLegacyProductId = new Map();
    let uncategorizedProducts = 0;
    for (const row of products) {
      const legacyProductId = positiveInt(row.product_id);
      if (!legacyProductId) throw new Error("The product export contains an invalid product ID.");
      const rawCategoryPaths = Array.isArray(productCategoryPaths[String(legacyProductId)]) ? productCategoryPaths[String(legacyProductId)] : cell(row.product_category, 65535).split("|").map((item) => item.trim()).filter(Boolean);
      const staticSlug = staticCategorySlug(rawCategoryPaths[0] ?? "");
      const primaryCategoryId = staticCategoryId.get(staticSlug) ?? staticCategoryId.get("stroitelstvo");
      if (!primaryCategoryId) throw new Error("A required public top-level category is missing.");
      if (!rawCategoryPaths.length) uncategorizedProducts += 1;
      const legacyManufacturerId = positiveInt(row.manufacturer_id);
      const productName = cell(row.name_bg, 500) || cell(row.name_en, 500) || cell(row.model, 500) || `Артикул ${legacyProductId}`;
      const normalPrice = decimal(row.price);
      const groupSpecialPrice = cell(row.special_price_for_group_1) ? decimal(row.special_price_for_group_1) : null;
      const specialPrice = groupSpecialPrice ?? (cell(row.price_special) ? decimal(row.price_special) : null);
      const priceEur = specialPrice ?? normalPrice;
      const oldPriceEur = specialPrice ? normalPrice : null;
      const quantity = Math.max(0, Number(cell(row.quantity, 16) || 0));
      const availability = quantity > 0 ? "in_stock" : (truthy(row.status) ? "on_request" : "out_of_stock");
      const features = [cell(row.model, 160) && `Модел: ${cell(row.model, 160)}`, cell(row.product_attribute, 1000), cell(row.product_option, 1000)].filter(Boolean).slice(0, 12);
      const gallery = [...new Set([sourceImage(row.image), ...urls(row.additional_images)])];
      const active = truthy(row.status);
      preparedProducts.push([legacyProductId, legacyManufacturerId, primaryCategoryId, slug(productName, `legacy-${legacyProductId}`), cell(row.sku, 96) || cell(row.model, 96) || null, manufacturerNameByLegacyId.get(legacyManufacturerId) ?? (cell(row.manufacturer, 160) || null), productName, cell(row.description_bg, 65535) || cell(row.description_en, 65535) || productName, gallery[0], JSON.stringify(gallery), cell(row.image_alt_bg, 1000) || cell(row.image_alt_en, 1000) || productName, priceEur, oldPriceEur, specialPrice ? "Промоция" : null, availability, quantity, JSON.stringify(features), cell(row.seo_keyword_bg, 255) || null, cell(row.seo_keyword_en, 255) || null, cell(row.meta_title_bg, 500) || null, cell(row.meta_title_en, 500) || null, cell(row.meta_description_bg, 65535) || null, cell(row.meta_description_en, 65535) || null, cell(row.seo_canonical, 4096) || null, cell(row.meta_robots, 255) || null, active]);
      categoryPathsByLegacyProductId.set(legacyProductId, rawCategoryPaths);
    }
    const productSql = "INSERT INTO catalogue_products (legacyProductId,legacyManufacturerId,categoryId,slug,sku,brand,name,description,imageUrl,galleryJson,imageAlt,priceEur,oldPriceEur,discountLabel,availability,stockQuantity,featuresJson,legacySeoKeywordBg,legacySeoKeywordEn,legacyMetaTitleBg,legacyMetaTitleEn,legacyMetaDescriptionBg,legacyMetaDescriptionEn,legacyCanonicalUrl,legacyMetaRobots,isActive) VALUES ? ON DUPLICATE KEY UPDATE legacyManufacturerId=VALUES(legacyManufacturerId),categoryId=VALUES(categoryId),sku=VALUES(sku),brand=VALUES(brand),name=VALUES(name),description=VALUES(description),imageUrl=IF(catalogue_products.imageUrl LIKE '/manus-storage/%', catalogue_products.imageUrl, VALUES(imageUrl)),galleryJson=IF(catalogue_products.imageUrl LIKE '/manus-storage/%', catalogue_products.galleryJson, VALUES(galleryJson)),imageAlt=VALUES(imageAlt),priceEur=VALUES(priceEur),oldPriceEur=VALUES(oldPriceEur),discountLabel=VALUES(discountLabel),availability=VALUES(availability),stockQuantity=VALUES(stockQuantity),featuresJson=VALUES(featuresJson),legacySeoKeywordBg=VALUES(legacySeoKeywordBg),legacySeoKeywordEn=VALUES(legacySeoKeywordEn),legacyMetaTitleBg=VALUES(legacyMetaTitleBg),legacyMetaTitleEn=VALUES(legacyMetaTitleEn),legacyMetaDescriptionBg=VALUES(legacyMetaDescriptionBg),legacyMetaDescriptionEn=VALUES(legacyMetaDescriptionEn),legacyCanonicalUrl=VALUES(legacyCanonicalUrl),legacyMetaRobots=VALUES(legacyMetaRobots),isActive=VALUES(isActive)";
    for (let start = 0; start < preparedProducts.length; start += 250) await connection.query(productSql, [preparedProducts.slice(start, start + 250)]);
    const [storedProducts] = await connection.query("SELECT id, legacyProductId FROM catalogue_products WHERE legacyProductId IS NOT NULL");
    const productIdByLegacyId = new Map(storedProducts.map((row) => [Number(row.legacyProductId), Number(row.id)]));
    const importedProductIds = Array.from(productIdByLegacyId.values());
    for (let start = 0; start < importedProductIds.length; start += 500) await connection.query("DELETE FROM catalogue_product_category_links WHERE productId IN (?)", [importedProductIds.slice(start, start + 500)]);
    const productCategoryLinkRows = [];
    for (const [legacyProductId, rawCategoryPaths] of categoryPathsByLegacyProductId) {
      const productId = productIdByLegacyId.get(legacyProductId);
      if (!productId) throw new Error("A migrated product could not be retrieved for category linking.");
      for (let position = 0; position < rawCategoryPaths.length; position += 1) {
        const categoryId = categoryIdByFullPath.get(rawCategoryPaths[position]);
        if (categoryId) productCategoryLinkRows.push([productId, categoryId, position]);
      }
    }
    for (let start = 0; start < productCategoryLinkRows.length; start += 500) await connection.query("INSERT INTO catalogue_product_category_links (productId,categoryId,position) VALUES ?", [productCategoryLinkRows.slice(start, start + 500)]);
    report.imported.products = { rowsUpserted: preparedProducts.length, categoryLinksInserted: productCategoryLinkRows.length, productsWithoutLegacyCategory: uncategorizedProducts, priorTestProductsDeactivated: true };

    const orderByLegacyId = new Map();
    for (const row of orderRows) {
      const legacyOrderId = positiveInt(row.order_id);
      const legacyProductId = positiveInt(row.product_id);
      const orderedAt = date(row.date_added);
      if (!legacyOrderId || !legacyProductId || !orderedAt) throw new Error("The approved historical order export contains a malformed row.");
      let order = orderByLegacyId.get(legacyOrderId);
      if (!order) {
        const legacyCustomerId = positiveInt(row.customer_id);
        const customerId = (legacyCustomerId && customerIdByLegacyId.get(legacyCustomerId)) || profileIdByEmail.get(email(row.email)) || null;
        order = { legacyOrderId, legacyCustomerId, customerId, storeName: cell(row.store_name, 255) || null, orderStatus: cell(row.order_status, 160) || "Неуточнен статус", currencyCode: cell(row.currency_code, 8).toUpperCase() || "BGN", currencyValue: decimal(row.currency_value, "1.00000000", 8), total: decimal(row.total), totalInOrderCurrency: cell(row.total_in_order_currency) ? decimal(row.total_in_order_currency) : null, orderedAt, legacyModifiedAt: date(row.date_modified), lines: [] };
        orderByLegacyId.set(legacyOrderId, order);
      }
      order.lines.push({ legacyProductId, productName: cell(row.product_name, 500) || "Артикул от историческа поръчка", productModel: cell(row.product_model, 160) || null, quantity: Math.max(1, Number(cell(row.product_quantity, 16) || 1)), unitPrice: decimal(row.product_price), lineTotal: decimal(row.product_total), lineTax: cell(row.product_tax) ? decimal(row.product_tax) : null });
    }
    let importedOrders = 0;
    let importedOrderLines = 0;
    let orderLinksByLegacyId = 0;
    let orderLinksByEmail = 0;
    let unlinkedOrders = 0;
    for (const order of orderByLegacyId.values()) {
      const linkedByLegacy = order.legacyCustomerId && customerIdByLegacyId.get(order.legacyCustomerId);
      const linkedByEmail = !linkedByLegacy && order.customerId;
      if (linkedByLegacy) orderLinksByLegacyId += 1;
      else if (linkedByEmail) orderLinksByEmail += 1;
      else unlinkedOrders += 1;
      const [existing] = await queryRows(connection, "SELECT id FROM legacy_customer_orders WHERE legacyOrderId=? LIMIT 1", [order.legacyOrderId]);
      let recordId;
      if (existing) {
        await connection.execute("UPDATE legacy_customer_orders SET customerId=?,legacyCustomerId=?,storeName=?,orderStatus=?,currencyCode=?,currencyValue=?,total=?,totalInOrderCurrency=?,orderedAt=?,legacyModifiedAt=? WHERE id=?", [order.customerId, order.legacyCustomerId, order.storeName, order.orderStatus, order.currencyCode, order.currencyValue, order.total, order.totalInOrderCurrency, order.orderedAt, order.legacyModifiedAt, existing.id]);
        await connection.execute("DELETE FROM legacy_customer_order_lines WHERE legacyOrderRecordId=?", [existing.id]);
        recordId = existing.id;
      } else {
        const [result] = await connection.execute("INSERT INTO legacy_customer_orders (legacyOrderId,customerId,legacyCustomerId,storeName,orderStatus,currencyCode,currencyValue,total,totalInOrderCurrency,orderedAt,legacyModifiedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)", [order.legacyOrderId, order.customerId, order.legacyCustomerId, order.storeName, order.orderStatus, order.currencyCode, order.currencyValue, order.total, order.totalInOrderCurrency, order.orderedAt, order.legacyModifiedAt]);
        recordId = result.insertId;
        importedOrders += 1;
      }
      for (let position = 0; position < order.lines.length; position += 1) {
        const line = order.lines[position];
        await connection.execute("INSERT INTO legacy_customer_order_lines (legacyOrderRecordId,legacyProductId,linePosition,productName,productModel,quantity,unitPrice,lineTotal,lineTax) VALUES (?,?,?,?,?,?,?,?,?)", [recordId, line.legacyProductId, position, line.productName, line.productModel, line.quantity, line.unitPrice, line.lineTotal, line.lineTax]);
        importedOrderLines += 1;
      }
    }
    report.imported.orders = { ordersInserted: importedOrders, orderLinesInserted: importedOrderLines, linkedByLegacyCustomerId: orderLinksByLegacyId, linkedByEmail: orderLinksByEmail, unlinkedGuestOrRemovedCustomerOrders: unlinkedOrders };

    await connection.commit();
    report.completedAt = new Date().toISOString();
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
