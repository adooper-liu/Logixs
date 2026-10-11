import fs from "node:fs";
import { createRequire } from "node:module";
import { sha256Hex } from "./canonical-json.mjs";

const require = createRequire(import.meta.url);
const catalogSchema = require("./schemas/ownership-catalog.schema.json");

const PRESERVED_MODELS = new Set([
  "ReferenceDataRelease",
  "CurrencyCodeReference",
  "CountryCodeReference",
  "CargoOwnerReference",
  "UnlocodeAreaReference",
  "PortCodeReference",
  "PortCodeEntry",
  "PortNameAlias",
  "SourceAuthorityPolicy",
]);
const INDIRECT_MODELS = {
  OceanRoutePlan: ["ContainerRecord", "containerId"],
  OceanRouteSegment: ["OceanRoutePlan", "routePlanId"],
  EvidenceVerificationDecision: ["EvidenceRecord", "evidenceId"],
  ImportRow: ["ImportBatch", "batchId"],
  ImportReview: ["ImportBatch", "batchId"],
  ImportRowResult: ["ImportBatch", "batchId"],
  FlowInstance: ["Shipment", "shipmentId"],
  NodeInstance: ["FlowInstance", "flowInstanceId"],
  NodeApplicabilityDecision: ["FlowInstance", "flowInstanceId"],
  NodeEventApplication: ["NodeInstance", "targetNodeInstanceId"],
  WorkOrder: ["NodeTask", "nodeTaskId"],
  NodeTaskOutcome: ["NodeTask", "nodeTaskId"],
  OpsAssistantMessage: ["OpsAssistantSession", "sessionId"],
};

function fail(code, detail = "") {
  throw new Error(`${code}${detail ? `:${detail}` : ""}`);
}

export function loadOwnershipCatalog(path) {
  const catalog = JSON.parse(fs.readFileSync(path, "utf8"));
  if (
    catalog.catalogVersion !== "full-chain-demo-ownership.v1" ||
    !catalog.models
  )
    fail("OWNERSHIP_CATALOG_INVALID");
  return catalog;
}

export function validateCatalogAgainstDmmf(catalog, dmmf) {
  if (!catalog || !dmmf?.datamodel?.models) fail("OWNERSHIP_CATALOG_INVALID");
  const models = dmmf.datamodel.models;
  const rules = catalog.models;
  const modelNames = new Set(models.map((model) => model.name));
  for (const model of models) {
    const rule = rules[model.name];
    if (!rule) fail("OWNERSHIP_CATALOG_DRIFT", model.name);
    const indirect = INDIRECT_MODELS[model.name];
    const expectedRule = PRESERVED_MODELS.has(model.name)
      ? "preserve_global"
      : indirect
        ? "via_parent"
        : model.fields.some((field) => field.name === "tenantId")
          ? "direct_tenant"
          : null;
    if (!expectedRule || rule.rule !== expectedRule)
      fail("OWNERSHIP_CATALOG_DRIFT", model.name);
    if (
      indirect &&
      (rule.parentModel !== indirect[0] || rule.foreignKey !== indirect[1])
    )
      fail("OWNERSHIP_CATALOG_DRIFT", model.name);
    if (rule.table !== (model.dbName ?? model.name))
      fail("OWNERSHIP_CATALOG_DRIFT", model.name);
    if (
      rule.rule === "direct_tenant" &&
      !model.fields.some((field) => field.name === "tenantId")
    )
      fail("OWNERSHIP_CATALOG_DRIFT", model.name);
    if (rule.rule === "via_parent") {
      const parent = models.find(
        (candidate) => candidate.name === rule.parentModel,
      );
      if (
        !parent ||
        !model.fields.some((field) => field.name === rule.foreignKey) ||
        !parent.fields.some((field) => field.name === rule.parentKey)
      )
        fail("OWNERSHIP_CATALOG_DRIFT", model.name);
    }
    if (
      model.name === "NodeEventApplication" &&
      (rule.rule !== "via_parent" ||
        rule.parentModel !== "NodeInstance" ||
        rule.foreignKey !== "targetNodeInstanceId" ||
        rule.parentKey !== "id" ||
        rule.resolver !== "node_event_dual_tenant" ||
        !model.fields.some((field) => field.name === "eventId") ||
        !models
          .find((candidate) => candidate.name === "CanonicalEvent")
          ?.fields.some((field) => field.name === "tenantId"))
    )
      fail("OWNERSHIP_CATALOG_DRIFT", model.name);
  }
  for (const name of Object.keys(rules))
    if (!modelNames.has(name)) fail("OWNERSHIP_CATALOG_DRIFT", name);
  return undefined;
}

export function catalogHash(catalog) {
  return sha256Hex(catalog);
}
export { catalogSchema };
