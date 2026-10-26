import { describe, expect, it } from "vitest";
import { previewDatabaseImport } from "./databaseTransfer";

describe("database transfer", () => {
  it("accepts a Joan export and reports tables/checksum", () => {
    const sql = [
      "-- JOAN DATABASE EXPORT v1",
      "SET FOREIGN_KEY_CHECKS=0;",
      "DROP TABLE IF EXISTS `demo`;",
      "CREATE TABLE `demo` (`id` int NOT NULL);",
      "INSERT INTO `demo` (`id`) VALUES (1);",
      "SET FOREIGN_KEY_CHECKS=1;",
    ].join("\n");
    const result = previewDatabaseImport(sql);
    expect(result.valid).toBe(true);
    expect(result.tables).toEqual(["demo"]);
    expect(result.insertStatements).toBe(1);
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a non-Joan dump and destructive commands not produced by export", () => {
    expect(() => previewDatabaseImport("DROP DATABASE joan;"))
      .toThrow("липсва идентификаторът");
    expect(() => previewDatabaseImport([
      "-- JOAN DATABASE EXPORT v1",
      "TRUNCATE TABLE `demo`;",
    ].join("\n"))).toThrow("неподдържана или опасна");
  });
});
