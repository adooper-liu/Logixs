import type {
  ReplaceWarehouseDeliveryInstructionCommand,
  WarehouseDeliveryInstruction,
} from "@logix/contracts";
import { DEV_TENANT_ID } from "./developmentIdentity";
import { formatHttpError } from "./httpError";

const IDENTITY_HEADERS = {
  "X-Tenant-Id": DEV_TENANT_ID,
  "X-Operator-Id": "dev-operator",
  "X-Roles": "operations_dispatcher",
};

export async function getWarehouseDeliveryInstruction(
  containerId: string,
): Promise<WarehouseDeliveryInstruction | null> {
  const response = await fetch(endpoint(containerId), {
    headers: IDENTITY_HEADERS,
  });
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "加载送仓指令失败",
      ),
    );
  }
  return (await response.json()) as WarehouseDeliveryInstruction | null;
}

export async function replaceWarehouseDeliveryInstruction(
  containerId: string,
  input: ReplaceWarehouseDeliveryInstructionCommand,
): Promise<WarehouseDeliveryInstruction> {
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
        "保存送仓指令失败",
      ),
    );
  }
  return (await response.json()) as WarehouseDeliveryInstruction;
}

function endpoint(containerId: string): string {
  return `/api/containers/${encodeURIComponent(containerId)}/delivery-instruction`;
}
