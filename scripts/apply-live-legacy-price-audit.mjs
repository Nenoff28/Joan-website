import fs from "node:fs";
import mysql from "mysql2/promise";

const AUDIT_PATH = "/home/ubuntu/universal-export-audit/live-legacy-price-audit.ndjson";
const REPORT_PATH = "/home/ubuntu/universal-export-audit/live-legacy-price-apply-report.json";
const RETRIED_LIVE_RECORDS = [
  { legacyProductId: 3631, liveCurrentEur: 0.43, liveOldEur: null, livePromotion: false },
  { legacyProductId: 7026, liveCurrentEur: 23.26, liveOldEur: null, livePromotion: false },
  { legacyProductId: 7331, liveCurrentEur: 4.8, liveOldEur: null, livePromotion: false },
];

function records() {
  return fs.readFileSync(AUDIT_PATH, "utf8").split("\n").flatMap((line) => {
    try { return line.trim() ? [JSON.parse(line)] : []; } catch { return []; }
  });
}

function normalizedPromotion(record) {
  const current = Number(record.liveCurrentEur);
  const old = Number(record.liveOldEur);
  if (!Number.isFinite(current) || current <= 0) return null;
  const isPromotion = Boolean(record.livePromotion) && Number.isFinite(old) && old > current;
  return { current: current.toFixed(2), old: isPromotion ? old.toFixed(2) : null, label: isPromotion ? "Промоция" : null };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is unavailable.");
  const source = records();
  const checked = [...source.filter((record) => record.status === "checked"), ...RETRIED_LIVE_RECORDS];
  const updates = checked.flatMap((record) => {
    const pricing = normalizedPromotion(record);
    return pricing && Number.isInteger(Number(record.legacyProductId)) ? [{ legacyProductId: Number(record.legacyProductId), ...pricing }] : [];
  });
  const skipped = source.length - updates.length;
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await connection.beginTransaction();
    let updated = 0;
    for (const record of updates) {
      const [result] = await connection.execute(
        "UPDATE catalogue_products SET priceEur=?, oldPriceEur=?, discountLabel=? WHERE legacyProductId=?",
        [record.current, record.old, record.label, record.legacyProductId],
      );
      updated += result.affectedRows;
    }
    await connection.commit();
    const report = {
      appliedAt: new Date().toISOString(),
      auditRecords: source.length,
      liveCheckedRecords: checked.length,
      appliedPriceRecords: updated,
      skippedUnverifiedOrUnpricedRecords: skipped,
      promotionsApplied: updates.filter((record) => record.label).length,
    };
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
