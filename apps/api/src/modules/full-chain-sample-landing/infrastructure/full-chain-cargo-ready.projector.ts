import { Injectable } from "@nestjs/common";
import type { FullChainLandingGraph } from "../domain/landing-graph";
import type { ReplaceReplenishmentOrderLinesService } from "../../shipment-registry";

@Injectable()
export class FullChainCargoReadyProjector {
  constructor(
    private readonly replaceReplenishmentOrderLines: ReplaceReplenishmentOrderLinesService,
  ) {}

  async project(input: {
    tenantId: string;
    runId: string;
    graph: Pick<FullChainLandingGraph, "cargoReadyReleases" | "stuffingLines">;
  }): Promise<void> {
    for (const line of input.graph.stuffingLines) {
      assertWorkbenchQuantity(line.quantity);
      assertQuantityUnit(line.quantityUnit);
    }
    for (const release of input.graph.cargoReadyReleases) {
      const lines = input.graph.stuffingLines
        .filter(
          ({ cargoReadyNumber }) =>
            cargoReadyNumber === release.cargoReadyNumber,
        )
        .map((line) => ({
          sourceRowId: line.businessKey,
          productNumber: line.sku,
          shippedQuantity: line.quantity,
          quantityUnit: requiredQuantityUnit(line.quantityUnit),
          contractNumber: null,
        }));
      await this.replaceReplenishmentOrderLines.execute({
        tenantId: input.tenantId,
        sourceBatchId: input.runId,
        orderNumber: release.cargoReadyNumber,
        lines,
      });
    }
  }
}

function requiredQuantityUnit(value: unknown): "piece" | "set" {
  assertQuantityUnit(value);
  return value;
}

function assertQuantityUnit(value: unknown): asserts value is "piece" | "set" {
  if (value !== "piece" && value !== "set")
    throw new Error("FULL_CHAIN_WORKBENCH_QUANTITY_UNIT_REQUIRED");
}

function assertWorkbenchQuantity(value: string): void {
  const [whole, fraction = ""] = value.split(".");
  const normalizedWhole = whole?.replace(/^0+(?=\d)/u, "") ?? "";
  if (
    !/^\d+$/u.test(normalizedWhole) ||
    !/^\d{0,3}$/u.test(fraction) ||
    normalizedWhole.length > 15
  ) {
    throw new Error("FULL_CHAIN_WORKBENCH_QUANTITY_OUT_OF_RANGE");
  }
}
