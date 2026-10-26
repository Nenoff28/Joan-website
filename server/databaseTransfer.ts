import crypto from "node:crypto";
import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { ENV } from "./_core/env";

const EXPORT_HEADER = "-- JOAN DATABASE EXPORT v1";
const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

type Row = RowDataPacket & Record<string, unknown>;
type TableInfo = { name: string; rows: number; columns: string[] };

function identifier(value: string) {
  return `\`${value.replace(/`/g, "``")}\``;
}

function literal(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (Buffer.isBuffer(value)) return `X'${value.toString("hex")}'`;
  if (value instanceof Date) return `'${value.toISOString().replace("T", " ").replace("Z", "")}'`;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  const text = String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\0/g, "\\0")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\u001a/g, "\\Z")
    .replace(/'/g, "\\'");
  return `'${text}'`;
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let quote = "";
  let lineComment = false;
  let blockComment = false;
  let backslash = false;
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];
    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (!quote && char === "-" && next === "-" && /\s/.test(sql[index + 2] ?? "")) {
      lineComment = true;
      index += 1;
      continue;
    }
    if (!quote && char === "#") {
      lineComment = true;
      continue;
    }
    if (!quote && char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (quote) {
      if (backslash) {
        backslash = false;
        continue;
      }
      if (char === "\\") {
        backslash = true;
        continue;
      }
      if (char === quote) {
        if (sql[index + 1] === quote) {
          index += 1;
        } else {
          quote = "";
        }
      }
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }
    if (char === ";") {
      const statement = sql.slice(start, index).trim();
      if (statement) statements.push(statement);
      start = index + 1;
    }
  }
  const tail = sql.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

function stripLeadingSqlComments(statement: string) {
  return statement
    .replace(/^(?:(?:--[^\n]*(?:\n|$)|#[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)[\t\r\n ]*)+/g, "")
    .trim();
}

function validateDump(sql: string) {
  const bytes = Buffer.byteLength(sql, "utf8");
  if (!sql.includes(EXPORT_HEADER)) throw new Error("Файлът не е export от Joan.bg (липсва идентификаторът на export-а).");
  if (bytes > MAX_IMPORT_BYTES) {
    throw new Error("SQL файлът не може да е по-голям от 50 MB.");
  }
  const statements = splitSqlStatements(sql);
  if (!statements.length) throw new Error("SQL файлът не съдържа изпълними команди.");
  const normalizedStatements = statements.map(stripLeadingSqlComments);
  const forbidden = /\b(CREATE\s+DATABASE|DROP\s+DATABASE|GRANT|REVOKE|LOAD\s+DATA|CALL|UPDATE|DELETE\s+FROM|TRUNCATE|ALTER\s+USER)\b/i;
  const unsafe = normalizedStatements.find(statement => forbidden.test(statement));
  if (unsafe) throw new Error("Файлът съдържа неподдържана или опасна SQL команда.");
  const supported = normalizedStatements.every(statement => /^(SET|DROP\s+TABLE|CREATE\s+TABLE|INSERT\s+INTO|ALTER\s+TABLE)\b/i.test(statement));
  if (!supported) throw new Error("Файлът съдържа SQL команди извън позволения backup формат.");
  return statements;
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function previewDatabaseImport(sql: string) {
  const statements = validateDump(sql);
  const tableNames = new Set<string>();
  let insertStatements = 0;
  for (const statement of statements) {
    const normalized = stripLeadingSqlComments(statement);
    const table = normalized.match(/^(?:DROP\s+TABLE\s+IF\s+EXISTS|CREATE\s+TABLE|INSERT\s+INTO)\s+`([^`]+)`/i)?.[1];
    if (table) tableNames.add(table);
    if (/^INSERT\s+INTO/i.test(normalized)) insertStatements += 1;
  }
  return {
    valid: true as const,
    checksum: sha256(sql),
    bytes: Buffer.byteLength(sql, "utf8"),
    statements: statements.length,
    insertStatements,
    tables: Array.from(tableNames).sort(),
    requiresReplace: true as const,
  };
}

async function connection() {
  if (!ENV.databaseUrl) throw new Error("DATABASE_URL не е конфигуриран на server-а.");
  return mysql.createConnection(ENV.databaseUrl);
}

export async function exportDatabase() {
  const db = await connection();
  try {
    const [tableRows] = await db.query<RowDataPacket[]>("SELECT TABLE_NAME AS tableName FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME");
    const tables = (tableRows as Row[]).map(row => String(row.tableName));
    const chunks: string[] = [EXPORT_HEADER, "-- Generated by Joan.bg. Import only into a trusted MySQL database.", "SET FOREIGN_KEY_CHECKS=0;"];
    let totalRows = 0;
    for (const table of tables) {
      const quoted = identifier(table);
      const [createRows] = await db.query<RowDataPacket[]>(`SHOW CREATE TABLE ${quoted}`);
      const createSql = String((createRows as Row[])[0]?.["Create Table"] ?? (createRows as Row[])[0]?.["Create View"] ?? "");
      if (!createSql) throw new Error(`Не може да се прочете структурата на таблица ${table}.`);
      chunks.push(`DROP TABLE IF EXISTS ${quoted};`, `${createSql};`);
      const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM ${quoted}`);
      totalRows += rows.length;
      if (!rows.length) continue;
      const columns = Object.keys(rows[0]);
      for (let start = 0; start < rows.length; start += 100) {
        const values = rows.slice(start, start + 100).map(row => `(${columns.map(column => literal(row[column])).join(",")})`).join(",\n");
        chunks.push(`INSERT INTO ${quoted} (${columns.map(identifier).join(",")}) VALUES\n${values};`);
      }
    }
    chunks.push("SET FOREIGN_KEY_CHECKS=1;");
    const sql = `${chunks.join("\n\n")}\n`;
    return {
      fileName: `joan-database-${new Date().toISOString().slice(0, 10)}.sql`,
      content: sql,
      checksum: sha256(sql),
      bytes: Buffer.byteLength(sql, "utf8"),
      tableCount: tables.length,
      rowCount: totalRows,
    };
  } finally {
    await db.end();
  }
}

export async function importDatabase(sql: string, checksum: string, confirmReplace: boolean) {
  const statements = validateDump(sql);
  if (!confirmReplace) throw new Error("Импортът изисква изрично потвърждение за заместване на текущата база.");
  const actualChecksum = sha256(sql);
  if (actualChecksum !== checksum) throw new Error("Checksum-ът на файла се промени. Направете нов preview преди импорт.");
  const db = await connection();
  let executed = 0;
  try {
    await db.query("SET FOREIGN_KEY_CHECKS=0");
    for (const statement of statements) {
      await db.query(statement);
      executed += 1;
    }
    await db.query("SET FOREIGN_KEY_CHECKS=1");
    return { imported: true as const, executedStatements: executed, checksum: actualChecksum };
  } catch (error) {
    await db.query("SET FOREIGN_KEY_CHECKS=1").catch(() => undefined);
    throw new Error(`Импортът е прекъснат след ${executed} команди: ${error instanceof Error ? error.message : "неизвестна database грешка"}`);
  } finally {
    await db.end();
  }
}

export const databaseTransferLimits = { maxImportBytes: MAX_IMPORT_BYTES };
