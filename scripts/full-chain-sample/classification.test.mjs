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
test("real provenance columns classify S and D without a row evidence grade", () => {
  const scan = {
    sheets: [
      {
        name: "25_推导依据",
        rows: [
          {
            valuesByHeader: {
              编号: "DERIVE-DEMO-001",
              性质: "推导",
              "支撑的样本表/字段": "09_出运计划/订舱号/SO",
            },
          },
        ],
      },
      {
        name: "26_样本构建清单",
        rows: [
          {
            valuesByHeader: {
              工作表: "09_出运计划",
              行: "ROW-A / ROW-B",
              字段: "柜号",
              值: "CONT-DEMO-001",
              构建依据: "constructed-chain",
            },
          },
        ],
      },
      { name: "23_待确认", rows: [] },
    ],
  };
  const indexes = buildProvenanceIndexes(scan, {
    pilotMappings: [
      {
        sheet: "09_出运计划",
        payload: { bookingNo: "订舱号/SO", containerRefs: "柜号" },
        fieldPolicy: {
          柜号: { directSource: true, constructionOverrideAllowed: true },
          "订舱号/SO": {
            directSource: false,
            constructionOverrideAllowed: false,
          },
        },
      },
    ],
  });
  assert.equal(
    classifyMappedValue({
      indexes,
      sheet: "09_出运计划",
      identity: "PLAN-DEMO-001",
      rowKey: "ROW-A / ROW-B",
      field: "柜号",
    }).evidenceClass,
    "S",
  );
  assert.equal(
    classifyMappedValue({
      indexes,
      sheet: "09_出运计划",
      identity: "PLAN-DEMO-001",
      rowKey: "OTHER/ROW",
      field: "订舱号/SO",
    }).evidenceClass,
    "D",
  );
});
test("single-column derivation support binds only exact mapped fields", () => {
  const scan = {
    sheets: [
      {
        name: "25_推导依据",
        rows: [
          {
            valuesByHeader: {
              编号: "DERIVE-EXACT",
              性质: "推导",
              "支撑的样本表/字段": "12_出运/航次",
            },
          },
          {
            valuesByHeader: {
              编号: "DERIVE-VAGUE",
              性质: "推导",
              "支撑的样本表/字段": "说明：跨表参考",
            },
          },
        ],
      },
      { name: "26_样本构建清单", rows: [] },
      { name: "23_待确认", rows: [] },
    ],
  };
  const indexes = buildProvenanceIndexes(scan, {
    pilotMappings: [
      {
        recordType: "dispatch_fact",
        sheet: "12_出运",
        payload: { voyageNo: "航次", vesselName: "船名" },
        fieldPolicy: {},
      },
    ],
  });
  assert.deepEqual(
    [...indexes.derivationBindings.get("12_出运|航次")],
    ["DERIVE-EXACT"],
  );
  assert.equal(indexes.derivationBindings.has("说明：跨表参考"), false);
  assert.equal(
    classifyMappedValue({
      indexes,
      sheet: "12_出运",
      identity: "CONT-FIXTURE",
      field: "航次",
      sourceRef: "12_出运#7",
    }).evidenceClass,
    "D",
  );
});
test("construction evidence matches raw value and folds exact duplicates", () => {
  const makeScan = (rows) => ({
    sheets: [
      { name: "25_推导依据", rows: [] },
      { name: "23_待确认", rows: [] },
      { name: "26_样本构建清单", rows },
    ],
  });
  const policy = {
    pilotMappings: [
      {
        sheet: "11_装箱",
        payload: { houseBillNo: "分提单" },
        fieldPolicy: {
          houseBillNo: {
            directSource: true,
            constructionOverrideAllowed: true,
          },
        },
      },
    ],
  };
  const duplicateRow = {
    valuesByHeader: {
      工作表: "11_装箱",
      行: "CONT-A / 1",
      字段: "分提单",
      值: "HBL-A",
      构建依据: "fixture",
    },
  };
  const folded = buildProvenanceIndexes(
    makeScan([duplicateRow, structuredClone(duplicateRow)]),
    policy,
  );
  assert.equal(folded.provenanceConflicts.size, 0);
  assert.equal(
    classifyMappedValue({
      indexes: folded,
      sheet: "11_装箱",
      rowKey: "CONT-A / 1",
      identity: "CONT-A",
      field: "分提单",
      rawValue: "HBL-A",
      sourceRef: "11_装箱#7",
      fieldPolicy: policy.pilotMappings[0].fieldPolicy.houseBillNo,
    }).evidenceClass,
    "S",
  );
  const distinctCandidates = buildProvenanceIndexes(
    makeScan([
      duplicateRow,
      {
        ...duplicateRow,
        valuesByHeader: { ...duplicateRow.valuesByHeader, 值: "HBL-B" },
      },
    ]),
    policy,
  );
  assert.equal(distinctCandidates.provenanceConflicts.size, 0);
  assert.equal(
    classifyMappedValue({
      indexes: distinctCandidates,
      sheet: "11_装箱",
      rowKey: "CONT-A / 1",
      identity: "CONT-A",
      field: "分提单",
      rawValue: "HBL-A",
      sourceRef: "11_装箱#7",
      fieldPolicy: policy.pilotMappings[0].fieldPolicy.houseBillNo,
    }).evidenceClass,
    "S",
  );
});

test("construction evidence keeps different raw values as distinct candidates", () => {
  const policy = {
    pilotMappings: [
      {
        sheet: "11_装箱",
        payload: { houseBillNo: "分提单" },
        fieldPolicy: {
          houseBillNo: {
            directSource: true,
            constructionOverrideAllowed: true,
          },
        },
      },
    ],
  };
  const indexes = buildProvenanceIndexes(
    {
      sheets: [
        {
          name: "26_样本构建清单",
          rows: [
            {
              valuesByHeader: {
                工作表: "11_装箱",
                行: "CONT-A / 1",
                字段: "分提单",
                值: "HBL-A",
                构建依据: "sku-a",
              },
            },
            {
              valuesByHeader: {
                工作表: "11_装箱",
                行: "CONT-A / 1",
                字段: "分提单",
                值: "HBL-B",
                构建依据: "sku-b",
              },
            },
          ],
        },
        { name: "25_推导依据", rows: [] },
        { name: "23_待确认", rows: [] },
      ],
    },
    policy,
  );
  assert.equal(indexes.provenanceConflicts.size, 0);
  const classify = (rawValue) =>
    classifyMappedValue({
      indexes,
      sheet: "11_装箱",
      rowKey: "CONT-A / 1",
      field: "分提单",
      rawValue,
      sourceRef: "11_装箱#7",
      fieldPolicy: policy.pilotMappings[0].fieldPolicy.houseBillNo,
    });
  assert.equal(classify("HBL-A").evidenceClass, "S");
  assert.equal(classify("HBL-B").evidenceClass, "S");
});

test("construction evidence conflicts when the selected raw value has different bases", () => {
  const policy = {
    pilotMappings: [
      {
        sheet: "11_装箱",
        payload: { houseBillNo: "分提单" },
        fieldPolicy: {
          houseBillNo: {
            directSource: true,
            constructionOverrideAllowed: true,
          },
        },
      },
    ],
  };
  const indexes = buildProvenanceIndexes(
    {
      sheets: [
        {
          name: "26_样本构建清单",
          rows: [
            {
              valuesByHeader: {
                工作表: "11_装箱",
                行: "CONT-A / 1",
                字段: "分提单",
                值: "HBL-A",
                构建依据: "sku-a",
              },
            },
            {
              valuesByHeader: {
                工作表: "11_装箱",
                行: "CONT-A / 1",
                字段: "分提单",
                值: "HBL-A",
                构建依据: "sku-b",
              },
            },
          ],
        },
        { name: "25_推导依据", rows: [] },
        { name: "23_待确认", rows: [] },
      ],
    },
    policy,
  );
  assert.equal(indexes.provenanceConflicts.size, 1);
  assert.equal(
    classifyMappedValue({
      indexes,
      sheet: "11_装箱",
      rowKey: "CONT-A / 1",
      field: "分提单",
      rawValue: "HBL-A",
      sourceRef: "11_装箱#7",
      fieldPolicy: policy.pilotMappings[0].fieldPolicy.houseBillNo,
    }).code,
    "PROVENANCE_CONFLICT",
  );
});

test("v0.5 policy is exactly 33 sheets and rejects unauthorized rules", () => {
  const policy = loadCompilerPolicy(
    fileURLToPath(new URL("./policies/v0.5.json", import.meta.url)),
  );
  assert.equal(policy.sheets.length, 33);
  assert.equal(new Set(policy.sheets.map((sheet) => sheet.name)).size, 33);
  const dispatch = policy.pilotMappings.find(
    (mapping) => mapping.recordType === "dispatch_fact",
  );
  assert.deepEqual(dispatch.fieldPolicy.gateInDate.normalization, {
    precision: "date",
    timezone: "+08:00",
    formats: ["iso-date", "m/d/yyyy", "datetime-seconds"],
  });
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
