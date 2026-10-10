import fs from "node:fs";
import { validatePolicy } from "./contracts.mjs";

export function loadCompilerPolicy(filePath) {
  const policy = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return validatePolicy(policy);
}

export function sheetDisposition(policy, sheetName) {
  return (
    policy.sheets.find((sheet) => sheet.name === sheetName)?.disposition ??
    "unsupported"
  );
}

export function pilotMapping(policy, recordType) {
  return policy.pilotMappings.find(
    (mapping) => mapping.recordType === recordType,
  );
}
