import type {
  InternalShipmentHandoffAcceptCommandV1,
  InternalShipmentHandoffAcceptResultV1,
  InternalShipmentHandoffBatchAcceptCommandV1,
  InternalShipmentHandoffBatchAcceptResultV1,
  InternalShipmentHandoffCandidatePageV1,
  ShipmentDetailV1,
  ShipmentPageV1,
  ShipmentPendingCompletionPageV1,
  ShipmentSummaryV1,
  ShipmentPendingFactCompletionCommandV1,
  ShipmentPendingFactCompletionResultV1,
  ShipmentPendingCargoCompletionCommandV1,
  ShipmentPendingCargoCompletionResultV1,
  ShipmentPendingSkuBindingCommandV1,
  ShipmentPendingSkuBindingResultV1,
  ShipmentPendingDocumentCompletionCommandV1,
  ShipmentPendingDocumentCompletionResultV1,
  ManualDepartedShipmentCreateCommandV1,
  ShipmentHandoffResultV1,
  ShipmentIntakePortSearchResultV1,
  ShipmentIntakeReferenceDataV1,
  ShipmentRiskQueuePageV1,
  ShipmentRiskSortV1,
  ShipmentWorkHandoffClaimCommandV1,
  ShipmentWorkHandoffCloseCommandV1,
  ShipmentWorkHandoffQueuePageV1,
  ShipmentWorkHandoffRaiseCommandV1,
  ShipmentWorkHandoffV1,
  WorkHandoffRecipientV1,
} from "@logix/contracts";
import { requestApi, requestJson } from "./httpClient";

export async function listDepartedShipments(): Promise<ShipmentSummaryV1[]> {
  const params = new URLSearchParams({ pageSize: "100", status: "departed" });
  const fallback = "暂时无法加载现有出运；仍可选择新建独立出运";
  const response = await requestApi(`/api/shipments?${params}`, { fallback });
  if (!response.ok) {
    throw new Error(fallback);
  }
  const page = (await response.json()) as ShipmentPageV1;
  return page.items;
}

export async function getShipmentIntakeReferenceData(): Promise<ShipmentIntakeReferenceDataV1> {
  return requestJson<ShipmentIntakeReferenceDataV1>(
    "/api/shipment-handoffs/intake/reference-data",
    { fallback: "暂时无法加载货主与销售国家" },
  );
}

export async function searchShipmentIntakePorts(
  query: string,
  pageSize = 20,
): Promise<ShipmentIntakePortSearchResultV1> {
  const params = new URLSearchParams({ query, pageSize: String(pageSize) });
  return requestJson<ShipmentIntakePortSearchResultV1>(
    `/api/shipment-handoffs/intake/ports?${params}`,
    { fallback: "暂时无法查询港口" },
  );
}

export async function createManualDepartedShipment(
  command: ManualDepartedShipmentCreateCommandV1,
): Promise<ShipmentHandoffResultV1> {
  return requestJson<ShipmentHandoffResultV1>("/api/shipment-handoffs/manual", {
    method: "POST",
    body: command,
    fallback: "暂时无法建立该票 Shipment",
  });
}

export async function listShipmentPendingCompletion(
  pageSize = 100,
): Promise<ShipmentPendingCompletionPageV1> {
  const params = new URLSearchParams({ pageSize: String(pageSize) });
  return requestJson<ShipmentPendingCompletionPageV1>(
    `/api/shipments/pending-completion?${params}`,
    { fallback: "暂时无法加载已接管待补任务" },
  );
}

export async function completeShipmentPendingFacts(
  shipmentId: string,
  command: ShipmentPendingFactCompletionCommandV1,
): Promise<ShipmentPendingFactCompletionResultV1> {
  return requestJson<ShipmentPendingFactCompletionResultV1>(
    `/api/shipment-handoffs/shipments/${encodeURIComponent(shipmentId)}/pending-facts`,
    {
      method: "POST",
      body: command,
      fallback: "暂时无法保存 Shipment 待补事实",
    },
  );
}

export async function completeShipmentPendingCargo(
  shipmentId: string,
  command: ShipmentPendingCargoCompletionCommandV1,
): Promise<ShipmentPendingCargoCompletionResultV1> {
  return requestJson<ShipmentPendingCargoCompletionResultV1>(
    `/api/shipment-handoffs/shipments/${encodeURIComponent(shipmentId)}/pending-cargo`,
    { method: "POST", body: command, fallback: "暂时无法保存 SKU 装载明细" },
  );
}

export async function bindShipmentPendingSku(
  shipmentId: string,
  command: ShipmentPendingSkuBindingCommandV1,
): Promise<ShipmentPendingSkuBindingResultV1> {
  return requestJson<ShipmentPendingSkuBindingResultV1>(
    `/api/shipment-handoffs/shipments/${encodeURIComponent(shipmentId)}/pending-sku-binding`,
    {
      method: "POST",
      body: command,
      fallback: "暂时无法建立或绑定 SKU 主数据",
    },
  );
}

export async function completeShipmentPendingDocuments(
  shipmentId: string,
  command: ShipmentPendingDocumentCompletionCommandV1,
): Promise<ShipmentPendingDocumentCompletionResultV1> {
  return requestJson<ShipmentPendingDocumentCompletionResultV1>(
    `/api/shipment-handoffs/shipments/${encodeURIComponent(shipmentId)}/pending-documents`,
    { method: "POST", body: command, fallback: "暂时无法保存提单资料" },
  );
}

export async function listInternalShipmentHandoffCandidates(): Promise<InternalShipmentHandoffCandidatePageV1> {
  return requestJson<InternalShipmentHandoffCandidatePageV1>(
    "/api/shipment-handoffs/internal-candidates",
    { fallback: "暂时无法加载系统内已出运记录" },
  );
}

export async function acceptInternalShipmentHandoffCandidate(
  command: InternalShipmentHandoffAcceptCommandV1,
): Promise<InternalShipmentHandoffAcceptResultV1> {
  return requestJson<InternalShipmentHandoffAcceptResultV1>(
    "/api/shipment-handoffs/internal-candidates/accept",
    { method: "POST", body: command, fallback: "暂时无法接管该票内部出运" },
  );
}

export async function acceptInternalShipmentHandoffCandidates(
  command: InternalShipmentHandoffBatchAcceptCommandV1,
): Promise<InternalShipmentHandoffBatchAcceptResultV1> {
  return requestJson<InternalShipmentHandoffBatchAcceptResultV1>(
    "/api/shipment-handoffs/internal-candidates/accept-batch",
    {
      method: "POST",
      body: command,
      fallback: "暂时无法批量接管系统内已出运记录",
    },
  );
}

export async function getShipmentDetail(id: string): Promise<ShipmentDetailV1> {
  const fallback = "暂时无法加载 Shipment 关系详情";
  const response = await requestApi(
    `/api/shipments/${encodeURIComponent(id)}`,
    {
      fallback,
    },
  );
  if (!response.ok) {
    throw new Error(fallback);
  }
  return (await response.json()) as ShipmentDetailV1;
}

export type {
  InternalShipmentHandoffCandidateV1,
  InternalShipmentHandoffBatchAcceptResultV1,
  ShipmentDetailV1,
  ShipmentPendingCompletionItemV1,
  ShipmentPendingCompletionPageV1,
  ShipmentPendingFactCompletionCommandV1,
  ShipmentPendingFactCompletionResultV1,
  ShipmentPendingCargoCompletionCommandV1,
  ShipmentPendingCargoCompletionResultV1,
  ShipmentPendingSkuBindingCommandV1,
  ShipmentPendingSkuBindingResultV1,
  ShipmentPendingDocumentCompletionCommandV1,
  ShipmentPendingDocumentCompletionResultV1,
  ShipmentSummaryV1,
  ManualDepartedShipmentCreateCommandV1,
  ShipmentHandoffResultV1,
  ShipmentIntakePortV1,
  ShipmentIntakeReferenceDataV1,
} from "@logix/contracts";

/**
 * 出运风险队列。排序与筛选都在服务端，游标记住排序键 —— 前端不自排：
 * 队列是游标分页的，本地只能排当前页，第二页的票可能比第一页更急。
 */
export async function listShipmentRiskQueue(params: {
  sort?: ShipmentRiskSortV1;
  pageSize?: string;
  cursor?: string;
}): Promise<ShipmentRiskQueuePageV1> {
  const query = new URLSearchParams({ pageSize: params.pageSize ?? "50" });
  if (params.sort) query.set("sort", params.sort);
  if (params.cursor) query.set("cursor", params.cursor);
  const fallback = "暂时无法加载风险队列";
  const response = await requestApi(`/api/shipments/risk-queue?${query}`, {
    fallback,
  });
  if (!response.ok) throw new Error(fallback);
  return (await response.json()) as ShipmentRiskQueuePageV1;
}

/** 把票级事项交给某个专业岗位队列。**只到岗位不到人** —— 谁在班谁领。 */
export async function raiseShipmentWorkHandoff(
  command: ShipmentWorkHandoffRaiseCommandV1,
): Promise<ShipmentWorkHandoffV1> {
  const fallback = "暂时无法交给该岗位";
  const response = await requestApi("/api/work-handoffs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
    fallback,
  });
  if (!response.ok) throw new Error(fallback);
  return (await response.json()) as ShipmentWorkHandoffV1;
}

/** 出运运营那一侧：这一票交给谁了、了没了。 */
export async function listShipmentWorkHandoffs(
  shipmentId: string,
): Promise<ShipmentWorkHandoffV1[]> {
  const fallback = "暂时无法加载这票交出去的事项";
  const response = await requestApi(
    `/api/work-handoffs/by-shipment/${encodeURIComponent(shipmentId)}`,
    { fallback },
  );
  if (!response.ok) throw new Error(fallback);
  return (await response.json()) as ShipmentWorkHandoffV1[];
}

/** 专业岗位队列：一个岗位一个队列，一套实现服务四个岗位。 */
export async function listWorkHandoffQueue(params: {
  recipient: WorkHandoffRecipientV1;
  pageSize?: string;
  cursor?: string;
}): Promise<ShipmentWorkHandoffQueuePageV1> {
  const query = new URLSearchParams({
    recipient: params.recipient,
    pageSize: params.pageSize ?? "50",
  });
  if (params.cursor) query.set("cursor", params.cursor);
  const fallback = "暂时无法加载岗位待办";
  const response = await requestApi(`/api/work-handoffs/queue?${query}`, {
    fallback,
  });
  if (!response.ok) throw new Error(fallback);
  return (await response.json()) as ShipmentWorkHandoffQueuePageV1;
}

export async function claimShipmentWorkHandoff(
  handoffId: string,
  command: ShipmentWorkHandoffClaimCommandV1,
): Promise<ShipmentWorkHandoffV1> {
  return postWorkHandoffAction(handoffId, "claims", command, "暂时无法领取");
}

export async function closeShipmentWorkHandoff(
  handoffId: string,
  command: ShipmentWorkHandoffCloseCommandV1,
): Promise<ShipmentWorkHandoffV1> {
  return postWorkHandoffAction(handoffId, "closures", command, "暂时无法了结");
}

async function postWorkHandoffAction(
  handoffId: string,
  action: "claims" | "closures",
  command: unknown,
  fallback: string,
): Promise<ShipmentWorkHandoffV1> {
  return requestJson<ShipmentWorkHandoffV1>(
    `/api/work-handoffs/${encodeURIComponent(handoffId)}/${action}`,
    { method: "POST", body: command, fallback },
  );
}

export type {
  ShipmentRiskQueueEntryV1,
  ShipmentRiskQueuePageV1,
  ShipmentRiskSortV1,
  ShipmentWorkHandoffClaimCommandV1,
  ShipmentWorkHandoffCloseCommandV1,
  ShipmentWorkHandoffQueuePageV1,
  ShipmentWorkHandoffRaiseCommandV1,
  ShipmentWorkHandoffV1,
  WorkHandoffRecipientV1,
} from "@logix/contracts";
