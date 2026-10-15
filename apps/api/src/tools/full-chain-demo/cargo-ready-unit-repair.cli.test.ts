import { describe, expect, it, vi } from "vitest";
import { parseRepairArguments, run } from "./cargo-ready-unit-repair.cli";

const FIXTURE_HASH =
  "166c24a7f69a059eadae723a7b850340a241bfba9747da79e584d3e608fd16da";
const BAD_SOURCE_BATCH = "ad20509d-955f-4b97-9ecb-a34b52f24ed0";

describe("cargo-ready unit repair CLI boundary", () => {
  it("accepts only the exact target tenant, fixture hash, and confirmation", () => {
    expect(
      parseRepairArguments([
        "--execute",
        "--tenant",
        "demo-real-sample-20260921",
        "--expected-fixture-hash",
        FIXTURE_HASH,
        "--confirm-repair",
        "demo-real-sample-20260921",
      ]),
    ).toEqual({
      tenant: "demo-real-sample-20260921",
      expectedFixtureHash: FIXTURE_HASH,
    });
  });

  it.each([
    {
      argv: ["--tenant", "demo-real-sample-20260921"],
      code: "DEMO_CARGO_READY_REPAIR_EXECUTE_REQUIRED",
    },
    {
      argv: ["--execute", "--tenant", "other"],
      code: "DEMO_MAINTENANCE_TENANT_DENIED",
    },
    {
      argv: [
        "--execute",
        "--tenant",
        "demo-real-sample-20260921",
        "--confirm-repair",
        "other",
      ],
      code: "DEMO_CARGO_READY_REPAIR_CONFIRMATION_REQUIRED",
    },
  ])("rejects $code before client creation", async ({ argv, code }) => {
    const createClient = vi.fn();

    await expect(run(argv, { createClient })).rejects.toThrow(code);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("replaces the trusted order with mixed units and withdraws untrusted lines", async () => {
    const executeBatch = vi.fn(async () => undefined);
    const disconnect = vi.fn(async () => undefined);
    const trusted = trustedFixture();
    const currentLinesByOrder = badCurrentLinesByOrder(trusted);

    const result = await run(
      [
        "--execute",
        "--tenant",
        "demo-real-sample-20260921",
        "--expected-fixture-hash",
        FIXTURE_HASH,
        "--confirm-repair",
        "demo-real-sample-20260921",
      ],
      {
        readFixture: async () => trusted,
        fixtureHash: FIXTURE_HASH,
        createClient: () => ({
          disconnect,
          currentLines: vi.fn(
            async (orderNumber: string) =>
              currentLinesByOrder.get(orderNumber) ?? [],
          ),
        }),
        replaceLines: () => ({ executeBatch }),
        output: vi.fn(),
      },
    );

    expect(result).toEqual({
      result: "repaired",
      targetTenant: "demo-real-sample-20260921",
      repairedOrders: 2,
      currentLineCount: 15,
      pieceLineCount: 12,
      setLineCount: 3,
      withdrawnUnknownUnitLineCount: 9,
    });
    expect(executeBatch).toHaveBeenCalledTimes(1);
    expect(executeBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        orderNumber: "26DSA01883",
        expectedCurrentSourceBatchId: BAD_SOURCE_BATCH,
        lines: [],
      }),
      expect.objectContaining({
        orderNumber: "26DSC01812",
        expectedCurrentSourceBatchId: BAD_SOURCE_BATCH,
        lines: expect.arrayContaining([
          expect.objectContaining({
            productNumber: "SKU-PIECE",
            quantityUnit: "piece",
          }),
          expect.objectContaining({
            productNumber: "SKU-SET",
            quantityUnit: "set",
          }),
        ]),
      }),
    ]);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
  it.each([
    {
      label: "different source batch",
      mutate: (lines: ReturnType<typeof badCurrentLinesByOrder>) => {
        lines.get("26DSC01812")![0]!.sourceBatchId = "newer-run";
      },
    },
    {
      label: "changed quantity",
      mutate: (lines: ReturnType<typeof badCurrentLinesByOrder>) => {
        lines.get("26DSC01812")![0]!.shippedQuantity = "999";
      },
    },
    {
      label: "changed unit",
      mutate: (lines: ReturnType<typeof badCurrentLinesByOrder>) => {
        lines.get("26DSC01812")![0]!.quantityUnit = "set";
      },
    },
  ])("rejects a newer current version with $label", async ({ mutate }) => {
    const trusted = trustedFixture();
    const current = badCurrentLinesByOrder(trusted);
    mutate(current);
    const executeBatch = vi.fn(async () => undefined);

    await expect(
      run(
        [
          "--execute",
          "--tenant",
          "demo-real-sample-20260921",
          "--expected-fixture-hash",
          FIXTURE_HASH,
          "--confirm-repair",
          "demo-real-sample-20260921",
        ],
        {
          readFixture: async () => trusted,
          fixtureHash: FIXTURE_HASH,
          createClient: () => ({
            disconnect: vi.fn(async () => undefined),
            currentLines: vi.fn(
              async (orderNumber: string) => current.get(orderNumber) ?? [],
            ),
          }),
          replaceLines: () => ({ executeBatch }),
          output: vi.fn(),
        },
      ),
    ).rejects.toThrow("DEMO_CARGO_READY_REPAIR_CURRENT_LINES_INVALID");
    expect(executeBatch).not.toHaveBeenCalled();
  });
});

function badCurrentLinesByOrder(trusted: ReturnType<typeof trustedFixture>) {
  return new Map([
    [
      "26DSC01812",
      trusted.productLines.map((line) => ({
        sourceRowId: `HMMU4956442|26DSC01812|${line.productNumber}|NBOZ9FF56400${line.houseBillSuffix}`,
        productNumber: line.productNumber,
        sourceBatchId: BAD_SOURCE_BATCH,
        shippedQuantity: String(line.shippedQuantity),
        quantityUnit: "piece",
        contractNumber: null,
      })),
    ],
    [
      "26DSA01883",
      [
        ["370-064V80RD", "50"],
        ["370-211V80BU", "30"],
        ["370-235V80RD", "100"],
        ["370-237V80BK", "40"],
        ["370-276V00BK", "50"],
        ["370-276V00WT", "50"],
        ["370-335V80GN", "30"],
        ["370-335V80RD", "51"],
        ["370-400V80BU", "75"],
      ].map(([productNumber, shippedQuantity]) => ({
        sourceRowId: `BMOU4788119|26DSA01883|${productNumber}|HDMUNBOZFS613500`,
        productNumber,
        sourceBatchId: BAD_SOURCE_BATCH,
        shippedQuantity,
        quantityUnit: "piece",
        contractNumber: null,
      })),
    ],
  ]);
}

function trustedFixture() {
  const productLines = Array.from({ length: 15 }, (_, index) => ({
    orderNumber: "26DSC01812",
    productNumber:
      index === 0 ? "SKU-PIECE" : index === 12 ? "SKU-SET" : `SKU-${index}`,
    shippedQuantity: index === 14 ? 490 : 1,
    quantityUnit: index >= 12 ? "set" : "piece",
    houseBillSuffix: index === 14 ? "D" : "C",
    contractNumber: `CONTRACT-${index}`,
    sourceSnapshot: {},
  }));
  return {
    fixtureVersion: 1,
    tenantId: "demo-real-sample-20260921",
    sources: {
      bom: {
        sha256:
          "fcbeedd8ed65a9de854e05381bd9fa3dc4dcfb5dcaee133092d268a6b8981425",
      },
    },
    productLines,
  };
}
