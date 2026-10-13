import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import {
  loadOwnershipCatalog,
  validateCatalogAgainstDmmf,
} from "./ownership-catalog.mjs";

const require = createRequire(import.meta.url);
const { Prisma } = require("../../generated/prisma");

test("every Prisma model has exactly one ownership rule", () => {
  const catalog = loadOwnershipCatalog(
    "scripts/full-chain-demo/ownership-catalog.json",
  );
  assert.doesNotThrow(() => validateCatalogAgainstDmmf(catalog, Prisma.dmmf));
});

test("catalog drift fails closed", () => {
  const catalog = loadOwnershipCatalog(
    "scripts/full-chain-demo/ownership-catalog.json",
  );
  const missing = structuredClone(catalog);
  delete missing.models.Product;
  assert.throws(
    () => validateCatalogAgainstDmmf(missing, Prisma.dmmf),
    /OWNERSHIP_CATALOG_DRIFT/,
  );
});

test("all 13 indirect ownership chains match the approved catalog", () => {
  const catalog = loadOwnershipCatalog(
    "scripts/full-chain-demo/ownership-catalog.json",
  );
  const expected = {
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
  const indirect = Object.fromEntries(
    Object.entries(catalog.models)
      .filter(([, rule]) => rule.rule === "via_parent")
      .map(([model, rule]) => [model, [rule.parentModel, rule.foreignKey]]),
  );

  assert.deepEqual(indirect, expected);
});

test("NodeEventApplication cannot lose its event-side tenant resolver", () => {
  const catalog = loadOwnershipCatalog(
    "scripts/full-chain-demo/ownership-catalog.json",
  );
  const drifted = structuredClone(catalog);
  delete drifted.models.NodeEventApplication.resolver;

  assert.throws(
    () => validateCatalogAgainstDmmf(drifted, Prisma.dmmf),
    /OWNERSHIP_CATALOG_DRIFT:NodeEventApplication/,
  );
});

test("approved ownership partitions cannot be reclassified", () => {
  const catalog = loadOwnershipCatalog(
    "scripts/full-chain-demo/ownership-catalog.json",
  );
  for (const [model, rule] of [
    ["Product", "preserve_global"],
    ["ReferenceDataRelease", "direct_tenant"],
    ["ImportRow", "preserve_global"],
  ]) {
    const drifted = structuredClone(catalog);
    drifted.models[model].rule = rule;
    assert.throws(
      () => validateCatalogAgainstDmmf(drifted, Prisma.dmmf),
      new RegExp(`OWNERSHIP_CATALOG_DRIFT:${model}`),
    );
  }
});

test("full-chain landing models remain tenant-owned and child-first", () => {
  const catalog = loadOwnershipCatalog(
    "scripts/full-chain-demo/ownership-catalog.json",
  );
  const expectedRanks = {
    FullChainLandingRun: 100,
    FullChainShipmentPlan: 200,
    FullChainBookingCommitment: 300,
    FullChainBookingDocument: 400,
    FullChainCargoReadyRelease: 200,
    FullChainShipmentPlanCargoReady: 500,
    FullChainStuffingLine: 500,
    FullChainExportCustomsCase: 500,
    FullChainDispatchFact: 500,
    FullChainDispatchHouseBill: 600,
    FullChainLandingRecordReceipt: 200,
    FullChainLandingGap: 200,
  };
  for (const [model, deleteRank] of Object.entries(expectedRanks)) {
    assert.deepEqual(catalog.models[model], {
      table: catalog.models[model].table,
      rule: "direct_tenant",
      tenantField: "tenantId",
      deleteRank,
    });
  }
  for (const [child, parent] of [
    ["FullChainShipmentPlan", "FullChainLandingRun"],
    ["FullChainBookingCommitment", "FullChainShipmentPlan"],
    ["FullChainBookingDocument", "FullChainBookingCommitment"],
    ["FullChainShipmentPlanCargoReady", "FullChainCargoReadyRelease"],
    ["FullChainStuffingLine", "FullChainBookingDocument"],
    ["FullChainExportCustomsCase", "FullChainBookingDocument"],
    ["FullChainDispatchHouseBill", "FullChainDispatchFact"],
  ]) {
    assert.ok(
      catalog.models[child].deleteRank > catalog.models[parent].deleteRank,
      `${child} must delete before ${parent}`,
    );
  }
});

test("catalog delete ranks place every declared child before its parent", () => {
  const catalog = loadOwnershipCatalog(
    "scripts/full-chain-demo/ownership-catalog.json",
  );
  for (const [model, rule] of Object.entries(catalog.models)) {
    if (rule.rule !== "via_parent") continue;
    const parent = catalog.models[rule.parentModel];
    assert.ok(parent, `${model} parent is declared`);
    assert.ok(
      rule.deleteRank > (parent.deleteRank ?? 0),
      `${model} must delete before ${rule.parentModel}`,
    );
  }
});
