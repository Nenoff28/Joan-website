#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const outputPath = path.resolve(process.env.SCHEMA_REFERENCE_PATH || "docs/DATABASE_SCHEMA_REFERENCE.sql");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to export the schema reference.");

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [tableRows] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const tables = tableRows.map((row) => Object.values(row)[0]).filter((name) => typeof name === "string").sort();
  const statements = ["-- Joan.bg production schema reference", "-- Generated without data; review against drizzle/schema.ts before applying migrations.", "SET NAMES utf8mb4;", "SET FOREIGN_KEY_CHECKS=0;", ""];
  for (const table of tables) {
    const [rows] = await connection.query(`SHOW CREATE TABLE ${mysql.escapeId(table)}`);
    const statement = Object.values(rows[0]).find((value) => typeof value === "string" && value.startsWith("CREATE TABLE"));
    if (typeof statement !== "string") throw new Error(`Could not read DDL for ${table}.`);
    statements.push(`DROP TABLE IF EXISTS ${mysql.escapeId(table)};`, `${statement};`, "");
  }
  statements.push("SET FOREIGN_KEY_CHECKS=1;", "");
  await fs.writeFile(outputPath, statements.join("\n"));
  console.log(`Schema reference written: ${outputPath} (${tables.length} tables).`);
} finally {
  await connection.end();
}
