import { describe, expect, it, vi } from "vitest";
import type { ShipmentSummaryV1 } from "@logix/contracts";
import {
  decodeShipmentRiskCursor,
  encodeShipmentRiskCursor,
} from "../domain/shipment-risk-page";
import type { ShipmentRiskQueueRow } from "../domain/shipment-read.repository";
import { ListShipmentRiskQueueService } from "./list-shipment-risk-queue.service";

const TENANT = "11111111-1111-4111-8111-111111111111";

const summary = (id: string): ShipmentSummaryV1 => ({
  id,
  shipmentNumber: null,
  transportMode: "ocean",
  carrierCode: "HMM",
  vesselName: "ONE TRUTH",
  voyageNumber: "V001",
  originCountryCode: "CN",
  originUnlocode: "CNNGB",
  destinationCountryCode: "US",
  destinationUnlocode: "USLAX",
  salesCountryCode: null,
  cargoOwnerReferenceId: null,
  cargoOwnerName: null,
  atdAt: "2026-09-22T10:00:00.000Z",
  etaAt: null,
  currentLifecycleStatus: "departed",
  lifecycleVersion: 2,
  relationshipVersion: 1,
  activeContainerCount: 2,
  activeCargoLineCount: 1,
  lifecycleInitializationState: "ready",
  updatedAt: "2026-09-23T10:00:00.000Z",
});

const row = (
  id: string,
  sortValue: Date | null,
  lifecycleVersion = 2,
): ShipmentRiskQueueRow => ({
  shipment: { ...summary(id), lifecycleVersion },
  risk: {
    nearestDeadline: sortValue
      ? { kind: "eta", at: sortValue.toISOString() }
      : null,
    overdue: false,
    reasons: [],
    openExceptionCount: 0,
    unassignedExceptionCount: 0,
  },
  pendingItems: [],
  sortValue,
});

function serviceWith(rows: ShipmentRiskQueueRow[]) {
  const repository = {
    list: vi.fn(),
    listPendingCompletion: vi.fn(),
    listRiskQueue: vi.fn().mockResolvedValue(rows),
    findById: vi.fn(),
  };
  return { repository, service: new ListShipmentRiskQueueService(repository) };
}

describe("ListShipmentRiskQueueService", () => {
  it("缺少租户时拒绝，不返回任何人的数据", async () => {
    const { service } = serviceWith([]);

    await expect(service.execute({})).rejects.toMatchObject({ status: 403 });
  });

  it("默认按最近截止排序，并把实际用的排序回显给调用方", async () => {
    const { repository, service } = serviceWith([row("a", null)]);

    const page = await service.execute({ tenantId: TENANT });

    expect(repository.listRiskQueue).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "nearest_deadline" }),
    );
    expect(page.sort).toBe("nearest_deadline");
  });

  it("按调用方选的排序键查询", async () => {
    const { repository, service } = serviceWith([row("a", null)]);

    await service.execute({ tenantId: TENANT, sort: "task_due" });

    expect(repository.listRiskQueue).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "task_due" }),
    );
  });

  it("拒绝不认识的排序键，而不是悄悄回落到默认值", async () => {
    const { repository, service } = serviceWith([]);

    await expect(
      service.execute({ tenantId: TENANT, sort: "free_time" }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.listRiskQueue).not.toHaveBeenCalled();
  });

  it("多取一条来判断还有没有下一页", async () => {
    const { repository, service } = serviceWith([
      row("a", null),
      row("b", null),
      row("c", null),
    ]);

    const page = await service.execute({ tenantId: TENANT, pageSize: "2" });

    expect(repository.listRiskQueue).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
    expect(page.items.map(({ shipment }) => shipment.id)).toEqual(["a", "b"]);
    expect(page.pageInfo.hasNextPage).toBe(true);
  });

  it("下一页游标记住排序键与该行的排序值", async () => {
    const sortValue = new Date("2026-09-24T08:00:00.000Z");
    const { service } = serviceWith([row("a", sortValue), row("b", null)]);

    const page = await service.execute({
      tenantId: TENANT,
      pageSize: "1",
      sort: "eta",
    });

    expect(decodeShipmentRiskCursor(page.pageInfo.nextCursor!)).toEqual({
      tenantId: TENANT,
      sort: "eta",
      sortValue,
      id: "a",
    });
  });

  it("没有下一页时不给游标", async () => {
    const { service } = serviceWith([row("a", null)]);

    const page = await service.execute({ tenantId: TENANT, pageSize: "5" });

    expect(page.pageInfo).toEqual({
      nextCursor: null,
      hasNextPage: false,
      pageSize: 5,
    });
  });

  it("换了排序键之后，旧游标被拒绝", async () => {
    // 游标不绑定排序键的话，换排序再翻页会重复或整段漏掉 —— 这是最难在
    // 测试里发现、却最容易在生产上骗人的一类缺陷。
    const { repository, service } = serviceWith([]);
    const cursor = encodeShipmentRiskCursor({
      tenantId: TENANT,
      sort: "nearest_deadline",
      sortValue: new Date("2026-09-24T08:00:00.000Z"),
      id: "a",
    });

    await expect(
      service.execute({ tenantId: TENANT, sort: "eta", cursor }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repository.listRiskQueue).not.toHaveBeenCalled();
  });

  it("别的租户的游标被拒绝", async () => {
    const { service } = serviceWith([]);
    const cursor = encodeShipmentRiskCursor({
      tenantId: "22222222-2222-4222-8222-222222222222",
      sort: "nearest_deadline",
      sortValue: null,
      id: "a",
    });

    await expect(
      service.execute({ tenantId: TENANT, cursor }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("游标里的排序值传给仓储，翻页从那一行之后继续", async () => {
    const sortValue = new Date("2026-09-24T08:00:00.000Z");
    const { repository, service } = serviceWith([]);
    const cursor = encodeShipmentRiskCursor({
      tenantId: TENANT,
      sort: "nearest_deadline",
      sortValue,
      id: "a",
    });

    await service.execute({ tenantId: TENANT, cursor });

    expect(repository.listRiskQueue).toHaveBeenCalledWith(
      expect.objectContaining({ after: { sortValue, id: "a" } }),
    );
  });

  it("投影版本取本页最大的生命周期版本", async () => {
    const { service } = serviceWith([row("a", null, 3), row("b", null, 7)]);

    const page = await service.execute({ tenantId: TENANT });

    expect(page.projectionVersion).toBe(7);
  });

  it("空页的投影版本是 0，不是负无穷", async () => {
    const { service } = serviceWith([]);

    const page = await service.execute({ tenantId: TENANT });

    expect(page.projectionVersion).toBe(0);
    expect(page.items).toEqual([]);
  });

  it("拒绝非整数页大小，而不是取整", async () => {
    const { service } = serviceWith([]);

    await expect(
      service.execute({ tenantId: TENANT, pageSize: "10.5" }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
