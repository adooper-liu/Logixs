import { requestJson } from "./httpClient";

export interface ContainerStuffingSnapshot {
  snapshotId: string;
  containerRecordId: string;
  version: number;
  allocationSetId: string;
  allocationSetVersion: number;
  containerNumber: string;
  sealNumber: string;
  packageCount: number;
  grossWeight: string;
  grossWeightUnit: "KGM";
  netWeight: string | null;
  volume: string;
  volumeUnit: "MTQ";
  vgm: {
    weight: string;
    weightUnit: "KGM";
    method: "method_1" | "method_2";
    verifiedAt: string;
  } | null;
  evidenceRefs: readonly string[];
  actorId: string;
  reasonCode: string;
  createdAt: string;
  duplicate: boolean;
}

export interface ReplaceContainerStuffingSnapshotInput {
  expectedVersion: number;
  allocationSetId: string;
  allocationSetVersion: number;
  containerNumber: string;
  sealNumber: string;
  packageCount: number;
  grossWeight: string;
  netWeight: string | null;
  volume: string;
  vgm: {
    weight: string;
    method: "method_1" | "method_2";
    verifiedAt: string;
  } | null;
  evidenceRefs: string[];
  reasonCode: string;
  idempotencyKey: string;
}

export async function getContainerStuffingSnapshot(
  containerId: string,
): Promise<ContainerStuffingSnapshot | null> {
  return requestJson<ContainerStuffingSnapshot | null>(endpoint(containerId), {
    fallback: "加载装箱记录失败",
  });
}

export async function replaceContainerStuffingSnapshot(
  containerId: string,
  input: ReplaceContainerStuffingSnapshotInput,
): Promise<ContainerStuffingSnapshot> {
  return requestJson<ContainerStuffingSnapshot>(endpoint(containerId), {
    method: "POST",
    body: input,
    fallback: "保存装箱记录失败",
  });
}

function endpoint(containerId: string): string {
  return `/api/containers/${encodeURIComponent(containerId)}/stuffing-snapshot`;
}
