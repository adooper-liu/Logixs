import Ajv2020 from "ajv/dist/2020.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const schemas = {};
for (const name of [
  "ownership-catalog",
  "purge-manifest",
  "purge-receipt",
  "backup-manifest",
  "restore-receipt",
]) {
  const schema = JSON.parse(
    fs.readFileSync(path.join(here, "schemas", `${name}.schema.json`), "utf8"),
  );
  schemas[name] = ajv.compile(schema);
}

function validate(name, value, code) {
  if (!schemas[name](value))
    throw new Error(`${code}:${JSON.stringify(schemas[name].errors)}`);
  return value;
}

export function validateOwnershipCatalog(value) {
  return validate("ownership-catalog", value, "OWNERSHIP_CATALOG_INVALID");
}
export function validatePurgeManifest(value) {
  return validate("purge-manifest", value, "PURGE_MANIFEST_INVALID");
}
export function validatePurgeReceipt(value) {
  return validate("purge-receipt", value, "PURGE_RECEIPT_INVALID");
}
export function validateBackupManifest(value) {
  return validate("backup-manifest", value, "BACKUP_MANIFEST_INVALID");
}
export function validateRestoreReceipt(value) {
  return validate("restore-receipt", value, "RESTORE_RECEIPT_INVALID");
}
