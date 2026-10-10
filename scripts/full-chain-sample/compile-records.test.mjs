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
