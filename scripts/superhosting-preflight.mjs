#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const minimumRuntime = [20, 19, 0];
const alternativeRuntime = [22, 12, 0];
const actualRuntime = process.versions.node.split(".").map(Number);
const compareVersion = (actual, minimum) => {
  for (let index = 0; index < 3; index += 1) {
    if ((actual[index] ?? 0) !== (minimum[index] ?? 0)) return (actual[index] ?? 0) - (minimum[index] ?? 0);
  }
  return 0;
};
const atLeast = (actual, minimum) => compareVersion(actual, minimum) >= 0;
const runtimeOk = atLeast(actualRuntime, minimumRuntime) || atLeast(actualRuntime, alternativeRuntime);
const projectRoot = path.resolve(import.meta.dirname, "..");
const distEntry = path.join(projectRoot, "dist", "index.js");

const results = [
  {
    label: "Node.js runtime",
    pass: runtimeOk,
    detail: `Found ${process.versions.node}; this project requires Node ${minimumRuntime.join(".")}+ or ${alternativeRuntime.join(".")}+ for the current Vite 7 SSR runtime.`,
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
