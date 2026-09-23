import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  ACTION_CATALOG_VERSION,
  ACTION_CODES,
  ACTION_DEFINITIONS,
} from "../packages/contracts/action-catalog.js";
import { LIFECYCLE_DATE_FACT_INBOX_KIND } from "../packages/contracts/lifecycle-date-fact-inbox.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const contractRoot = resolve(root, "packages/contracts");
const schemaRoot = resolve(contractRoot, "schemas/v1");
const catalogRoot = resolve(contractRoot, "catalogs/v1");
const fixtureRoot = resolve(contractRoot, "fixtures/v1");
const draft = "https://json-schema.org/draft/2020-12/schema";
const schemaBaseUrl = "https://schemas.logixs.internal/contracts/v1/";
const errors = [];

const jsonFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory()
      ? jsonFiles(path)
      : path.endsWith(".json")
        ? [path]
        : [];
  });

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${relative(root, path)}: invalid JSON: ${error.message}`);
    return null;
  }
};

const contractPackage = readJson(resolve(contractRoot, "package.json"));
const preReleaseBreakingChanges =
  readJson(resolve(contractRoot, "pre-release-breaking-changes.json")) ?? [];
if (!contractPackage?.private || !contractPackage?.version?.startsWith("0.")) {
  errors.push(
    "pre-release breaking-change exceptions require a private 0.x contract package",
  );
}
const declaredBreakingChanges = new Set(
  preReleaseBreakingChanges.map(
    ({ schema, pointer, removed }) => `${schema}|${pointer}|${removed}`,
  ),
);
const observedBreakingChanges = new Set();

const visit = (value, callback) => {
  if (!value || typeof value !== "object") return;
  callback(value);
  for (const child of Object.values(value)) visit(child, callback);
};

const resolvePointer = (document, fragment) => {
  if (!fragment || fragment === "#") return document;
  if (!fragment.startsWith("#/")) return undefined;
  return fragment
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((value, part) => value?.[part], document);
};

const schemaFiles = jsonFiles(schemaRoot);
const ids = new Set();
const schemas = new Map();
for (const path of schemaFiles) {
  const schema = readJson(path);
  if (!schema) continue;
  schemas.set(path, schema);
  if (schema.$schema !== draft)
    errors.push(`${relative(root, path)}: expected JSON Schema 2020-12`);
  if (!schema.$id) errors.push(`${relative(root, path)}: missing $id`);
  else if (ids.has(schema.$id))
    errors.push(`${relative(root, path)}: duplicate $id ${schema.$id}`);
  else ids.add(schema.$id);
  visit(schema, (value) => {
    if (typeof value.$ref !== "string") return;
    const hashAt = value.$ref.indexOf("#");
    const targetPart = hashAt < 0 ? value.$ref : value.$ref.slice(0, hashAt);
    const fragment = hashAt < 0 ? "" : value.$ref.slice(hashAt);
    const targetPath = targetPart ? resolve(dirname(path), targetPart) : path;
    if (!existsSync(targetPath)) {
      errors.push(`${relative(root, path)}: unresolved $ref ${value.$ref}`);
      return;
    }
    const target = readJson(targetPath);
    if (target && resolvePointer(target, fragment) === undefined) {
      errors.push(`${relative(root, path)}: unresolved pointer ${value.$ref}`);
    }
  });
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  strictTypes: false,
});
addFormats(ajv);
ajv.addKeyword({ keyword: "x-authoritativeDocuments", schemaType: "array" });
ajv.addKeyword({ keyword: "x-contractVersion", schemaType: "string" });
ajv.addKeyword({ keyword: "x-contracts", schemaType: "object" });

for (const [path, schema] of schemas) {
  try {
    if (!ajv.validateSchema(schema)) {
      errors.push(
        `${relative(root, path)}: invalid JSON Schema: ${ajv.errorsText(ajv.errors)}`,
      );
      continue;
    }
    ajv.addSchema(schema);
  } catch (error) {
    errors.push(
      `${relative(root, path)}: cannot register schema: ${error.message}`,
    );
  }
}
for (const [path, schema] of schemas) {
  try {
    if (!ajv.getSchema(schema.$id))
      errors.push(`${relative(root, path)}: schema did not compile`);
  } catch (error) {
    errors.push(
      `${relative(root, path)}: schema compile failed: ${error.message}`,
    );
  }
}

const index = readJson(resolve(schemaRoot, "index.json"));
const expectedContractIds = Array.from(
  { length: 11 },
  (_, indexValue) => `GC-${String(indexValue + 1).padStart(3, "0")}`,
);
if (
  JSON.stringify(index?.["x-authoritativeDocuments"]) !==
  JSON.stringify(expectedContractIds)
) {
  errors.push("schema index must register GC-001 through GC-011 in order");
}
if (
  JSON.stringify(Object.keys(index?.["x-contracts"] ?? {})) !==
  JSON.stringify(expectedContractIds)
) {
  errors.push("schema index coverage must map GC-001 through GC-011 in order");
}
for (const [contractId, schemaRefs] of Object.entries(
  index?.["x-contracts"] ?? {},
)) {
  if (!Array.isArray(schemaRefs) || schemaRefs.length === 0) {
    errors.push(`${contractId}: schema coverage must contain at least one ref`);
    continue;
  }
  for (const schemaRef of schemaRefs) {
    try {
      if (!ajv.getSchema(new URL(schemaRef, schemaBaseUrl).href))
        errors.push(
          `${contractId}: coverage ref did not compile: ${schemaRef}`,
        );
    } catch (error) {
      errors.push(
        `${contractId}: invalid coverage ref ${schemaRef}: ${error.message}`,
      );
    }
  }
}

const common = readJson(resolve(schemaRoot, "common.schema.json"));
const nodes = readJson(resolve(catalogRoot, "lifecycle-nodes.json"));
const events = readJson(resolve(catalogRoot, "canonical-events.json"));
const importFields = readJson(resolve(catalogRoot, "import-fields.json"));
const postDepartureFields = readJson(
  resolve(catalogRoot, "post-departure-fields.json"),
);
const cargoOwners = readJson(resolve(catalogRoot, "cargo-owners.json"));
const postDepartureFieldInventory = readJson(
  resolve(
    root,
    "docs/product/domain/evidence/POST_DEPARTURE_WORKBOOK_FIELD_INVENTORY_20260923.json",
  ),
);
const lifecycleTimeline = readJson(
  resolve(schemaRoot, "lifecycle-timeline.schema.json"),
);
const nodeCodes = common?.$defs?.LifecycleNodeCode?.enum ?? [];
const eventCodes = common?.$defs?.CanonicalEventCode?.enum ?? [];
const completionModes = new Set(common?.$defs?.CompletionMode?.enum ?? []);
const expectedImportFieldCodes = [
  "orderNumber",
  "containerNumber",
  "productNumber",
  "shippedQuantity",
  "quantityUnit",
  "contractNumber",
  "customsClearanceStatus",
  "customsClearanceActualAt",
  "unloadCompletionStatus",
  "unloadCompletedActualAt",
  "emptyConfirmationStatus",
  "emptyConfirmedActualAt",
  "emptyEstimatedAt",
  "timeSourceSystem",
  "timeAuthoritySystem",
  "timeSourceUtcOffset",
  "timeEvidenceRef",
  "timeDerivationRuleVersion",
];
const expectedQuantityUnitCodes = ["piece", "carton", "set", "pallet"];

const expectedPostDepartureOccurrences = [];
for (const [sourceSchema, source] of Object.entries(
  postDepartureFieldInventory?.maintenanceFieldInventory ?? {},
)) {
  for (const field of source.fields ?? []) {
    expectedPostDepartureOccurrences.push({
      rawHeader: field.rawHeader,
      sourceSchema,
      position: field.position,
      nonEmptyCount: field.nonEmptyCount,
      distinctNonEmptyCount: field.distinctNonEmptyCount,
    });
  }
}
const expectedPostDepartureHeaders = [
  ...new Set(
    expectedPostDepartureOccurrences.map(({ rawHeader }) => rawHeader),
  ),
].sort();
const postDepartureMappings = postDepartureFields?.mappings ?? [];
const actualPostDepartureHeaders = postDepartureMappings
  .map(({ rawHeader }) => rawHeader)
  .sort();
if (
  expectedPostDepartureHeaders.length !== 146 ||
  expectedPostDepartureOccurrences.length !== 176
) {
  errors.push(
    "verified post-departure inventory must contain exactly 146 headers and 176 occurrences",
  );
}
if (
  JSON.stringify(actualPostDepartureHeaders) !==
  JSON.stringify(expectedPostDepartureHeaders)
) {
  const actual = new Set(actualPostDepartureHeaders);
  const expected = new Set(expectedPostDepartureHeaders);
  const missing = expectedPostDepartureHeaders.filter(
    (header) => !actual.has(header),
  );
  const unknown = actualPostDepartureHeaders.filter(
    (header) => !expected.has(header),
  );
  errors.push(
    `post-departure field registry must cover each verified header exactly once; missing=${JSON.stringify(missing)} unknown=${JSON.stringify(unknown)}`,
  );
}
if (
  new Set(actualPostDepartureHeaders).size !== actualPostDepartureHeaders.length
) {
  errors.push("post-departure field registry contains duplicate raw headers");
}
if (
  postDepartureFields?.coverage?.distinctRawHeaders !== 146 ||
  postDepartureFields?.coverage?.sourceOccurrences !== 176
) {
  errors.push(
    "post-departure field registry coverage summary must remain 146 headers / 176 occurrences",
  );
}
for (const [sourceSchema, source] of Object.entries(
  postDepartureFields?.sourceSchemas ?? {},
)) {
  if (
    typeof source.file !== "string" ||
    typeof source.sheetName !== "string" ||
    source.sheetName.trim() === ""
  ) {
    errors.push(
      `${sourceSchema}: source workbook and sheet identity are required`,
    );
  }
}
const requiredMappingText = [
  "rawHeader",
  "canonicalFieldCode",
  "correctedMeaning",
  "ownerDomain",
  "targetObject",
  "dataType",
  "validationRule",
  "targetDisposition",
  "sensitivity",
  "currentPhysicalSupport",
  "currentContractSupport",
  "dataQualityRule",
  "deprecationPolicy",
];
const allowedPostDepartureTypes = new Set([
  "boolean",
  "date_time",
  "decimal",
  "enum",
  "identifier",
  "integer",
  "reference",
  "string",
]);
for (const mapping of postDepartureMappings) {
  for (const key of requiredMappingText) {
    if (typeof mapping[key] !== "string" || mapping[key].trim() === "") {
      errors.push(`${mapping.rawHeader ?? "<unknown>"}: missing ${key}`);
    }
  }
  if (!allowedPostDepartureTypes.has(mapping.dataType)) {
    errors.push(
      `${mapping.rawHeader}: unsupported dataType ${mapping.dataType}`,
    );
  }
  if (typeof mapping.storageNullable !== "boolean") {
    errors.push(`${mapping.rawHeader}: storageNullable must be boolean`);
  }
  if (!Array.isArray(mapping.profileRequired)) {
    errors.push(`${mapping.rawHeader}: profileRequired must be an array`);
  }
  const expected = expectedPostDepartureOccurrences
    .filter(({ rawHeader }) => rawHeader === mapping.rawHeader)
    .map(
      ({ sourceSchema, position, nonEmptyCount, distinctNonEmptyCount }) => ({
        sourceSchema,
        position,
        nonEmptyCount,
        distinctNonEmptyCount,
      }),
    );
  const observedEvidence = (mapping.sourceOccurrences ?? []).map(
    ({ sourceSchema, position, nonEmptyCount, distinctNonEmptyCount }) => ({
      sourceSchema,
      position,
      nonEmptyCount,
      distinctNonEmptyCount,
    }),
  );
  if (JSON.stringify(observedEvidence) !== JSON.stringify(expected)) {
    errors.push(`${mapping.rawHeader}: source occurrences drift from evidence`);
  }
  for (const occurrence of mapping.sourceOccurrences ?? []) {
    for (const key of [
      "canonicalFieldCode",
      "correctedMeaning",
      "ownerDomain",
      "targetObject",
    ]) {
      if (
        typeof occurrence[key] !== "string" ||
        occurrence[key].trim() === ""
      ) {
        errors.push(
          `${mapping.rawHeader}/${occurrence.sourceSchema}: missing ${key}`,
        );
      }
    }
  }
}
const unloadingMethodMapping = postDepartureMappings.find(
  ({ rawHeader }) => rawHeader === "卸柜方式",
);
const unloadingMethodBySource = Object.fromEntries(
  (unloadingMethodMapping?.sourceOccurrences ?? []).map((occurrence) => [
    occurrence.sourceSchema,
    occurrence.canonicalFieldCode,
  ]),
);
if (
  unloadingMethodBySource.logistics !==
    "container.unloading.planned_method_code" ||
  unloadingMethodBySource.warehouse !== "container.unloading.actual_method_code"
) {
  errors.push("卸柜方式 must retain distinct planned and actual semantics");
}
const mandatoryPostDepartureCodes = new Set([
  "upstream.replenishment_order.number",
  "container.number",
  "transport_document.source_bill_number",
  "shipment.ocean.carrier_code",
  "shipment.ocean.vessel_name",
  "shipment.ocean.voyage_number",
  "container.equipment_type_code",
  "shipment.route.port_of_loading_unlocode",
  "shipment.route.port_of_discharge_unlocode",
  "shipment.destination.warehouse_group_code",
  "shipment.departure.actual_at",
  "shipment.arrival.estimated_at",
  "container.cargo.carton_count",
  "container.cargo.volume_m3",
  "container.cargo.gross_weight_kg",
]);
for (const code of mandatoryPostDepartureCodes) {
  const mappings = postDepartureMappings.filter(
    ({ canonicalFieldCode }) => canonicalFieldCode === code,
  );
  if (
    mappings.length === 0 ||
    mappings.some(
      ({ profileRequired }) => !profileRequired.includes("post_departure_v1"),
    )
  ) {
    errors.push(`${code}: must be required by post_departure_v1`);
  }
}
const countryMapping = postDepartureMappings.find(
  ({ rawHeader }) => rawHeader === "销往国家",
);
if (
  countryMapping?.canonicalFieldCode !== "shipment.cargo_owner_name" ||
  countryMapping?.targetDisposition !== "typed_reference" ||
  countryMapping?.dataQualityRule !== "UNKNOWN_REFERENCE_CODE"
) {
  errors.push(
    "销往国家 must resolve as cargo owner identity, not a country field",
  );
}
if (
  cargoOwners?.status !== "owner_confirmed" ||
  cargoOwners?.records?.length !== 9 ||
  cargoOwners.records.find(
    ({ internalCountryShortCode }) => internalCountryShortCode === "UK",
  )?.salesCountryCode !== "GB"
) {
  errors.push(
    "cargo owner catalog must contain nine confirmed mappings and preserve UK -> GB",
  );
}
const brokenEtaMapping = postDepartureMappings.find(
  ({ rawHeader }) => rawHeader === "ETA修正",
);
if (
  brokenEtaMapping?.targetDisposition !== "quarantine" ||
  brokenEtaMapping?.dataQualityRule !== "INVALID_SOURCE_VALUE"
) {
  errors.push("ETA修正 must remain quarantined as an invalid source value");
}

const postDepartureDetailFixture = readJson(
  resolve(fixtureRoot, "post-departure-container-operational-source.json"),
);
const expectedDetailSources = (
  postDepartureFieldInventory?.sourceFiles ?? []
).filter(({ role }) => role === "read_only_detail_fixture");
const detailHeaders =
  postDepartureFieldInventory?.detailProjection?.headers ?? [];
const detailProjectionMappings =
  postDepartureFields?.detailProjectionMappings ?? [];
if (
  JSON.stringify(detailProjectionMappings.map(({ rawHeader }) => rawHeader)) !==
    JSON.stringify(detailHeaders) ||
  new Set(detailProjectionMappings.map(({ rawHeader }) => rawHeader)).size !==
    97
) {
  errors.push(
    "post-departure field registry must map each detail projection header exactly once",
  );
}
const permittedDetailOwnerDomains = new Set([
  "charges-settlement",
  "customs-compliance",
  "document-records",
  "inland-fulfillment",
  "lifecycle-control",
  "shipment-registry",
  "source-governance",
]);
for (const mapping of detailProjectionMappings) {
  if (
    mapping.authority !== "read_only_projection" ||
    !permittedDetailOwnerDomains.has(mapping.ownerDomain)
  ) {
    errors.push(
      `${mapping.rawHeader}: detail projection cannot introduce a new fact owner`,
    );
  }
}
if (
  postDepartureDetailFixture?.purpose !==
    "read_only_container_operational_view_reconciliation" ||
  postDepartureDetailFixture?.projectionContract !==
    "container_operational_view.v1"
) {
  errors.push(
    "post-departure detail fixture must remain a read-only container operational projection input",
  );
}
if (
  JSON.stringify(postDepartureDetailFixture?.headers) !==
    JSON.stringify(detailHeaders) ||
  detailHeaders.length !== 97
) {
  errors.push(
    "post-departure detail fixture must preserve all 97 source headers",
  );
}
if (
  postDepartureDetailFixture?.headerSignature !==
  postDepartureFieldInventory?.detailProjection?.headerSignature
) {
  errors.push("post-departure detail fixture header signature drifted");
}
const detailRecords = postDepartureDetailFixture?.records ?? [];
if (detailRecords.length !== 10) {
  errors.push("post-departure detail fixture must contain exactly 10 records");
}
for (const source of expectedDetailSources) {
  const record = detailRecords.find(
    ({ sourceFile }) => sourceFile === source.file,
  );
  if (!record) {
    errors.push(`${source.file}: missing detail reconciliation record`);
    continue;
  }
  if (
    record.sourceSha256 !== source.sha256 ||
    record.declaredRange !== source.declaredRange ||
    record.actualRange !== source.actualRange ||
    record.sourceSheet !== "货柜清关&物流状态详情"
  ) {
    errors.push(`${source.file}: detail fixture provenance drifted`);
  }
  if (
    JSON.stringify(Object.keys(record.values ?? {})) !==
    JSON.stringify(detailHeaders)
  ) {
    errors.push(`${source.file}: detail fixture does not preserve all columns`);
  }
  if (
    record.containerNumber !== record.values?.["集装箱号"] ||
    record.replenishmentOrderNumber !== record.values?.["备货单号"] ||
    record.billNumber !== record.values?.["提单号"]
  ) {
    errors.push(`${source.file}: detail fixture identity projection drifted`);
  }
  if (record.values?.["销往国家"] !== "AOSOM LLC") {
    errors.push(`${source.file}: known country semantic defect was altered`);
  }
}
for (const [label, observed, expected] of [
  [
    "containers",
    detailRecords.map(({ containerNumber }) => containerNumber).sort(),
    [
      ...(postDepartureFieldInventory?.detailProjection?.containerIds ?? []),
    ].sort(),
  ],
  [
    "replenishment orders",
    detailRecords
      .map(({ replenishmentOrderNumber }) => replenishmentOrderNumber)
      .sort(),
    [
      ...(postDepartureFieldInventory?.detailProjection
        ?.replenishmentOrderNumbers ?? []),
    ].sort(),
  ],
]) {
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    errors.push(`post-departure detail fixture ${label} drifted from evidence`);
  }
}

const lifecycleDateFactInboxKind =
  lifecycleTimeline?.$defs?.LifecycleDateFactInboxPayload?.properties?.kind
    ?.const;
if (lifecycleDateFactInboxKind !== LIFECYCLE_DATE_FACT_INBOX_KIND) {
  errors.push(
    "lifecycle date fact Inbox runtime kind differs from JSON Schema authority",
  );
}

if (
  JSON.stringify(importFields?.fields?.map(({ code }) => code)) !==
  JSON.stringify(expectedImportFieldCodes)
) {
  errors.push("import field catalog codes or order differ from V1.3 authority");
}
const expectedTimeFactCodes = [
  "customs_clearance_completed",
  "container_unloading_completed",
  "container_empty_confirmed",
  "container_empty_estimated",
];
if (
  JSON.stringify(importFields?.timeFacts?.map(({ code }) => code)) !==
  JSON.stringify(expectedTimeFactCodes)
) {
  errors.push("import time-fact codes or order differ from V1.3 authority");
}
const importFieldCodeSet = new Set(expectedImportFieldCodes);
for (const fact of importFields?.timeFacts ?? []) {
  if (!importFieldCodeSet.has(fact.timeFieldCode)) {
    errors.push(`${fact.code}: unknown timeFieldCode ${fact.timeFieldCode}`);
  }
  if (fact.statusFieldCode && !importFieldCodeSet.has(fact.statusFieldCode)) {
    errors.push(
      `${fact.code}: unknown statusFieldCode ${fact.statusFieldCode}`,
    );
  }
  if (
    fact.timeKind === "actual" &&
    (!fact.statusFieldCode || !fact.requiresEvidence)
  ) {
    errors.push(`${fact.code}: actual facts require status and evidence`);
  }
  if (
    fact.timeKind === "estimated" &&
    (fact.captureSource !== "system_derived" || !fact.requiresDerivationRule)
  ) {
    errors.push(`${fact.code}: estimated derived facts require a rule version`);
  }
}
if (
  JSON.stringify(importFields?.quantityUnits?.map(({ code }) => code)) !==
  JSON.stringify(expectedQuantityUnitCodes)
) {
  errors.push("import quantity-unit codes differ from V1.1 authority");
}
for (const item of [
  ...(importFields?.fields ?? []),
  ...(importFields?.quantityUnits ?? []),
]) {
  if (
    !item.label ||
    !Array.isArray(item.aliases) ||
    item.aliases.length === 0
  ) {
    errors.push(`import catalog entry ${item.code ?? "unknown"} is incomplete`);
  }
  const normalizedAliases = item.aliases.map((alias) =>
    alias.trim().toLowerCase(),
  );
  if (new Set(normalizedAliases).size !== normalizedAliases.length) {
    errors.push(`import catalog entry ${item.code} contains duplicate aliases`);
  }
}
const eventRoles = new Set([
  "milestone",
  "evidence",
  "exception",
  "prerequisite",
]);
const timeKinds = new Set(common?.$defs?.TimeKind?.enum ?? []);
const requiredEventCatalogProperties = [
  "eventCode",
  "eventVersion",
  "nameCn",
  "definition",
  "role",
  "ownerDomain",
  "defaultNodeCode",
  "allowedTimeKinds",
  "completionEligibleNodeCodes",
  "provenance",
];

if (nodes?.length !== 14)
  errors.push("lifecycle node catalog must contain 14 entries");
if (new Set(nodeCodes).size !== nodeCodes.length)
  errors.push("LifecycleNodeCode contains duplicates");
if (new Set(eventCodes).size !== eventCodes.length)
  errors.push("CanonicalEventCode contains duplicates");
if (
  JSON.stringify(nodes?.map((item) => item.sequence)) !==
  JSON.stringify(Array.from({ length: 14 }, (_, index) => index + 1))
) {
  errors.push("lifecycle node sequence must be exactly 1..14");
}
if (
  JSON.stringify(nodes?.map((item) => item.nodeCode)) !==
  JSON.stringify(nodeCodes)
) {
  errors.push("node catalog and LifecycleNodeCode enum differ");
}
for (const node of nodes ?? []) {
  if (!Object.hasOwn(node, "completionMode")) {
    errors.push(`${node.nodeCode}: missing catalog property completionMode`);
  } else if (!completionModes.has(node.completionMode)) {
    errors.push(
      `${node.nodeCode}: invalid completion mode ${node.completionMode}`,
    );
  }
}
if (
  JSON.stringify(events?.map((item) => item.eventCode)) !==
  JSON.stringify(eventCodes)
) {
  errors.push("event catalog and CanonicalEventCode enum differ");
}
for (const event of events ?? []) {
  for (const property of requiredEventCatalogProperties) {
    if (!Object.hasOwn(event, property))
      errors.push(`${event.eventCode}: missing catalog property ${property}`);
  }
  if (event.eventVersion !== 1)
    errors.push(`${event.eventCode}: eventVersion must be 1`);
  if (!eventRoles.has(event.role))
    errors.push(`${event.eventCode}: invalid event role ${event.role}`);
  for (const timeKind of event.allowedTimeKinds ?? []) {
    if (!timeKinds.has(timeKind))
      errors.push(`${event.eventCode}: invalid time kind ${timeKind}`);
  }
  if (event.completionEligibleNodeCodes?.length > 0) {
    for (const requiredTimeKind of ["planned", "estimated", "actual"]) {
      if (!event.allowedTimeKinds?.includes(requiredTimeKind)) {
        errors.push(
          `${event.eventCode}: completion-eligible events must allow ${requiredTimeKind}`,
        );
      }
    }
  }
  if (
    event.defaultNodeCode !== null &&
    !nodeCodes.includes(event.defaultNodeCode)
  ) {
    errors.push(
      `${event.eventCode}: unknown default node ${event.defaultNodeCode}`,
    );
  }
  if (
    new Set(event.completionEligibleNodeCodes).size !==
    event.completionEligibleNodeCodes.length
  ) {
    errors.push(`${event.eventCode}: duplicate completion target`);
  }
  for (const nodeCode of event.completionEligibleNodeCodes) {
    if (!nodeCodes.includes(nodeCode))
      errors.push(`${event.eventCode}: unknown node ${nodeCode}`);
  }
}

const canonicalEnvelope = readJson(
  resolve(schemaRoot, "canonical-event-envelope.schema.json"),
);
const requiredCanonicalEnvelopeProperties = [
  "eventId",
  "eventCode",
  "eventVersion",
  "tenantId",
  "containerId",
  "flowInstanceId",
  "nodeCode",
  "nodeInstanceId",
  "role",
  "timeKind",
  "occurredAt",
  "recordedAt",
  "eventSequence",
  "domain",
  "domainFactId",
  "domainFactType",
  "authorityPolicyRef",
  "correlationId",
  "idempotencyKey",
  "source",
  "evidenceRefs",
  "confidenceState",
  "validity",
  "data",
  "traceId",
];
for (const property of requiredCanonicalEnvelopeProperties) {
  if (!canonicalEnvelope?.properties?.[property])
    errors.push(`canonical event envelope missing property ${property}`);
  if (!canonicalEnvelope?.required?.includes(property))
    errors.push(`canonical event envelope must require ${property}`);
}
if (canonicalEnvelope?.properties?.eventType)
  errors.push("canonical event envelope must use eventCode, not eventType");

const actionCommand = readJson(
  resolve(schemaRoot, "action-command.schema.json"),
);
for (const property of ["tenantId", "correlationId", "traceId"]) {
  if (
    !actionCommand?.properties?.[property] ||
    !actionCommand?.required?.includes(property)
  ) {
    errors.push(`action command must require ${property}`);
  }
}
const actionDefinitionValidator = ajv.getSchema(
  `${schemaBaseUrl}action-command.schema.json#/$defs/ActionDefinition`,
);
if (ACTION_CATALOG_VERSION !== "1.0.0") {
  errors.push(
    `action catalog version must match GC-008 V1: ${ACTION_CATALOG_VERSION}`,
  );
}
const registeredActionCodes = new Set();
for (const definition of ACTION_DEFINITIONS) {
  if (!actionDefinitionValidator?.(definition)) {
    errors.push(
      `${definition.actionCode ?? "<unknown>"}: action definition schema validation failed: ${ajv.errorsText(actionDefinitionValidator?.errors)}`,
    );
  }
  if (registeredActionCodes.has(definition.actionCode)) {
    errors.push(`${definition.actionCode}: duplicate action catalog entry`);
  }
  registeredActionCodes.add(definition.actionCode);
}
const exportedActionCodes = Object.values(ACTION_CODES);
if (
  new Set(exportedActionCodes).size !== exportedActionCodes.length ||
  JSON.stringify([...registeredActionCodes].sort()) !==
    JSON.stringify([...exportedActionCodes].sort())
) {
  errors.push(
    "action catalog definitions must match the exported ACTION_CODES exactly",
  );
}

const operationalView = readJson(
  resolve(schemaRoot, "container-operational-view.schema.json"),
);
const nodeApplicabilityRef =
  operationalView?.$defs?.NodeSummary?.properties?.applicability?.$ref;
if (nodeApplicabilityRef !== "common.schema.json#/$defs/NodeApplicability") {
  errors.push(
    "NodeSummary applicability must reference the shared NodeApplicability definition",
  );
}

const manifest = readJson(resolve(fixtureRoot, "manifest.json"));
const scenarioFixtureValidator = ajv.getSchema(
  `${schemaBaseUrl}scenario-fixture.schema.json`,
);
const requiredScenarios = new Set([
  "success",
  "rejection",
  "boundary",
  "duplicate",
  "out_of_order",
  "correction",
  "revocation",
  "conflict",
]);
for (const file of manifest?.fixtures ?? []) {
  const path = resolve(fixtureRoot, file);
  if (!existsSync(path)) {
    errors.push(`missing fixture ${file}`);
    continue;
  }
  const fixture = readJson(path);
  if (!fixture) continue;
  if (!scenarioFixtureValidator?.(fixture)) {
    errors.push(
      `${file}: fixture schema validation failed: ${ajv.errorsText(scenarioFixtureValidator?.errors)}`,
    );
  }
  requiredScenarios.delete(fixture.scenario);
  if (
    !fixture.description ||
    !Array.isArray(fixture.inputs) ||
    fixture.inputs.length === 0 ||
    !fixture.expected?.outcome
  ) {
    errors.push(`${file}: incomplete fixture`);
  }
  for (const nodeCode of fixture.expected?.appliedNodeCodes ?? []) {
    if (!nodeCodes.includes(nodeCode))
      errors.push(`${file}: unknown applied node ${nodeCode}`);
  }
}
if (requiredScenarios.size)
  errors.push(`missing scenarios: ${[...requiredScenarios].join(", ")}`);

const schemaFixtureSuiteValidator = ajv.getSchema(
  `${schemaBaseUrl}schema-fixture-suite.schema.json`,
);
const contractsWithSchemaFixtures = new Set();
let schemaFixtureCaseCount = 0;
for (const file of manifest?.schemaFixtures ?? []) {
  const path = resolve(fixtureRoot, file);
  if (!existsSync(path)) {
    errors.push(`missing schema fixture suite ${file}`);
    continue;
  }
  const suite = readJson(path);
  if (!suite) continue;
  if (!schemaFixtureSuiteValidator?.(suite)) {
    errors.push(
      `${file}: schema fixture suite validation failed: ${ajv.errorsText(schemaFixtureSuiteValidator?.errors)}`,
    );
    continue;
  }
  for (const fixtureCase of suite.cases) {
    schemaFixtureCaseCount += 1;
    contractsWithSchemaFixtures.add(fixtureCase.contractId);
    const coveredFiles = new Set(
      (index?.["x-contracts"]?.[fixtureCase.contractId] ?? []).map(
        (schemaRef) => schemaRef.split("#", 1)[0],
      ),
    );
    if (!coveredFiles.has(fixtureCase.schemaRef.split("#", 1)[0])) {
      errors.push(
        `${file}/${fixtureCase.name}: ${fixtureCase.schemaRef} is not registered for ${fixtureCase.contractId}`,
      );
      continue;
    }
    let validate;
    try {
      validate = ajv.getSchema(
        new URL(fixtureCase.schemaRef, schemaBaseUrl).href,
      );
    } catch (error) {
      errors.push(
        `${file}/${fixtureCase.name}: invalid schema ref: ${error.message}`,
      );
      continue;
    }
    if (!validate) {
      errors.push(
        `${file}/${fixtureCase.name}: schema ref did not compile: ${fixtureCase.schemaRef}`,
      );
    } else {
      const expectedValid = fixtureCase.valid !== false;
      const actualValid = validate(fixtureCase.data);
      if (actualValid !== expectedValid) {
        errors.push(
          `${file}/${fixtureCase.name}: expected ${expectedValid ? "valid" : "invalid"} data: ${ajv.errorsText(validate.errors)}`,
        );
      }
    }
  }
}
for (const contractId of expectedContractIds) {
  if (!contractsWithSchemaFixtures.has(contractId))
    errors.push(`${contractId}: missing schema fixture case`);
}

const compatibilitySurface = (value, pointer = "#", output = new Map()) => {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value.enum))
    output.set(`${pointer}/enum`, new Set(value.enum));
  if (Array.isArray(value.required))
    output.set(`${pointer}/required`, new Set(value.required));
  if (typeof value.type === "string") output.set(`${pointer}/type`, value.type);
  if (Array.isArray(value.type))
    output.set(`${pointer}/type`, new Set(value.type));
  for (const [key, child] of Object.entries(value)) {
    compatibilitySurface(
      child,
      `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
      output,
    );
  }
  return output;
};

const resolveReplacementSurface = (schemaPath, document, pointer) => {
  const keywordAt = pointer.lastIndexOf("/");
  const parentPointer = pointer.slice(0, keywordAt);
  const keyword = pointer.slice(keywordAt + 1);
  const replacement = resolvePointer(document, parentPointer);
  if (!replacement?.$ref) return undefined;

  const hashAt = replacement.$ref.indexOf("#");
  const targetPart =
    hashAt < 0 ? replacement.$ref : replacement.$ref.slice(0, hashAt);
  const fragment = hashAt < 0 ? "" : replacement.$ref.slice(hashAt);
  const targetPath = targetPart
    ? resolve(dirname(schemaPath), targetPart)
    : schemaPath;
  const target = schemas.get(targetPath);
  return resolvePointer(target, fragment)?.[keyword];
};

for (const path of schemaFiles) {
  const repositoryPath = relative(root, path).replaceAll("\\", "/");
  let previous;
  try {
    previous = JSON.parse(
      execFileSync("git", ["show", `HEAD:${repositoryPath}`], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    continue;
  }
  const before = compatibilitySurface(previous);
  const current = readJson(path);
  const after = compatibilitySurface(current);
  for (const [pointer, oldValue] of before) {
    const newValue = after.get(pointer);
    if (oldValue instanceof Set) {
      const replacementValue = resolveReplacementSurface(
        path,
        current,
        pointer,
      );
      const replacementSet = Array.isArray(replacementValue)
        ? new Set(replacementValue)
        : undefined;
      for (const item of oldValue) {
        if (
          (!(newValue instanceof Set) || !newValue.has(item)) &&
          (!replacementSet || !replacementSet.has(item))
        ) {
          const key = `${repositoryPath}|${pointer}|${item}`;
          if (declaredBreakingChanges.has(key))
            observedBreakingChanges.add(key);
          else
            errors.push(
              `${repositoryPath}: breaking removal at ${pointer}: ${item}`,
            );
        }
      }
    } else if (newValue instanceof Set && newValue.has(oldValue)) {
      continue;
    } else if (
      newValue !== oldValue &&
      resolveReplacementSurface(path, current, pointer) !== oldValue
    ) {
      errors.push(
        `${repositoryPath}: breaking type change at ${pointer}: ${oldValue} -> ${newValue}`,
      );
    }
  }
}

for (const key of declaredBreakingChanges) {
  if (!observedBreakingChanges.has(key))
    errors.push(`unused pre-release breaking-change exception: ${key}`);
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Contract schemas valid: ${schemaFiles.length} schemas, ${nodes.length} nodes, ${events.length} events, ${manifest.fixtures.length} scenarios, ${schemaFixtureCaseCount} schema fixtures.`,
  );
}
