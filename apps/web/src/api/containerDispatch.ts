import { requestJson } from "./httpClient";

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

export async function getContainerDispatchSnapshot(
  containerId: string,
): Promise<ContainerDispatchSnapshot | null> {
  return requestJson<ContainerDispatchSnapshot | null>(endpoint(containerId), {
    fallback: "加载出运交接失败",
  });
}

export async function replaceContainerDispatchSnapshot(
  containerId: string,
  input: ReplaceContainerDispatchSnapshotInput,
): Promise<ContainerDispatchSnapshot> {
  return requestJson<ContainerDispatchSnapshot>(endpoint(containerId), {
    method: "POST",
    body: input,
    fallback: "保存出运交接失败",
  });
}

function endpoint(containerId: string): string {
  return `/api/containers/${encodeURIComponent(containerId)}/dispatch-snapshot`;
}
