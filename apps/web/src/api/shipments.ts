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
} from "@logix/contracts";
