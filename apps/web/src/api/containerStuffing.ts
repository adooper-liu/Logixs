import { DEV_TENANT_ID } from "./developmentIdentity";
import { formatHttpError } from "./httpError";

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

const IDENTITY_HEADERS = {
  "X-Tenant-Id": DEV_TENANT_ID,
  "X-Operator-Id": "dev-operator",
  "X-Roles": "operations_dispatcher",
};

export async function getContainerStuffingSnapshot(
  containerId: string,
): Promise<ContainerStuffingSnapshot | null> {
  const response = await fetch(endpoint(containerId), {
    headers: IDENTITY_HEADERS,
  });
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "加载装箱记录失败",
      ),
    );
  }
  return (await response.json()) as ContainerStuffingSnapshot | null;
}

export async function replaceContainerStuffingSnapshot(
  containerId: string,
  input: ReplaceContainerStuffingSnapshotInput,
): Promise<ContainerStuffingSnapshot> {
  const response = await fetch(endpoint(containerId), {
    method: "POST",
    headers: { ...IDENTITY_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "保存装箱记录失败",
      ),
    );
  }
  return (await response.json()) as ContainerStuffingSnapshot;
}

function endpoint(containerId: string): string {
  return `/api/containers/${encodeURIComponent(containerId)}/stuffing-snapshot`;
}
