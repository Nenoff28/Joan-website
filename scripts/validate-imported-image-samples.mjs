import mysql from "mysql2/promise";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [rows] = await connection.query("SELECT imageUrl FROM catalogue_products WHERE legacyProductId IS NOT NULL AND imageUrl LIKE 'https://%' ORDER BY legacyProductId LIMIT 12");
  const statuses = {};
  for (const row of rows) {
    try {
      const response = await fetch(row.imageUrl, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(12000) });
      const status = String(response.status);
      statuses[status] = (statuses[status] ?? 0) + 1;
    } catch {
      statuses.network_error = (statuses.network_error ?? 0) + 1;
    }
  }
  console.log(JSON.stringify({ sampled: rows.length, statuses }));
} finally {
  await connection.end();
}
