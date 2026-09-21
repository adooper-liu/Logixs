import { formatHttpError } from "./httpError";

export interface ContainerDispatchSnapshot {
  snapshotId: string;
  containerRecordId: string;
  version: number;
  stuffingSnapshotId: string;
  stuffingSnapshotVersion: number;
  bookingNumber: string;
  carrierCode: string;
  vesselName: string;
  voyageNumber: string;
  masterBillNumber: string | null;
  houseBillNumber: string | null;
  vgmHandoffState: "accepted";
  evidenceRefs: readonly string[];
  actorId: string;
  reasonCode: string;
  createdAt: string;
  duplicate: boolean;
}

export interface ReplaceContainerDispatchSnapshotInput {
  expectedVersion: number;
  stuffingSnapshotId: string;
  stuffingSnapshotVersion: number;
  bookingNumber: string;
  carrierCode: string;
  vesselName: string;
  voyageNumber: string;
  masterBillNumber: string | null;
  houseBillNumber: string | null;
  vgmHandoffState: "accepted";
  evidenceRefs: string[];
  reasonCode: string;
  idempotencyKey: string;
}

const HEADERS = {
  "X-Tenant-Id": "dev-tenant",
  "X-Operator-Id": "dev-operator",
  "X-Roles": "operations_dispatcher",
};

export async function getContainerDispatchSnapshot(
  containerId: string,
): Promise<ContainerDispatchSnapshot | null> {
  const response = await fetch(endpoint(containerId), { headers: HEADERS });
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "加载出运交接失败",
      ),
    );
  }
  return (await response.json()) as ContainerDispatchSnapshot | null;
}

export async function replaceContainerDispatchSnapshot(
  containerId: string,
  input: ReplaceContainerDispatchSnapshotInput,
): Promise<ContainerDispatchSnapshot> {
  const response = await fetch(endpoint(containerId), {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "保存出运交接失败",
      ),
    );
  }
  return (await response.json()) as ContainerDispatchSnapshot;
}

function endpoint(containerId: string): string {
  return `/api/containers/${encodeURIComponent(containerId)}/dispatch-snapshot`;
}
