import { describe, expect, it, vi } from "vitest";
import { FullChainCargoReadyProjector } from "./full-chain-cargo-ready.projector";

describe("FullChainCargoReadyProjector", () => {
  it("projects every published cargo-ready record and all related SKU lines into the existing workbench contract", async () => {
    const replace = { execute: vi.fn(async () => undefined) };
    const projector = new FullChainCargoReadyProjector(replace as never);

    await projector.project({
      tenantId: "demo-real-sample-20260921",
      runId: "11111111-1111-4111-8111-111111111111",
      graph: {
        cargoReadyReleases: [
          {
            cargoReadyNumber: "ORDER-A",
            displayGroupRef: "GROUP-A",
            quantity: "3",
            payloadHash: "a".repeat(64),
          },
          {
            cargoReadyNumber: "ORDER-B",
            displayGroupRef: "GROUP-B",
            quantity: "2",
            payloadHash: "b".repeat(64),
          },
        ],
        stuffingLines: [
          {
            businessKey: "CONT-A|ORDER-A|SKU-A|HBL-A",
            containerNumber: "CONT-A",
            cargoReadyNumber: "ORDER-A",
            sku: "SKU-A",
            houseBillNumber: "HBL-A",
            quantity: "3",
            quantityUnit: "set",
            grossWeight: "10",
            volume: "1",
            payloadHash: "c".repeat(64),
          },
        ],
      },
    } as never);

    expect(replace.execute).toHaveBeenCalledTimes(2);
    expect(replace.execute).toHaveBeenNthCalledWith(1, {
      tenantId: "demo-real-sample-20260921",
      sourceBatchId: "11111111-1111-4111-8111-111111111111",
      orderNumber: "ORDER-A",
      lines: [
        {
          sourceRowId: "CONT-A|ORDER-A|SKU-A|HBL-A",
          productNumber: "SKU-A",
          shippedQuantity: "3",
          quantityUnit: "set",
          contractNumber: null,
        },
      ],
    });
    expect(replace.execute).toHaveBeenNthCalledWith(2, {
      tenantId: "demo-real-sample-20260921",
      sourceBatchId: "11111111-1111-4111-8111-111111111111",
      orderNumber: "ORDER-B",
      lines: [],
    });
  });

  it("rejects a missing quantity unit before writing any order", async () => {
    const replace = { execute: vi.fn(async () => undefined) };
    const projector = new FullChainCargoReadyProjector(replace as never);

    await expect(
      projector.project({
        tenantId: "demo-real-sample-20260921",
        runId: "11111111-1111-4111-8111-111111111111",
        graph: {
          cargoReadyReleases: [
            {
              cargoReadyNumber: "ORDER-A",
              displayGroupRef: "GROUP-A",
              quantity: "1",
              payloadHash: "a".repeat(64),
            },
          ],
          stuffingLines: [
            {
              businessKey: "CONT-A|ORDER-A|SKU-A|HBL-A",
              containerNumber: "CONT-A",
              cargoReadyNumber: "ORDER-A",
              sku: "SKU-A",
              houseBillNumber: "HBL-A",
              quantity: "1",
              grossWeight: "10",
              volume: "1",
              payloadHash: "b".repeat(64),
            },
          ],
        },
      } as never),
    ).rejects.toThrow("FULL_CHAIN_WORKBENCH_QUANTITY_UNIT_REQUIRED");
    expect(replace.execute).not.toHaveBeenCalled();
  });

  it("rejects a quantity outside the existing workbench decimal envelope before writing any order", async () => {
    const replace = { execute: vi.fn(async () => undefined) };
    const projector = new FullChainCargoReadyProjector(replace as never);

    await expect(
      projector.project({
        tenantId: "demo-real-sample-20260921",
        runId: "11111111-1111-4111-8111-111111111111",
        graph: {
          cargoReadyReleases: [
            {
              cargoReadyNumber: "ORDER-A",
              displayGroupRef: "GROUP-A",
              quantity: "1",
              payloadHash: "a".repeat(64),
            },
          ],
          stuffingLines: [
            {
              businessKey: "CONT-A|ORDER-A|SKU-A|HBL-A",
              containerNumber: "CONT-A",
              cargoReadyNumber: "ORDER-A",
              sku: "SKU-A",
              houseBillNumber: "HBL-A",
              quantity: "9007199254740993.000",
              quantityUnit: "piece",
              grossWeight: "10",
              volume: "1",
              payloadHash: "b".repeat(64),
            },
          ],
        },
      } as never),
    ).rejects.toThrow("FULL_CHAIN_WORKBENCH_QUANTITY_OUT_OF_RANGE");
    expect(replace.execute).not.toHaveBeenCalled();
  });
});
