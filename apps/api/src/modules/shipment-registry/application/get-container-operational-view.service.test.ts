import { HttpStatus } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { ContainerOperationalProjection } from "../domain/container-operational-view.repository";
import { GetContainerOperationalViewService } from "./get-container-operational-view.service";

const projection = {
  tenantId: "10000000-0000-4000-8000-000000000001",
  containerId: "20000000-0000-4000-8000-000000000001",
  containerNumber: "HMMU4207629",
  flow: null,
  currentNode: null,
  nodes: [],
  currentTimes: { nodeTimes: [], segmentTimes: [] },
  tasks: [],
  workOrders: [],
  professionalFacts: [],
  evidenceSummary: {
    total: 1,
    effective: 1,
    pending: 0,
    disputed: 0,
    evidenceRefs: ["30000000-0000-4000-8000-000000000001"],
    restrictedEvidencePresent: false,
  },
  syncSummary: { operations: [] },
  activeBlocks: [],
  activeExceptions: [],
  projectionVersion: 0,
  sourceVersions: [],
  asOf: "2026-09-23T08:00:00.000Z",
  freshness: {
    state: "current",
    projectedAt: "2026-09-23T08:00:00.000Z",
  },
} satisfies ContainerOperationalProjection;

describe("GetContainerOperationalViewService", () => {
  it("returns the tenant-scoped projection and keeps evidence for authorized readers", async () => {
    const repository = {
      findByContainer: vi.fn().mockResolvedValue(projection),
    };
    const service = new GetContainerOperationalViewService(repository);

    await expect(
      service.execute({
        tenantId: projection.tenantId,
        containerId: projection.containerId,
        capabilities: ["evidence.read", "task.read"],
      }),
    ).resolves.toEqual({ ...projection, allowedActions: [] });
    expect(repository.findByContainer).toHaveBeenCalledWith({
      tenantId: projection.tenantId,
      containerId: projection.containerId,
    });
  });

  it("redacts evidence references and task details without their read capabilities", async () => {
    const repository = {
      findByContainer: vi.fn().mockResolvedValue({
        ...projection,
        tasks: [{ nodeTaskId: "task-1" }],
        workOrders: [{ workOrderId: "work-order-1" }],
        professionalFacts: [
          {
            domainFactId: "40000000-0000-4000-8000-000000000001",
            factType: "departed",
            occurredAt: "2026-09-22T08:00:00.000Z",
            validity: "effective",
            confidenceState: "confirmed",
            evidenceRefs: ["30000000-0000-4000-8000-000000000001"],
          },
        ],
      }),
    };
    const service = new GetContainerOperationalViewService(repository as never);

    const result = await service.execute({
      tenantId: projection.tenantId,
      containerId: projection.containerId,
      capabilities: [],
    });

    expect(result.tasks).toEqual([]);
    expect(result.workOrders).toEqual([]);
    expect(result.evidenceSummary).toEqual({
      total: 0,
      effective: 0,
      pending: 0,
      disputed: 0,
      evidenceRefs: [],
      restrictedEvidencePresent: true,
    });
    expect(result.professionalFacts[0]?.evidenceRefs).toEqual([]);
  });

  it("projects the registered lifecycle action with its real target and version", async () => {
    const repository = {
      findByContainer: vi.fn().mockResolvedValue({
        ...projection,
        flow: {
          flowInstanceId: "50000000-0000-4000-8000-000000000001",
          state: "active",
          definitionVersion: 1,
          version: 3,
        },
      }),
    };
    const service = new GetContainerOperationalViewService(repository as never);

    const result = await service.execute({
      tenantId: projection.tenantId,
      containerId: projection.containerId,
      capabilities: ["lifecycle.operate"],
    });

    expect(result.allowedActions).toEqual([
      {
        actionCode: "record_lifecycle_date_fact",
        actionVersion: 1,
        target: {
          tenantId: projection.tenantId,
          entityType: "container",
          entityId: projection.containerId,
          ownerModule: "shipment-registry",
        },
        executable: true,
        confirmationPolicy: "none",
        reviewPolicy: "none",
        requiredEvidenceTypes: [],
        expectedVersion: 3,
      },
    ]);
  });

  it("uses stable authorization and not-found failures", async () => {
    const repository = { findByContainer: vi.fn().mockResolvedValue(null) };
    const service = new GetContainerOperationalViewService(repository);

    await expect(
      service.execute({ tenantId: "", containerId: "container-1" }),
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    await expect(
      service.execute({ tenantId: "tenant-1", containerId: "container-1" }),
    ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
  });
});
