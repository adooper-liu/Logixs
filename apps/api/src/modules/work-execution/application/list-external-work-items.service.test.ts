import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { ASSERT_CONTAINER_TENANT } from "../../shipment-registry";
import { EXTERNAL_WORK_ITEM_REPOSITORY } from "../domain/external-work-item.repository";
import { encodeTaskCursor } from "../domain/task-page";
import { ListExternalWorkItemsService } from "./list-external-work-items.service";

describe("ListExternalWorkItemsService", () => {
  it("lists the tenant-wide open work pool with stable pagination", async () => {
    const first = item("item-1", "2026-09-20T08:00:00.000Z");
    const second = item("item-2", "2026-09-20T09:00:00.000Z");
    const repository = {
      listOpen: vi.fn().mockResolvedValue([first, second]),
    };
    const service = await build(repository);

    const page = await service.execute({ tenantId: "tenant-1", pageSize: "1" });

    expect(page.items).toEqual([first]);
    expect(page.pageInfo.nextCursor).toBe(
      encodeTaskCursor({
        tenantId: "tenant-1",
        createdAt: first.createdAt,
        id: first.id,
      }),
    );
    expect(repository.listOpen).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      after: undefined,
      take: 2,
    });
  });

  it("checks container ownership before applying a container filter", async () => {
    const repository = { listOpen: vi.fn().mockResolvedValue([]) };
    const assertContainerTenant = { execute: vi.fn() };
    const service = await build(repository, assertContainerTenant);

    await service.execute({ tenantId: "tenant-1", containerId: "container-1" });

    expect(assertContainerTenant.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      containerId: "container-1",
    });
  });
});

async function build(
  repository: { listOpen: ReturnType<typeof vi.fn> },
  assertContainerTenant = { execute: vi.fn() },
) {
  const module = await Test.createTestingModule({
    providers: [
      ListExternalWorkItemsService,
      { provide: EXTERNAL_WORK_ITEM_REPOSITORY, useValue: repository },
      { provide: ASSERT_CONTAINER_TENANT, useValue: assertContainerTenant },
    ],
  }).compile();
  return module.get(ListExternalWorkItemsService);
}

function item(id: string, createdAt: string) {
  return {
    id,
    tenantId: "tenant-1",
    sourceModule: "compliance-management",
    sourceType: "cargo_ready_compliance_assessment",
    sourceScopeId: "container:container-1:cargo_ready",
    sourceRecordId: "assessment-1",
    sourceVersion: 1,
    sourceItemKey: id,
    containerId: "container-1",
    taskDefinitionKey: "compliance-remediation:test",
    title: "整改",
    detail: "detail",
    priority: "high" as const,
    state: "open" as const,
    assignedRoleCode: "review_supervisor",
    evidenceRefs: [],
    dueAt: null,
    closedAt: null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  };
}
