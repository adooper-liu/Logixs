import type {
  ShipmentDetailV1,
  ShipmentLifecycleStatusV1,
  ShipmentPendingCompletionItemV1,
  ShipmentRiskQueueEntryV1,
  ShipmentRiskSortV1,
  ShipmentSummaryV1,
} from "@logix/contracts";

export const SHIPMENT_READ_REPOSITORY = Symbol("ShipmentReadRepository");

export interface ShipmentListQuery {
  tenantId: string;
  status?: ShipmentLifecycleStatusV1;
  after?: { updatedAt: Date; id: string };
  take: number;
}

export interface ShipmentByIdQuery {
  tenantId: string;
  id: string;
}

export interface ShipmentPendingCompletionQuery {
  tenantId: string;
  after?: { updatedAt: Date; id: string };
  take: number;
}

export interface ShipmentRiskQueueQuery {
  tenantId: string;
  sort: ShipmentRiskSortV1;
  after?: { sortValue: Date | null; id: string };
  take: number;
}

/**
 * 队列里的一行。`sortValue` 是**当前排序键下的值**（没有截止为 `null`），
 * 只用于服务端编游标 —— 它不进对外契约，因为除「最近截止」以外的排序键
 * （如最早未完成工单的截止）在契约里没有对应字段。
 */
export type ShipmentRiskQueueRow = ShipmentRiskQueueEntryV1 & {
  sortValue: Date | null;
};

export type ShipmentDetailProjection = Omit<ShipmentDetailV1, "asOf">;

export interface ShipmentReadRepository {
  list(query: ShipmentListQuery): Promise<ShipmentSummaryV1[]>;
  listPendingCompletion(
    query: ShipmentPendingCompletionQuery,
  ): Promise<ShipmentPendingCompletionItemV1[]>;
  listRiskQueue(query: ShipmentRiskQueueQuery): Promise<ShipmentRiskQueueRow[]>;
  findById(query: ShipmentByIdQuery): Promise<ShipmentDetailProjection | null>;
}
