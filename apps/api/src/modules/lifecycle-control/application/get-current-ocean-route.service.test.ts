import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { ASSERT_CONTAINER_TENANT } from "../../shipment-registry";
import { OCEAN_ROUTE_REPOSITORY } from "../domain/ocean-route.repository";
import { GetCurrentOceanRouteService } from "./get-current-ocean-route.service";

const query = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  containerId: "22222222-2222-4222-8222-222222222222",
};

async function buildService(route: object | null) {
  const repository = { findCurrent: vi.fn().mockResolvedValue(route) };
  const assertContainer = { execute: vi.fn() };
  const module = await Test.createTestingModule({
    providers: [
      GetCurrentOceanRouteService,
      { provide: OCEAN_ROUTE_REPOSITORY, useValue: repository },
      { provide: ASSERT_CONTAINER_TENANT, useValue: assertContainer },
    ],
  }).compile();
  return {
    service: module.get(GetCurrentOceanRouteService),
    repository,
    assertContainer,
  };
}

describe("GetCurrentOceanRouteService", () => {
  it("返回当前版本及其审计来源", async () => {
    const activatedAt = new Date("2026-09-20T02:00:00Z");
    const context = await buildService({
      routePlanId: "33333333-3333-4333-8333-333333333333",
      version: 2,
      activatedAt,
      ingestionChannel: "manual_ui",
      sourceSystem: "logix.manual",
      evidenceRefs: ["44444444-4444-4444-8444-444444444444"],
      actorId: "55555555-5555-4555-8555-555555555555",
      reasonCode: "route_correction",
      segments: [
        {
          segmentId: "66666666-6666-4666-8666-666666666666",
          sequence: 1,
          isFinal: true,
          transportMode: "vessel",
          originUnlocode: "CNNGB",
          originTimezone: "Asia/Shanghai",
          destinationLocationType: "port",
          destinationUnlocode: "USLAX",
          destinationTimezone: "America/Los_Angeles",
        },
      ],
    });

    await expect(context.service.execute(query)).resolves.toMatchObject({
      version: 2,
      activatedAt: activatedAt.toISOString(),
      sourceSystem: "logix.manual",
    });
    expect(context.assertContainer.execute).toHaveBeenCalledWith(query);
    expect(context.repository.findCurrent).toHaveBeenCalledWith(query);
  });

  it("货柜存在但尚无路线时返回 404", async () => {
    const context = await buildService(null);
    await expect(context.service.execute(query)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
