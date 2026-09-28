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
import { formatHttpError } from "./httpError";
import { DEV_TENANT_ID } from "./developmentIdentity";

const HEADERS = {
  "X-Tenant-Id": DEV_TENANT_ID,
  "X-Operator-Id": "dev-operator",
  "X-Roles": "operations_dispatcher",
};

export async function listDepartedShipments(): Promise<ShipmentSummaryV1[]> {
  const params = new URLSearchParams({ pageSize: "100", status: "departed" });
  const response = await fetch(`/api/shipments?${params}`, {
    headers: HEADERS,
  });
  if (!response.ok) {
    throw new Error("暂时无法加载现有出运；仍可选择新建独立出运");
  }
  const page = (await response.json()) as ShipmentPageV1;
  return page.items;
}

export async function getShipmentIntakeReferenceData(): Promise<ShipmentIntakeReferenceDataV1> {
  const response = await fetch("/api/shipment-handoffs/intake/reference-data", {
    headers: HEADERS,
  });
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "暂时无法加载货主与销售国家",
      ),
    );
  }
  return (await response.json()) as ShipmentIntakeReferenceDataV1;
}

export async function searchShipmentIntakePorts(
  query: string,
  pageSize = 20,
): Promise<ShipmentIntakePortSearchResultV1> {
  const params = new URLSearchParams({ query, pageSize: String(pageSize) });
  const response = await fetch(
    `/api/shipment-handoffs/intake/ports?${params}`,
    {
      headers: HEADERS,
    },
  );
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "暂时无法查询港口",
      ),
    );
  }
  return (await response.json()) as ShipmentIntakePortSearchResultV1;
}

export async function createManualDepartedShipment(
  command: ManualDepartedShipmentCreateCommandV1,
): Promise<ShipmentHandoffResultV1> {
  const response = await fetch("/api/shipment-handoffs/manual", {
    method: "POST",
    headers: {
      ...HEADERS,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "暂时无法建立该票 Shipment",
      ),
    );
  }
  return (await response.json()) as ShipmentHandoffResultV1;
}

export async function listShipmentPendingCompletion(
  pageSize = 100,
): Promise<ShipmentPendingCompletionPageV1> {
  const params = new URLSearchParams({ pageSize: String(pageSize) });
  const response = await fetch(`/api/shipments/pending-completion?${params}`, {
    headers: HEADERS,
  });
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "暂时无法加载已接管待补任务",
      ),
    );
  }
  return (await response.json()) as ShipmentPendingCompletionPageV1;
}

export async function completeShipmentPendingFacts(
  shipmentId: string,
  command: ShipmentPendingFactCompletionCommandV1,
): Promise<ShipmentPendingFactCompletionResultV1> {
  const response = await fetch(
    `/api/shipment-handoffs/shipments/${encodeURIComponent(shipmentId)}/pending-facts`,
    {
      method: "POST",
      headers: {
        ...HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    },
  );
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "暂时无法保存 Shipment 待补事实",
      ),
    );
  }
  return (await response.json()) as ShipmentPendingFactCompletionResultV1;
}

export async function completeShipmentPendingCargo(
  shipmentId: string,
  command: ShipmentPendingCargoCompletionCommandV1,
): Promise<ShipmentPendingCargoCompletionResultV1> {
  const response = await fetch(
    `/api/shipment-handoffs/shipments/${encodeURIComponent(shipmentId)}/pending-cargo`,
    {
      method: "POST",
      headers: {
        ...HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    },
  );
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "暂时无法保存 SKU 装载明细",
      ),
    );
  }
  return (await response.json()) as ShipmentPendingCargoCompletionResultV1;
}

export async function bindShipmentPendingSku(
  shipmentId: string,
  command: ShipmentPendingSkuBindingCommandV1,
): Promise<ShipmentPendingSkuBindingResultV1> {
  const response = await fetch(
    `/api/shipment-handoffs/shipments/${encodeURIComponent(shipmentId)}/pending-sku-binding`,
    {
      method: "POST",
      headers: {
        ...HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    },
  );
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "暂时无法建立或绑定 SKU 主数据",
      ),
    );
  }
  return (await response.json()) as ShipmentPendingSkuBindingResultV1;
}

export async function completeShipmentPendingDocuments(
  shipmentId: string,
  command: ShipmentPendingDocumentCompletionCommandV1,
): Promise<ShipmentPendingDocumentCompletionResultV1> {
  const response = await fetch(
    `/api/shipment-handoffs/shipments/${encodeURIComponent(shipmentId)}/pending-documents`,
    {
      method: "POST",
      headers: {
        ...HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    },
  );
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "暂时无法保存提单资料",
      ),
    );
  }
  return (await response.json()) as ShipmentPendingDocumentCompletionResultV1;
}

export async function listInternalShipmentHandoffCandidates(): Promise<InternalShipmentHandoffCandidatePageV1> {
  const response = await fetch("/api/shipment-handoffs/internal-candidates", {
    headers: HEADERS,
  });
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "暂时无法加载系统内已出运记录",
      ),
    );
  }
  return (await response.json()) as InternalShipmentHandoffCandidatePageV1;
}

export async function acceptInternalShipmentHandoffCandidate(
  command: InternalShipmentHandoffAcceptCommandV1,
): Promise<InternalShipmentHandoffAcceptResultV1> {
  const response = await fetch(
    "/api/shipment-handoffs/internal-candidates/accept",
    {
      method: "POST",
      headers: {
        ...HEADERS,
        "Content-Type": "application/json",
        "X-Roles": "import_operator",
      },
      body: JSON.stringify(command),
    },
  );
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "暂时无法接管该票内部出运",
      ),
    );
  }
  return (await response.json()) as InternalShipmentHandoffAcceptResultV1;
}

export async function acceptInternalShipmentHandoffCandidates(
  command: InternalShipmentHandoffBatchAcceptCommandV1,
): Promise<InternalShipmentHandoffBatchAcceptResultV1> {
  const response = await fetch(
    "/api/shipment-handoffs/internal-candidates/accept-batch",
    {
      method: "POST",
      headers: {
        ...HEADERS,
        "Content-Type": "application/json",
        "X-Roles": "import_operator",
      },
      body: JSON.stringify(command),
    },
  );
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "暂时无法批量接管系统内已出运记录",
      ),
    );
  }
  return (await response.json()) as InternalShipmentHandoffBatchAcceptResultV1;
}

export async function getShipmentDetail(id: string): Promise<ShipmentDetailV1> {
  const response = await fetch(`/api/shipments/${encodeURIComponent(id)}`, {
    headers: HEADERS,
  });
  if (!response.ok) {
    throw new Error("暂时无法加载 Shipment 关系详情");
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
  const response = await fetch(`/api/shipments/risk-queue?${query}`, {
    headers: HEADERS,
  });
  if (!response.ok) throw new Error("暂时无法加载风险队列");
  return (await response.json()) as ShipmentRiskQueuePageV1;
}

/** 把票级事项交给某个专业岗位队列。**只到岗位不到人** —— 谁在班谁领。 */
export async function raiseShipmentWorkHandoff(
  command: ShipmentWorkHandoffRaiseCommandV1,
): Promise<ShipmentWorkHandoffV1> {
  const response = await fetch("/api/work-handoffs", {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error("暂时无法交给该岗位");
  return (await response.json()) as ShipmentWorkHandoffV1;
}

/** 出运运营那一侧：这一票交给谁了、了没了。 */
export async function listShipmentWorkHandoffs(
  shipmentId: string,
): Promise<ShipmentWorkHandoffV1[]> {
  const response = await fetch(
    `/api/work-handoffs/by-shipment/${encodeURIComponent(shipmentId)}`,
    { headers: HEADERS },
  );
  if (!response.ok) throw new Error("暂时无法加载这票交出去的事项");
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
  const response = await fetch(`/api/work-handoffs/queue?${query}`, {
    headers: HEADERS,
  });
  if (!response.ok) throw new Error("暂时无法加载岗位待办");
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
  const response = await fetch(
    `/api/work-handoffs/${encodeURIComponent(handoffId)}/${action}`,
    {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(command),
    },
  );
  if (!response.ok) {
    throw new Error(
      await formatHttpError(response.status, await response.text(), fallback),
    );
  }
  return (await response.json()) as ShipmentWorkHandoffV1;
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
