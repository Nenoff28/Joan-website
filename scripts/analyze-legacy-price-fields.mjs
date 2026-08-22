import fs from "node:fs";
import { parse } from "csv-parse/sync";

const sourcePath = "/home/ubuntu/universal-export-audit/product.csv";
const auditDate = process.env.AUDIT_DATE ?? new Date().toISOString().slice(0, 10);

function text(value) { return String(value ?? "").trim(); }
function number(value) {
  const parsed = Number(text(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
function positive(value) {
  const parsed = number(value);
  return parsed && parsed > 0 ? parsed : null;
}
function dateIsCurrent(start, end) {
  const normalizedStart = text(start);
  const normalizedEnd = text(end);
  return (!normalizedStart || normalizedStart <= auditDate) && (!normalizedEnd || normalizedEnd >= auditDate);
}

const [headers, ...rows] = parse(fs.readFileSync(sourcePath, "utf8"), { columns: false, bom: true, skip_empty_lines: true, relax_column_count: true, relax_quotes: true, trim: false });
const normalizedHeaders = headers.map((header, index) => text(header) || `column_${index}`);
const products = rows.map((cells) => Object.fromEntries(normalizedHeaders.map((header, index) => [header, cells[index] ?? ""])));

const result = products.reduce((summary, product) => {
  const normal = positive(product.price);
  const group = positive(product.special_price_for_group_1);
  const direct = positive(product.price_special);
  const activeGroup = group && dateIsCurrent(product.special_price_for_group_1_start, product.special_price_for_group_1_end) ? group : null;
  const liveCandidate = activeGroup ?? direct;
  summary.total += 1;
  if (normal) summary.normalPricePresent += 1;
  if (group) {
    summary.groupSpecialPositive += 1;
    if (group < (normal ?? Infinity)) summary.groupSpecialLowerThanNormal += 1;
    else summary.groupSpecialNotLowerThanNormal += 1;
    if (dateIsCurrent(product.special_price_for_group_1_start, product.special_price_for_group_1_end)) summary.groupSpecialCurrentWindow += 1;
    else summary.groupSpecialOutsideWindow += 1;
  }
  if (direct) {
    summary.directSpecialPositive += 1;
    if (direct < (normal ?? Infinity)) summary.directSpecialLowerThanNormal += 1;
    else summary.directSpecialNotLowerThanNormal += 1;
  }
  if (liveCandidate && normal && liveCandidate < normal) summary.validCurrentPromotionCandidates += 1;
  if (liveCandidate && (!normal || liveCandidate >= normal)) summary.invalidCurrentPromotionCandidates += 1;
  return summary;
}, {
  auditDate,
  total: 0,
  normalPricePresent: 0,
  groupSpecialPositive: 0,
  groupSpecialLowerThanNormal: 0,
  groupSpecialNotLowerThanNormal: 0,
  groupSpecialCurrentWindow: 0,
  groupSpecialOutsideWindow: 0,
  directSpecialPositive: 0,
  directSpecialLowerThanNormal: 0,
  directSpecialNotLowerThanNormal: 0,
  validCurrentPromotionCandidates: 0,
  invalidCurrentPromotionCandidates: 0,
});

console.log(JSON.stringify(result, null, 2));
