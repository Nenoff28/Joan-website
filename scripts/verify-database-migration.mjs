#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;
if (!sourceUrl || !targetUrl) throw new Error("SOURCE_DATABASE_URL and TARGET_DATABASE_URL are required.");

const outputDirectory = path.resolve(process.env.MIGRATION_VALIDATION_DIR || "/home/ubuntu/joan-migration-validation");
await fs.mkdir(outputDirectory, { recursive: true });

const connect = (url) => mysql.createConnection({ uri: url, dateStrings: true, rowsAsArray: true });
const [source, target] = await Promise.all([connect(sourceUrl), connect(targetUrl)]);

const queryRows = async (connection, sql) => (await connection.query({ sql, rowsAsArray: true }))[0];
const getTables = async (connection) => {
  const rows = await queryRows(connection, "SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  return rows.map((row) => row[0]).filter((table) => typeof table === "string").sort();
};
const getColumns = async (connection, table) => {
  const rows = await queryRows(connection, `SHOW COLUMNS FROM ${mysql.escapeId(table)}`);
  return rows.map((row) => row[0]);
};
const getCreate = async (connection, table) => {
  const rows = await queryRows(connection, `SHOW CREATE TABLE ${mysql.escapeId(table)}`);
  return String(rows[0]?.[1] || "").replace(/ AUTO_INCREMENT=\d+/g, "").trim();
};
const getPrimary = async (connection, table) => {
  const rows = await queryRows(connection, `SHOW KEYS FROM ${mysql.escapeId(table)} WHERE Key_name = 'PRIMARY'`);
  return rows.sort((left, right) => Number(left[3]) - Number(right[3])).map((row) => row[4]);
};
const canonicalHash = async (connection, table, columns, orderColumns) => {
  const selected = columns.map((column) => mysql.escapeId(column)).join(", ");
  const orderBy = (orderColumns.length ? orderColumns : columns).map((column) => mysql.escapeId(column)).join(", ");
  const rows = await queryRows(connection, `SELECT ${selected} FROM ${mysql.escapeId(table)} ORDER BY ${orderBy}`);
  const hash = crypto.createHash("sha256");
  for (const row of rows) hash.update(`${JSON.stringify(row)}\n`);
  return { rowCount: rows.length, sha256: hash.digest("hex") };
};

try {
  const [sourceTables, targetTables] = await Promise.all([getTables(source), getTables(target)]);
  const allTables = [...new Set([...sourceTables, ...targetTables])].sort();
  const tables = [];

  for (const table of allTables) {
    const presentInSource = sourceTables.includes(table);
    const presentInTarget = targetTables.includes(table);
    if (!presentInSource || !presentInTarget) {
      tables.push({ table, presentInSource, presentInTarget, status: "missing" });
      continue;
    }
    const [sourceColumns, targetColumns, sourceCreate, targetCreate, primaryKey] = await Promise.all([
      getColumns(source, table), getColumns(target, table), getCreate(source, table), getCreate(target, table), getPrimary(source, table),
    ]);
    const [sourceData, targetData] = await Promise.all([
      canonicalHash(source, table, sourceColumns, primaryKey),
      canonicalHash(target, table, targetColumns, primaryKey),
    ]);
    const schemaMatches = JSON.stringify(sourceColumns) === JSON.stringify(targetColumns) && sourceCreate === targetCreate;
    const rowsMatch = sourceData.rowCount === targetData.rowCount;
    const hashMatches = sourceData.sha256 === targetData.sha256;
    tables.push({ table, presentInSource, presentInTarget, primaryKey, schemaMatches, rowsMatch, hashMatches, source: sourceData, target: targetData, status: schemaMatches && rowsMatch && hashMatches ? "match" : "different" });
  }

  const failures = tables.filter((table) => table.status !== "match");
  const report = { generatedAt: new Date().toISOString(), sourceTableCount: sourceTables.length, targetTableCount: targetTables.length, passed: failures.length === 0, failures: failures.length, tables };
  await fs.writeFile(path.join(outputDirectory, "database-migration-validation.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Database migration validation: ${tables.length - failures.length}/${tables.length} tables match.`);
  if (failures.length) process.exitCode = 1;
} finally {
  await Promise.all([source.end(), target.end()]);
}
