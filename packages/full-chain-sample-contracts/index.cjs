const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const Ajv = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats").default;

const schemaDirectory = path.join(__dirname, "schemas");
const schemaNames = [
  "shipment-plan",
  "booking-commitment",
  "cargo-ready-release",
  "stuffing-snapshot-line",
  "export-customs-case",
  "dispatch-fact",
  "package-manifest",
  "canonical-record-envelope",
  "canonical-record",
  "gap",
  "check",
  "rehearsal-receipt",
];
const schemas = Object.fromEntries(
  schemaNames.map((name) => [
    name,
    JSON.parse(
      fs.readFileSync(
        path.join(schemaDirectory, `${name}.schema.json`),
        "utf8",
      ),
    ),
  ]),
);
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
for (const name of schemaNames.slice(0, 6)) ajv.addSchema(schemas[name]);
const validators = Object.fromEntries(
  schemaNames.slice(6).map((name) => [name, ajv.compile(schemas[name])]),
);

const FULL_CHAIN_COMPATIBILITY_V1 = Object.freeze({
  manifestVersion: "full-chain-package.v1",
  sourceManifestVersion: "full-chain-source-manifest.v1",
  workbookVersion: "v0.5.1",
  compilerVersion: "full-chain-compiler.v1",
  mappingVersion: "full-chain-mapping.v0.5",
  policyVersion: "full-chain-policy.v0.5",
  recordVersion: "v1",
});
const EXPECTED_TYPES = Object.freeze([
  "shipment_plan",
  "booking_commitment",
  "cargo_ready_release",
  "stuffing_snapshot_line",
  "export_customs_case",
  "dispatch_fact",
]);
const RECORD_PAYLOAD_FIELDS = Object.freeze({
  shipment_plan: new Set(["planNo", "containerRefs", "bookingNo"]),
  booking_commitment: new Set([
    "bookingNo",
    "masterBillNo",
    "houseBillRefs",
    "containerRefs",
  ]),
  cargo_ready_release: new Set([
    "cargoReadyNo",
    "planNo",
    "sku",
    "quantity",
    "quantityUnit",
  ]),
  stuffing_snapshot_line: new Set([
    "containerNo",
    "cargoReadyNo",
    "sku",
    "houseBillNo",
    "quantity",
    "grossWeight",
    "volume",
  ]),
  export_customs_case: new Set([
    "invoiceNo",
    "houseBillNo",
    "declarationNo",
    "amount",
    "currency",
  ]),
  dispatch_fact: new Set([
    "containerNo",
    "vesselName",
    "voyageNo",
    "masterBillNo",
    "houseBillRefs",
    "gateInDate",
    "departedAt",
    "departedPrecision",
    "motherVesselDepartedAt",
  ]),
});
const REQUIRED_FILES = Object.freeze([
  "manifest.json",
  "records/shipment_plan.json",
  "records/booking_commitment.json",
  "records/cargo_ready_release.json",
  "records/stuffing_snapshot_line.json",
  "records/export_customs_case.json",
  "records/dispatch_fact.json",
  "lineage.jsonl",
  "gaps.json",
  "checks.json",
  "report.html",
  "receipt.json",
]);

function normalize(value) {
  if (typeof value === "string")
    return value.normalize("NFC").replace(/\r\n?/gu, "\n");
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalize(value[key])]),
    );
  }
  return value;
}

function compareCanonicalStrings(left, right) {
  return Buffer.from(String(left), "utf8").compare(
    Buffer.from(String(right), "utf8"),
  );
}
function canonicalStringify(value) {
  return JSON.stringify(normalize(value));
}
function canonicalText(value) {
  return `${canonicalStringify(value)}\n`;
}
function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}
function packageHashProjection(artifacts) {
  return {
    source:
      artifacts.manifest?.source ?? artifacts.manifest?.sourceFileAlias ?? null,
    compilerVersion: artifacts.manifest?.compilerVersion ?? null,
    mappingVersion: artifacts.manifest?.mappingVersion ?? null,
    policyVersion: artifacts.manifest?.policyVersion ?? null,
    gitCommit: artifacts.manifest?.gitCommit ?? null,
    publishable: artifacts.manifest?.publishable ?? null,
    allowedProof: artifacts.manifest?.allowedProof ?? null,
    prohibitedProof: artifacts.manifest?.prohibitedProof ?? null,
    sensitiveDataHandling: artifacts.manifest?.sensitiveDataHandling ?? null,
    records: [...(artifacts.records ?? [])].sort((left, right) =>
      compareCanonicalStrings(
        `${left.recordType}|${left.businessKey}`,
        `${right.recordType}|${right.businessKey}`,
      ),
    ),
    lineage: [...(artifacts.lineage ?? [])].sort((left, right) =>
      compareCanonicalStrings(JSON.stringify(left), JSON.stringify(right)),
    ),
    gaps: [...(artifacts.gaps ?? [])].sort((left, right) =>
      compareCanonicalStrings(
        `${left.code}|${left.recordRef ?? ""}`,
        `${right.code}|${right.recordRef ?? ""}`,
      ),
    ),
    checks: [...(artifacts.checks ?? [])].sort((left, right) =>
      compareCanonicalStrings(
        `${left.code}|${left.recordRef ?? left.recordRefs?.join("|") ?? ""}`,
        `${right.code}|${right.recordRef ?? right.recordRefs?.join("|") ?? ""}`,
      ),
    ),
  };
}
function packageHash(artifacts) {
  return sha256Hex(canonicalStringify(packageHashProjection(artifacts)));
}
function fail(code, errors = []) {
  const detail = errors
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
  throw new Error(`${code}${detail ? `: ${detail}` : ""}`);
}
function validate(name, value, code) {
  if (!validators[name](value)) fail(code, validators[name].errors);
  return value;
}

function validatePackageArtifacts(artifacts) {
  if (!artifacts || !Array.isArray(artifacts.records)) fail("PACKAGE_INVALID");
  validate("package-manifest", artifacts.manifest, "PACKAGE_MANIFEST_INVALID");
  const gaps = artifacts.gaps ?? [];
  const checks = artifacts.checks ?? [];
  const lineage = artifacts.lineage ?? [];
  if (
    artifacts.manifest.recordCount !== artifacts.records.length ||
    artifacts.manifest.gapCount !== gaps.length ||
    artifacts.manifest.checkCount !== checks.length ||
    artifacts.manifest.lineageCount !== lineage.length
  )
    fail("PACKAGE_MANIFEST_INVALID");
  const publishable =
    gaps.every((item) => item.status !== "blocking") &&
    checks.every((item) => item.status !== "fail");
  if (artifacts.manifest.publishable !== publishable)
    fail("PACKAGE_PUBLISHABLE_INVALID");
  if (
    artifacts.manifest.recordsHash !==
      sha256Hex(canonicalStringify(artifacts.records)) ||
    artifacts.manifest.gapsHash !== sha256Hex(canonicalStringify(gaps)) ||
    artifacts.manifest.checksHash !== sha256Hex(canonicalStringify(checks)) ||
    artifacts.manifest.lineageHash !== sha256Hex(canonicalStringify(lineage))
  )
    fail("PACKAGE_MANIFEST_INVALID");
  if (artifacts.manifest.packageHash !== packageHash(artifacts))
    fail("PACKAGE_HASH_INVALID");
  for (const record of artifacts.records) {
    validate("canonical-record-envelope", record, "PACKAGE_RECORD_INVALID");
    if (record.evidenceClass === "D" && !record.derivation)
      fail("PACKAGE_RECORD_INVALID");
    if (record.evidenceClass !== "D" && record.derivation !== null)
      fail("PACKAGE_RECORD_INVALID");
    if (record.evidenceClass === "S" && !record.scenario)
      fail("PACKAGE_RECORD_INVALID");
    if (record.evidenceClass !== "S" && record.scenario !== null)
      fail("PACKAGE_RECORD_INVALID");
    const allowedFields = RECORD_PAYLOAD_FIELDS[record.recordType];
    if (
      !allowedFields ||
      Object.keys(record.payload).some((field) => !allowedFields.has(field))
    )
      fail("PACKAGE_RECORD_INVALID");
  }
  for (const gap of gaps) validate("gap", gap, "PACKAGE_GAP_INVALID");
  for (const check of checks) validate("check", check, "PACKAGE_CHECK_INVALID");
}

function validateFullChainPackageForLanding(artifacts) {
  validatePackageArtifacts(artifacts);
  for (const record of artifacts.records)
    validate("canonical-record", record, "PACKAGE_RECORD_INVALID");
  const manifest = artifacts.manifest;
  const source = manifest.source;
  if (
    manifest.manifestVersion !== FULL_CHAIN_COMPATIBILITY_V1.manifestVersion ||
    source?.manifestVersion !==
      FULL_CHAIN_COMPATIBILITY_V1.sourceManifestVersion ||
    source?.workbookVersion !== FULL_CHAIN_COMPATIBILITY_V1.workbookVersion ||
    manifest.compilerVersion !== FULL_CHAIN_COMPATIBILITY_V1.compilerVersion ||
    manifest.mappingVersion !== FULL_CHAIN_COMPATIBILITY_V1.mappingVersion ||
    manifest.policyVersion !== FULL_CHAIN_COMPATIBILITY_V1.policyVersion ||
    artifacts.records.some(
      (record) =>
        record.recordVersion !== FULL_CHAIN_COMPATIBILITY_V1.recordVersion,
    )
  )
    fail("PACKAGE_VERSION_UNSUPPORTED");
  if (!/^[a-f0-9]{40}$/u.test(manifest.gitCommit))
    fail("PACKAGE_GIT_COMMIT_INVALID");
  if (!manifest.publishable) fail("PACKAGE_NOT_PUBLISHABLE");
  const types = artifacts.records.map((record) => record.recordType);
  if (
    types.length < EXPECTED_TYPES.length ||
    EXPECTED_TYPES.some((type) => !types.includes(type)) ||
    types.some((type) => !EXPECTED_TYPES.includes(type))
  )
    fail("PACKAGE_RECORD_SET_INVALID");
  return artifacts;
}

function validateRehearsalReceipt(value) {
  return validate("rehearsal-receipt", value, "REHEARSAL_RECEIPT_INVALID");
}

function comparable(value) {
  return process.platform === "win32" ? value.toLowerCase() : value;
}
function isWithin(parent, child) {
  const relative = path.relative(comparable(parent), comparable(child));
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}
async function listRelativeFiles(root, current = root) {
  const result = [];
  for (const entry of await fsp.readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    if (entry.isSymbolicLink()) fail("PACKAGE_PATH_INVALID");
    if (entry.isDirectory()) {
      result.push(...(await listRelativeFiles(root, absolute)));
    } else if (entry.isFile()) {
      result.push(path.relative(root, absolute).replaceAll(path.sep, "/"));
    } else {
      fail("PACKAGE_PATH_INVALID");
    }
  }
  return result.sort(compareCanonicalStrings);
}
async function readJson(root, relative, code) {
  try {
    return JSON.parse(await fsp.readFile(path.join(root, relative), "utf8"));
  } catch {
    fail(code);
  }
}
async function readFullChainPackageDirectory({
  packagePath,
  approvedRoot,
  repositoryRoot,
}) {
  if (
    !path.isAbsolute(packagePath) ||
    !path.isAbsolute(approvedRoot) ||
    !path.isAbsolute(repositoryRoot)
  )
    fail("PACKAGE_PATH_INVALID");
  let physicalPackage;
  let physicalApproved;
  let physicalRepository;
  try {
    [physicalPackage, physicalApproved, physicalRepository] = await Promise.all(
      [
        fsp.realpath(packagePath),
        fsp.realpath(approvedRoot),
        fsp.realpath(repositoryRoot),
      ],
    );
  } catch {
    fail("PACKAGE_PATH_INVALID");
  }
  if (
    comparable(physicalPackage) === comparable(physicalApproved) ||
    !isWithin(physicalApproved, physicalPackage) ||
    isWithin(physicalRepository, physicalPackage)
  )
    fail("PACKAGE_PATH_INVALID");
  const files = await listRelativeFiles(physicalPackage);
  if (
    files.length !== REQUIRED_FILES.length ||
    REQUIRED_FILES.some((file) => !files.includes(file))
  )
    fail("PACKAGE_FILE_SET_INVALID");
  const recordArrays = await Promise.all(
    EXPECTED_TYPES.map((type) =>
      readJson(
        physicalPackage,
        `records/${type}.json`,
        "PACKAGE_RECORD_SET_INVALID",
      ),
    ),
  );
  if (recordArrays.some((records) => !Array.isArray(records)))
    fail("PACKAGE_RECORD_SET_INVALID");
  let lineage;
  try {
    lineage = (
      await fsp.readFile(path.join(physicalPackage, "lineage.jsonl"), "utf8")
    )
      .split(/\r?\n/u)
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line))
      .map((item) => ({
        recordRef: item.recordRef,
        sourceRef: item.sourceRef,
        payloadFields: item.payloadFields,
      }));
  } catch {
    fail("PACKAGE_LINEAGE_INVALID");
  }
  const artifacts = {
    manifest: await readJson(
      physicalPackage,
      "manifest.json",
      "PACKAGE_MANIFEST_INVALID",
    ),
    records: recordArrays.flat(),
    lineage,
    gaps: await readJson(physicalPackage, "gaps.json", "PACKAGE_GAP_INVALID"),
    checks: await readJson(
      physicalPackage,
      "checks.json",
      "PACKAGE_CHECK_INVALID",
    ),
  };
  return validateFullChainPackageForLanding(artifacts);
}

module.exports = {
  FULL_CHAIN_COMPATIBILITY_V1,
  validatePackageArtifacts,
  validateFullChainPackageForLanding,
  readFullChainPackageDirectory,
  validateRehearsalReceipt,
  canonicalStringify,
  canonicalText,
  sha256Hex,
  packageHash,
  packageHashProjection,
  compareCanonicalStrings,
};
