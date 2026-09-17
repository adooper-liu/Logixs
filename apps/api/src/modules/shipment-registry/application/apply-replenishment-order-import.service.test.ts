import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { ApplyReplenishmentOrderImportService } from "./apply-replenishment-order-import.service";
import { REPLENISHMENT_ORDER_IMPORT_WRITER } from "../domain/apply-replenishment-order-import";

const command = {
  tenantId: "tenant-a",
  sourceBatchId: "batch-1",
  orderNumber: "SO-1",
  containerNumber: "MSKU1",
  lines: [
    {
      sourceRowId: "row-1",
      productNumber: "SKU-1",
      shippedQuantity: "1",
      quantityUnit: "piece" as const,
      contractNumber: null,
    },
  ],
  timeFacts: [],
};

async function buildService() {
  const writer = { apply: vi.fn().mockResolvedValue({}) };
  const module = await Test.createTestingModule({
    providers: [
      ApplyReplenishmentOrderImportService,
      { provide: REPLENISHMENT_ORDER_IMPORT_WRITER, useValue: writer },
    ],
  }).compile();
  return { service: module.get(ApplyReplenishmentOrderImportService), writer };
}

describe("ApplyReplenishmentOrderImportService", () => {
  it("拒绝把系统推导时间伪装成 actual", async () => {
    const { service, writer } = await buildService();

    expect(() =>
      service.execute({
        ...command,
        timeFacts: [
          {
            sourceRowId: "row-1",
            factCode: "container_empty_estimated",
            timeKind: "actual" as never,
            captureSource: "system_derived",
            eventCode: null,
            rawValue: "2026-04-23 09:19:30",
            occurredAtUtc: new Date("2026-04-23T07:19:30Z"),
            sourceUtcOffset: "+02:00",
            sourceSystem: "legacy-lms",
            sourceStatus: null,
            evidenceRef: null,
            derivationRuleVersion: "legacy-v1",
          },
        ],
      }),
    ).toThrow("INVALID_SHIPMENT_TIME_FACT");
    expect(writer.apply).not.toHaveBeenCalled();
  });

  it("合格的 actual 事实进入事务写端口", async () => {
    const { service, writer } = await buildService();

    await service.execute({
      ...command,
      timeFacts: [
        {
          sourceRowId: "row-1",
          factCode: "customs_clearance_completed",
          timeKind: "actual",
          captureSource: "controlled_import",
          eventCode: "container_customs_completed",
          rawValue: "2026-04-09 22:58:00",
          occurredAtUtc: new Date("2026-04-09T20:58:00Z"),
          sourceUtcOffset: "+02:00",
          sourceSystem: "legacy-lms",
          sourceStatus: "已完成",
          evidenceRef: "11111111-1111-4111-8111-111111111111",
          derivationRuleVersion: null,
        },
      ],
    });

    expect(writer.apply).toHaveBeenCalledTimes(1);
  });
});
