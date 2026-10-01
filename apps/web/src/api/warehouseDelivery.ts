import type {
  ReplaceWarehouseDeliveryInstructionCommand,
  WarehouseDeliveryInstruction,
} from "@logix/contracts";
import { requestJson } from "./httpClient";

export async function getWarehouseDeliveryInstruction(
  containerId: string,
): Promise<WarehouseDeliveryInstruction | null> {
  return requestJson<WarehouseDeliveryInstruction | null>(
    endpoint(containerId),
    { fallback: "加载送仓指令失败" },
  );
}

export async function replaceWarehouseDeliveryInstruction(
  containerId: string,
  input: ReplaceWarehouseDeliveryInstructionCommand,
): Promise<WarehouseDeliveryInstruction> {
  return requestJson<WarehouseDeliveryInstruction>(endpoint(containerId), {
    method: "POST",
    body: input,
    fallback: "保存送仓指令失败",
  });
}

function endpoint(containerId: string): string {
  return `/api/containers/${encodeURIComponent(containerId)}/delivery-instruction`;
}
