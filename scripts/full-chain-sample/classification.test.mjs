import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildProvenanceIndexes,
  classifyMappedValue,
} from "./classification.mjs";
import { loadCompilerPolicy } from "./policy.mjs";
import { validatePolicy } from "./contracts.mjs";

function input(overrides = {}) {
  return {
    indexes: {
      constructed: new Map(),
      derivations: new Map([["DERIVE-DEMO-001", { version: "v1" }]]),
      pending: new Set(),
      constructionOverrides: new Set(),
    },
    sheet: "09_出运计划",
    identity: "PLAN-DEMO-001",
    field: "出运计划编号",
    declaredClass: "R",
    sourceRef: "source-ref",
    ...overrides,
  };
}
test("constructed values are scenario evidence", () => {
  const indexes = input().indexes;
  indexes.constructed.set("09_出运计划|PLAN-DEMO-001|出运计划编号", {});
  indexes.constructionOverrides.add("09_出运计划|出运计划编号");
  assert.deepEqual(
    classifyMappedValue({ ...input(), indexes, declaredClass: "S" }),
    {
      evidenceClass: "S",
      scenario: {
        label: "constructed-chain",
        allowedUse: "local_demo_rehearsal",
      },
    },
  );
});

test("constructed scenario values require an explicit construction override", () => {
  const indexes = input().indexes;
  indexes.constructed.set("09_出运计划|PLAN-DEMO-001|出运计划编号", {});
  assert.equal(
    classifyMappedValue({ ...input(), indexes, declaredClass: "S" }).kind,
    "gap",
  );
});
test("scenario evidence requires a matching construction index", () => {
  assert.equal(classifyMappedValue(input({ declaredClass: "S" })).kind, "gap");
});
test("derived values require a derivation reference", () =>
  assert.throws(
    () =>
      classifyMappedValue(input({ declaredClass: "D", derivationRef: null })),
    /DERIVATION_REQUIRED/,
  ));
test("derived values require an approved derivation nature", () => {
  const indexes = input().indexes;
  indexes.derivations.set("DERIVE-CANDIDATE", { version: "v1", kind: "候选" });
  assert.equal(
    classifyMappedValue(
      input({ declaredClass: "D", derivationRef: "DERIVE-CANDIDATE", indexes }),
    ).kind,
    "gap",
  );
});
test("duplicate provenance keys become order-independent conflicts", () => {
  const makeScan = (rows) => ({
    sheets: [
      { name: "25_推导依据", rows },
      { name: "26_样本构建清单", rows: [] },
      { name: "23_待确认", rows: [] },
    ],
  });
  const rows = [
    { valuesByHeader: { 推导依据ID: "DUP", 性质: "候选" } },
    { valuesByHeader: { 推导依据ID: "DUP", 性质: "推导" } },
  ];
  const first = buildProvenanceIndexes(makeScan(rows), { pilotMappings: [] });
  const second = buildProvenanceIndexes(makeScan(rows.reverse()), {
    pilotMappings: [],
  });
  assert.deepEqual([...first.provenanceConflicts], ["derivation:DUP"]);
  assert.deepEqual([...second.provenanceConflicts], ["derivation:DUP"]);
  for (const indexes of [first, second])
    assert.equal(
      classifyMappedValue({
        indexes,
        sheet: "S",
        identity: "I",
        field: "f",
        declaredClass: "D",
        derivationRef: "DUP",
        sourceRef: "S#1",
      }).kind,
      "gap",
    );
});
test("pending and unclassified values become gaps", () => {
  assert.equal(classifyMappedValue(input({ declaredClass: "P" })).kind, "gap");
  assert.equal(classifyMappedValue(input({ declaredClass: null })).kind, "gap");
});

test("R requires an explicit approved source reference", () => {
  assert.equal(classifyMappedValue(input({ sourceRef: null })).kind, "gap");
  assert.equal(
    classifyMappedValue(input({ declaredClass: "UNKNOWN" })).kind,
    "gap",
  );
});

test("R is blocked when the policy does not approve the field", () => {
  const indexes = input().indexes;
  indexes.approvedDirectSources = new Set();
  assert.equal(classifyMappedValue({ ...input(), indexes }).kind, "gap");
});

test("v0.5 policy is exactly 33 sheets and rejects unauthorized rules", () => {
  const policy = loadCompilerPolicy(
    fileURLToPath(new URL("./policies/v0.5.json", import.meta.url)),
  );
  assert.equal(policy.sheets.length, 33);
  assert.equal(new Set(policy.sheets.map((sheet) => sheet.name)).size, 33);
  assert.throws(
    () =>
      validatePolicy({
        policyVersion: "fixture-policy.v1",
        sheets: [{ name: "09_出运计划", headerRow: 6, disposition: "records" }],
        pilotMappings: [
          {
            recordType: "shipment_plan",
            sheet: "09_出运计划",
            identity: ["出运计划编号"],
            payload: { planNo: "出运计划编号" },
            fieldPolicy: {
              planNo: {
                directSource: true,
                constructionOverrideAllowed: false,
              },
            },
            conversationOnly: true,
          },
        ],
      }),
    /POLICY_INVALID/,
  );
});

export { input };
