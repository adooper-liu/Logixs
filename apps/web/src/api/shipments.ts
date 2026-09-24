import type {
  InternalShipmentHandoffAcceptCommandV1,
  InternalShipmentHandoffAcceptResultV1,
  InternalShipmentHandoffCandidatePageV1,
  ShipmentDetailV1,
  ShipmentPageV1,
  ShipmentSummaryV1,
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
  ShipmentDetailV1,
  ShipmentSummaryV1,
} from "@logix/contracts";
