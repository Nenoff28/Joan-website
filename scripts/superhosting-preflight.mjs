#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const minimumRuntime = [20, 11, 0];
const actualRuntime = process.versions.node.split(".").map(Number);
const compareVersion = (actual, minimum) => actual.find((part, index) => part !== minimum[index]) ?? 0;
const runtimeDifference = compareVersion(actualRuntime, minimumRuntime);
const runtimeOk = runtimeDifference > 0 || (runtimeDifference === 0 && actualRuntime.every((part, index) => part === minimumRuntime[index]));
const projectRoot = path.resolve(import.meta.dirname, "..");
const distEntry = path.join(projectRoot, "dist", "index.js");

const results = [
  {
    label: "Node.js runtime",
    pass: runtimeOk,
    detail: `Found ${process.versions.node}; this project requires at least ${minimumRuntime.join(".")} for the current SSR runtime.`,
  },
  {
    label: "Prebuilt server bundle",
    pass: fs.existsSync(distEntry),
    detail: fs.existsSync(distEntry)
      ? "dist/index.js is present."
      : "dist/index.js is missing; create the production bundle before staging upload.",
  },
  {
    label: "Current managed-runtime dependencies",
    pass: false,
    detail: "Expected migration work: replace Manus OAuth and managed storage before a self-hosted production cutover.",
  },
];

console.log("Joan.bg SuperHosting preflight\n");
for (const result of results) {
  console.log(`${result.pass ? "PASS" : "ACTION"}  ${result.label}`);
  console.log(`       ${result.detail}`);
}

console.log("\nThis command does not read or print secret values, connect to a database, upload files, or alter the host.");
process.exitCode = runtimeOk && fs.existsSync(distEntry) ? 0 : 1;
