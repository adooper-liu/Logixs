import assert from "node:assert/strict";
import test from "node:test";
import {
  compilePilotRecords,
  normalizeCode,
  normalizeDate,
  normalizeDecimal,
  normalizeList,
} from "./compile-records.mjs";
import { runPackageChecks } from "./reconcile.mjs";
import { createV05LikeScan } from "./test-support.mjs";
import { buildProvenanceIndexes } from "./classification.mjs";
import { fileURLToPath } from "node:url";
import { loadCompilerPolicy } from "./policy.mjs";

const policy = {
  pilotMappings: [
    {
      recordType: "shipment_plan",
      sheet: "09_出运计划",
      identity: ["出运计划编号"],
      payload: { planNo: "出运计划编号" },
    },
  ],
};
const scan = {
  sheets: [
    {
      name: "09_出运计划",
      rows: [
        {
          workbookRow: 7,
          valuesByHeader: { 出运计划编号: "PLAN-DEMO-001", 证据等级: "R" },
        },
      ],
    },
  ],
};
test("compiler emits stable pilot records", () => {
  const result = compilePilotRecords({ scan, policy });
  assert.equal(result.records[0].businessKey, "PLAN-DEMO-001");
  assert.equal(result.records[0].evidenceClass, "R");
  assert.equal(result.publishable, true);
});
test("missing identity becomes a blocking gap", () => {
  const result = compilePilotRecords({
    scan: {
      sheets: [
        { name: "09_出运计划", rows: [{ workbookRow: 7, valuesByHeader: {} }] },
      ],
    },
    policy,
  });
  assert.equal(result.records.length, 0);
  assert.equal(result.publishable, false);
});

test("missing evidence grade never becomes an R record", () => {
  const result = compilePilotRecords({
    scan: {
      sheets: [
        {
          name: "09_出运计划",
          rows: [
            {
              workbookRow: 7,
              valuesByHeader: { 出运计划编号: "PLAN-DEMO-002" },
            },
          ],
        },
      ],
    },
    policy,
  });
  assert.equal(result.records.length, 0);
  assert.equal(result.gaps[0].code, "PROVENANCE_PENDING");
});
test("real pilot headers classify direct and constructed fields without evidence columns", () => {
  const result = compilePilotRecords({
    policy: {
      policyVersion: "full-chain-policy.v0.5",
      pilotMappings: [
        {
          recordType: "shipment_plan",
          sheet: "09_出运计划",
          identity: ["合并备货单"],
          payload: {
            planNo: "合并备货单",
            bookingNo: "订舱号/SO",
            containerRefs: "柜号",
          },
          fieldPolicy: {
            planNo: { directSource: true, constructionOverrideAllowed: false },
            bookingNo: {
              directSource: true,
              constructionOverrideAllowed: false,
            },
            containerRefs: {
              directSource: true,
              constructionOverrideAllowed: true,
            },
          },
        },
      ],
    },
    scan: {
      sheets: [
        {
          name: "09_出运计划",
          rows: [
            {
              workbookRow: 7,
              rowKey: "ROW-A / ROW-B",
              valuesByHeader: {
                合并备货单: "PLAN-DEMO-REAL",
                "订舱号/SO": "BOOK-DEMO-REAL",
                柜号: "CONT-DEMO-REAL",
              },
            },
          ],
        },
      ],
    },
    indexes: {
      constructed: new Map([
        ["09_出运计划|ROW-A / ROW-B|柜号", { label: "constructed-chain" }],
      ]),
      derivations: new Map(),
      derivationBindings: new Map(),
      pending: new Set(),
      constructionOverrides: new Set(["09_出运计划|柜号"]),
      approvedDirectSources: new Set(["09_出运计划|合并备货单"]),
      provenanceConflicts: new Set(),
    },
  });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].evidenceClass, "S");
});
test("customs item rows are informational and do not block publishing", () => {
  const result = compilePilotRecords({
    policy: {
      policyVersion: "full-chain-policy.v0.5",
      pilotMappings: [
        {
          recordType: "export_customs_case",
          sheet: "11a_出口报关",
          identity: ["报关发票号"],
          rowFilter: { 层级: "报关票" },
          payload: { invoiceNo: "报关发票号" },
          fieldPolicy: {
            invoiceNo: {
              directSource: true,
              constructionOverrideAllowed: false,
            },
          },
        },
      ],
    },
    scan: {
      sheets: [
        {
          name: "11a_出口报关",
          rows: [
            {
              workbookRow: 7,
              valuesByHeader: {
                层级: "品名行",
                报关发票号: "INVOICE-DEMO-ITEM",
              },
            },
          ],
        },
      ],
    },
  });
  assert.equal(result.records.length, 0);
  assert.equal(result.gaps[0].status, "informational");
  assert.equal(result.publishable, true);
});
test("v0.5-like fixture compiles six records with R/D/S/P provenance", () => {
  const policy = loadCompilerPolicy(
    fileURLToPath(new URL("./policies/v0.5.json", import.meta.url)),
  );
  const scan = createV05LikeScan();
  assert.deepEqual(
    scan.sheets.map((sheet) => sheet.name),
    policy.sheets.map((sheet) => sheet.name),
  );
  const indexes = buildProvenanceIndexes(scan, policy);
  const result = compilePilotRecords({ scan, policy, indexes });
  assert.equal(result.records.length, 6);
  assert.deepEqual(
    new Set(result.records.map((record) => record.evidenceClass)),
    new Set(["R", "D", "S"]),
  );
  assert.equal(indexes.pending.has("P-FIXTURE-001"), true);
  assert.equal(
    result.records.some((record) => record.evidenceClass === "P"),
    false,
  );
  assert.equal(
    result.gaps.some((gap) => gap.status === "blocking"),
    false,
  );
});
test("general text fields do not use stable-code normalization", () => {
  const result = compilePilotRecords({
    policy: {
      policyVersion: "full-chain-policy.v0.5",
      pilotMappings: [
        {
          recordType: "dispatch_fact",
          sheet: "12_出运",
          identity: ["柜号"],
          payload: { containerNo: "柜号", vesselName: "船名" },
          fieldPolicy: {
            containerNo: {
              directSource: true,
              constructionOverrideAllowed: false,
            },
            vesselName: {
              directSource: true,
              constructionOverrideAllowed: false,
            },
          },
        },
      ],
    },
    scan: {
      sheets: [
        {
          name: "12_出运",
          rows: [
            {
              workbookRow: 7,
              valuesByHeader: { 柜号: "CONT-TEXT", 船名: "MV BLUE OCEAN" },
            },
          ],
        },
      ],
    },
  });
  assert.equal(result.records[0].payload.vesselName, "MV BLUE OCEAN");
});
test("unsupported provenance conflicts do not block pilot compilation", () => {
  const result = compilePilotRecords({
    policy: {
      policyVersion: "full-chain-policy.v0.5",
      pilotMappings: [
        {
          recordType: "shipment_plan",
          sheet: "09_出运计划",
          identity: ["出运计划编号"],
          payload: { planNo: "出运计划编号" },
          fieldPolicy: {
            planNo: { directSource: true, constructionOverrideAllowed: false },
          },
        },
      ],
    },
    scan: {
      sheets: [
        {
          name: "09_出运计划",
          rows: [
            {
              workbookRow: 7,
              valuesByHeader: { 出运计划编号: "SHIP-FIXTURE" },
            },
          ],
        },
      ],
    },
    indexes: {
      constructed: new Map(),
      derivations: new Map(),
      derivationBindings: new Map(),
      pending: new Set(),
      constructionOverrides: new Set(),
      approvedDirectSources: new Set(),
      provenanceConflicts: new Set(["constructed:01_市场信号|ROW|字段"]),
    },
  });
  assert.equal(result.records.length, 1);
  assert.equal(result.gaps.length, 0);
});

test("normalizers require explicit temporal and financial semantics", () => {
  assert.equal(
    normalizeDate("2026-01-02", { precision: "date" }),
    "2026-01-02",
  );
  assert.throws(
    () => normalizeDate("2026-01-02T03:04:05", { precision: "datetime" }),
    /TIMEZONE_REQUIRED/,
  );
  assert.equal(normalizeDecimal("1,234.50"), "1234.50");
  assert.equal(normalizeDecimal("9007199254740993"), "9007199254740993.00");
  assert.throws(() => normalizeDecimal("1,2,3"), /DECIMAL_INVALID/);
  assert.throws(() => normalizeDecimal("1e3"), /DECIMAL_INVALID/);
  assert.deepEqual(normalizeList("A + B/C"), ["A", "B", "C"]);
  assert.equal(normalizeCode("BOOK-DEMO-001"), "BOOK-DEMO-001");
  assert.throws(() => normalizeCode("bad code"), /CODE_INVALID/);
});

test("stuffing house bill references preserve internal spaces and normalize line endings", () => {
  const mapping = {
    recordType: "stuffing_snapshot_line",
    sheet: "11_装箱",
    identity: ["柜号", "备货单号", "SKU", "分提单"],
    payload: {
      containerNo: "柜号",
      cargoReadyNo: "备货单号",
      sku: "SKU",
      houseBillNo: "分提单",
    },
    fieldPolicy: Object.fromEntries(
      ["containerNo", "cargoReadyNo", "sku", "houseBillNo"].map((field) => [
        field,
        { directSource: true, constructionOverrideAllowed: true },
      ]),
    ),
  };
  const result = compilePilotRecords({
    policy: {
      policyVersion: "full-chain-policy.v0.5",
      pilotMappings: [mapping],
    },
    scan: {
      sheets: [
        {
          name: "11_装箱",
          rows: [
            {
              workbookRow: 7,
              valuesByHeader: {
                柜号: "CONT-DEMO-001",
                备货单号: "CARGO-DEMO-001",
                SKU: "SKU-DEMO-001",
                分提单: "  HBL A\r\nB  ",
              },
            },
          ],
        },
      ],
    },
  });
  assert.equal(
    result.records[0].businessKey,
    "CONT-DEMO-001|CARGO-DEMO-001|SKU-DEMO-001|HBL A\nB",
  );
  assert.equal(result.records[0].payload.houseBillNo, "HBL A\nB");
});

test("blank house bill references fail closed and ordinary codes still reject spaces", () => {
  const mapping = {
    recordType: "stuffing_snapshot_line",
    sheet: "11_装箱",
    identity: ["柜号", "备货单号", "SKU", "分提单"],
    payload: {
      containerNo: "柜号",
      cargoReadyNo: "备货单号",
      sku: "SKU",
      houseBillNo: "分提单",
    },
    fieldPolicy: Object.fromEntries(
      ["containerNo", "cargoReadyNo", "sku", "houseBillNo"].map((field) => [
        field,
        { directSource: true, constructionOverrideAllowed: true },
      ]),
    ),
  };
  const compile = (values) =>
    compilePilotRecords({
      policy: {
        policyVersion: "full-chain-policy.v0.5",
        pilotMappings: [mapping],
      },
      scan: {
        sheets: [
          {
            name: "11_装箱",
            rows: [{ workbookRow: 7, valuesByHeader: values }],
          },
        ],
      },
    });
  const blank = compile({
    柜号: "CONT-DEMO-001",
    备货单号: "CARGO-DEMO-001",
    SKU: "SKU-DEMO-001",
    分提单: " \r\n ",
  });
  assert.equal(blank.records.length, 0);
  assert.equal(blank.gaps[0].code, "BUSINESS_KEY_MISSING");
  const invalidCode = compile({
    柜号: "CONT DEMO 001",
    备货单号: "CARGO-DEMO-001",
    SKU: "SKU-DEMO-001",
    分提单: "HBL A",
  });
  assert.equal(invalidCode.records.length, 0);
  assert.equal(invalidCode.gaps[0].code, "CODE_INVALID");
});

test("date normalization rejects impossible dates and uses explicit timezone", () => {
  assert.throws(
    () => normalizeDate("2026-02-31", { precision: "date" }),
    /DATE_INVALID/,
  );
  assert.equal(
    normalizeDate("2026-01-02T03:04:05", {
      precision: "datetime",
      timezone: "Asia/Shanghai",
    }),
    "2026-01-01T19:04:05.000Z",
  );
  assert.equal(
    normalizeDate("2026-01-02T03:04:05", {
      precision: "datetime",
      timezone: "+08:00",
    }),
    "2026-01-01T19:04:05.000Z",
  );
  assert.throws(
    () =>
      normalizeDate("2026-02-31T03:04:05Z", {
        precision: "datetime",
        timezone: "UTC",
      }),
    /DATE_INVALID/,
  );
  assert.equal(
    normalizeDate(
      { rawText: "2026-01-02T00:00:00.000Z", kind: "datetime" },
      { precision: "date" },
    ),
    "2026-01-02",
  );
});

test("dispatch date normalization accepts only policy-declared source formats", () => {
  const options = {
    precision: "date",
    timezone: "+08:00",
    formats: ["iso-date", "m/d/yyyy", "datetime-seconds"],
  };
  assert.equal(normalizeDate("2026-01-02", options), "2026-01-02");
  assert.equal(normalizeDate("1/2/2026", options), "2026-01-02");
  assert.equal(normalizeDate("2026-01-02 03:04:05", options), "2026-01-02");
  for (const value of ["01-02-2026", "2026/01/02", "2026-01-02T03:04"]) {
    assert.throws(
      () => normalizeDate(value, options),
      /DATE_PRECISION_INVALID/,
      value,
    );
  }
});

test("all reconciliation check codes have an explicit result", () => {
  const checkPolicy = {
    checks: Object.fromEntries(
      [
        "CHECK_UNIQUE_BUSINESS_KEY",
        "CHECK_REFERENCE_EXISTS",
        "CHECK_MBL_MATCH",
        "CHECK_HBL_SCOPE",
        "CHECK_DATE_ORDER",
        "CHECK_QUANTITY_RECONCILIATION",
        "CHECK_WEIGHT_RECONCILIATION",
        "CHECK_VOLUME_RECONCILIATION",
        "CHECK_DERIVATION_RECOMPUTED",
      ].map((code) => [
        code,
        {
          defaultStatus: "not_applicable",
          reason: "fixture has no applicable records",
        },
      ]),
    ),
  };
  assert.deepEqual(
    runPackageChecks({ records: [], policy: checkPolicy }).map(
      (check) => check.code,
    ),
    [
      "CHECK_UNIQUE_BUSINESS_KEY",
      "CHECK_REFERENCE_EXISTS",
      "CHECK_MBL_MATCH",
      "CHECK_HBL_SCOPE",
      "CHECK_DATE_ORDER",
      "CHECK_QUANTITY_RECONCILIATION",
      "CHECK_WEIGHT_RECONCILIATION",
      "CHECK_VOLUME_RECONCILIATION",
      "CHECK_DERIVATION_RECOMPUTED",
    ],
  );
});
test("quantity checks are not applicable without stuffing children", () => {
  const checks = runPackageChecks({
    records: [
      {
        recordType: "cargo_ready_release",
        businessKey: "CARGO-FIXTURE-NO-LINES",
        payload: { quantity: "10" },
      },
    ],
    policy: {
      checks: {
        CHECK_QUANTITY_RECONCILIATION: {
          defaultStatus: "not_applicable",
          reason: "no stuffing children",
        },
        CHECK_WEIGHT_RECONCILIATION: {
          defaultStatus: "not_applicable",
          reason: "no stuffing children",
        },
        CHECK_VOLUME_RECONCILIATION: {
          defaultStatus: "not_applicable",
          reason: "no stuffing children",
        },
      },
    },
  });
  for (const code of [
    "CHECK_QUANTITY_RECONCILIATION",
    "CHECK_WEIGHT_RECONCILIATION",
    "CHECK_VOLUME_RECONCILIATION",
  ])
    assert.equal(
      checks.find((check) => check.code === code)?.status,
      "not_applicable",
    );
});

test("reconciliation checks fail on real reference and value mismatches", () => {
  const record = (recordType, businessKey, payload, extra = {}) => ({
    recordType,
    businessKey,
    payload,
    ...extra,
  });
  const records = [
    record("shipment_plan", "PLAN-DEMO-001", {}),
    record("shipment_plan", "PLAN-DEMO-001", {}),
    record("cargo_ready_release", "CR-DEMO-001", {
      quantity: "10",
      grossWeight: "100",
      volume: "2",
    }),
    record("stuffing_snapshot_line", "CONT-DEMO-001|CR-DEMO-UNKNOWN|SKU|HBL", {
      cargoReadyNo: "CR-DEMO-UNKNOWN",
      quantity: "9",
      grossWeight: "90",
      volume: "1",
    }),
    record("stuffing_snapshot_line", "CONT-DEMO-001|CR-DEMO-001|SKU|HBL", {
      cargoReadyNo: "CR-DEMO-001",
      quantity: "9",
      grossWeight: "90",
      volume: "1",
      houseBillNo: "HBL-DEMO-001",
    }),
    record("booking_commitment", "BOOK-DEMO-001", {
      bookingNo: "BOOK-DEMO-001",
      masterBillNo: "MBL-DEMO-001",
      houseBillRefs: "HBL-DEMO-001",
    }),
    record("dispatch_fact", "CONT-DEMO-001", {
      masterBillNo: "MBL-MISMATCH",
      gateInDate: "2026-01-03",
      departedAt: "2026-01-02",
    }),
    record("export_customs_case", "INV-DEMO-001", {
      houseBillNo: "HBL-UNKNOWN",
    }),
    record(
      "derived_fixture",
      "DERIVED-DEMO-001",
      { derivedValue: "2" },
      { derivation: { recomputedValue: "1" } },
    ),
  ];
  const checks = runPackageChecks({ records });
  const failedCodes = new Set(
    checks.filter((item) => item.status === "fail").map((item) => item.code),
  );
  for (const code of [
    "CHECK_UNIQUE_BUSINESS_KEY",
    "CHECK_REFERENCE_EXISTS",
    "CHECK_MBL_MATCH",
    "CHECK_HBL_SCOPE",
    "CHECK_DATE_ORDER",
    "CHECK_QUANTITY_RECONCILIATION",
    "CHECK_WEIGHT_RECONCILIATION",
    "CHECK_VOLUME_RECONCILIATION",
    "CHECK_DERIVATION_RECOMPUTED",
  ])
    assert.equal(failedCodes.has(code), true, code);
});

test("compiler normalization changes records and blocks invalid values", () => {
  const mappingPolicy = {
    pilotMappings: [
      {
        recordType: "shipment_plan",
        sheet: "09_出运计划",
        identity: ["出运计划编号"],
        payload: {
          planNo: "出运计划编号",
          amount: "金额",
          currency: "币种",
          containerRefs: "柜号",
          departedAt: "出运日期",
        },
      },
    ],
  };
  const valid = compilePilotRecords({
    policy: mappingPolicy,
    scan: {
      sheets: [
        {
          name: "09_出运计划",
          rows: [
            {
              workbookRow: 7,
              valuesByHeader: {
                出运计划编号: "PLAN-DEMO-003",
                金额: "12.30",
                币种: "USD",
                柜号: "CONT-DEMO-003/CONT-DEMO-004",
                出运日期: "2026-01-02",
                日期精度: "date",
                证据等级: "R",
              },
            },
          ],
        },
      ],
    },
  });
  assert.equal(valid.records[0].payload.amount, "12.30");
  assert.deepEqual(valid.records[0].payload.containerRefs, [
    "CONT-DEMO-003",
    "CONT-DEMO-004",
  ]);
  const invalid = compilePilotRecords({
    policy: mappingPolicy,
    scan: {
      sheets: [
        {
          name: "09_出运计划",
          rows: [
            {
              workbookRow: 7,
              valuesByHeader: {
                出运计划编号: "bad code",
                金额: "12.30",
                出运日期: "2026-01-02T03:04:05",
                日期精度: "date",
                证据等级: "R",
              },
            },
          ],
        },
      ],
    },
  });
  assert.equal(invalid.records.length, 0);
  assert.equal(invalid.publishable, false);
});
test("source hash preserves pre-normalization mapped values", () => {
  const compile = (amount) =>
    compilePilotRecords({
      policy: {
        pilotMappings: [
          {
            recordType: "shipment_plan",
            sheet: "09_出运计划",
            identity: ["出运计划编号"],
            payload: {
              planNo: "出运计划编号",
              amount: "金额",
              currency: "币种",
            },
          },
        ],
      },
      scan: {
        sheets: [
          {
            name: "09_出运计划",
            rows: [
              {
                workbookRow: 7,
                valuesByHeader: {
                  出运计划编号: "PLAN-DEMO-HASH",
                  金额: amount,
                  币种: "USD",
                  证据等级: "R",
                },
              },
            ],
          },
        ],
      },
    }).records[0].source.originalValueHash;
  assert.notEqual(compile("1,234.00"), compile("1234.00"));
});
