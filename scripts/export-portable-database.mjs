#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { finished } from "node:stream/promises";
import { createGzip } from "node:zlib";
import mysql from "mysql2";
import mysqlPromise from "mysql2/promise";

const exportRoot = path.resolve(process.env.PORTABLE_EXPORT_DIR || "/home/ubuntu/joan-portable-export");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for the portable database export.");

const parsed = new URL(databaseUrl);
if (!["mysql:", "mariadb:"].includes(parsed.protocol)) throw new Error("DATABASE_URL must use mysql:// or mariadb://.");
const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
if (!database) throw new Error("DATABASE_URL is missing the database name.");

const backupDirectory = path.join(exportRoot, "database");
await fsp.mkdir(backupDirectory, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const filename = `joan-database-${timestamp}.sql.gz`;
const destination = path.join(backupDirectory, filename);
const temporaryDestination = `${destination}.partial`;

const connection = await mysqlPromise.createConnection(databaseUrl);
const output = fs.createWriteStream(temporaryDestination, { flags: "wx" });
const gzip = createGzip({ level: 9 });
gzip.pipe(output);

const write = async (value) => {
  if (!gzip.write(value)) await new Promise((resolve) => gzip.once("drain", resolve));
};

let rowCount = 0;
try {
  await connection.query("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await connection.beginTransaction();
  await write("-- Joan.bg portable database export\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n\n");

  const [tableRows] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const tables = tableRows.map((row) => Object.values(row)[0]).filter((table) => typeof table === "string").sort();

  for (const table of tables) {
    const escapedTable = mysql.escapeId(table);
    const [createRows] = await connection.query(`SHOW CREATE TABLE ${escapedTable}`);
    const createStatement = Object.values(createRows[0]).find((value) => typeof value === "string" && value.startsWith("CREATE TABLE"));
    if (typeof createStatement !== "string") throw new Error(`Could not read CREATE TABLE statement for ${table}.`);
    await write(`DROP TABLE IF EXISTS ${escapedTable};\n${createStatement};\n\n`);

    const [rows] = await connection.query(`SELECT * FROM ${escapedTable}`);
    if (rows.length) {
      const columns = Object.keys(rows[0]);
      const escapedColumns = columns.map((column) => mysql.escapeId(column)).join(", ");
      const chunkSize = 250;
      for (let index = 0; index < rows.length; index += chunkSize) {
        const chunk = rows.slice(index, index + chunkSize);
        const values = chunk.map((row) => `(${columns.map((column) => mysql.escape(row[column])).join(", ")})`).join(",\n");
        await write(`INSERT INTO ${escapedTable} (${escapedColumns}) VALUES\n${values};\n`);
      }
      await write("\n");
      rowCount += rows.length;
    }
  }

  await write("SET FOREIGN_KEY_CHECKS=1;\n");
  await connection.commit();
  gzip.end();
  await finished(output);
  await fsp.rename(temporaryDestination, destination);
} catch (error) {
  await connection.rollback().catch(() => undefined);
  gzip.destroy();
  output.destroy();
  await fsp.rm(temporaryDestination, { force: true });
  throw error;
} finally {
  await connection.end();
}

const content = await fsp.readFile(destination);
const manifest = {
  generatedAt: new Date().toISOString(),
  filename,
  bytes: content.length,
  sha256: crypto.createHash("sha256").update(content).digest("hex"),
  database,
  rowCount,
  consistency: "repeatable-read transaction snapshot; no table locks",
  encrypted: false,
  warning: "This dump may contain customer and order data. Keep it outside Git and transfer it only through an approved protected channel.",
};
await fsp.writeFile(path.join(backupDirectory, `${filename}.manifest.json`), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Portable database export created: ${filename} (${content.length} bytes, ${rowCount} rows).`);
