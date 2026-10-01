import type {
  CustomsClearanceCase,
  ReplaceCustomsClearanceCaseCommand,
} from "@logix/contracts";
import { requestJson } from "./httpClient";

export type CustomsClearanceCaseView = Omit<
  CustomsClearanceCase,
  "activeHoldCodes" | "evidenceRefs"
> & {
  activeHoldCodes: readonly string[];
  evidenceRefs: readonly string[];
};
export type ReplaceCustomsClearanceCaseInput =
  ReplaceCustomsClearanceCaseCommand;

export async function getCustomsClearanceCase(
  containerId: string,
): Promise<CustomsClearanceCaseView | null> {
  return requestJson<CustomsClearanceCaseView | null>(endpoint(containerId), {
    fallback: "加载清关案件失败",
  });
}

export async function replaceCustomsClearanceCase(
  containerId: string,
  input: ReplaceCustomsClearanceCaseInput,
): Promise<CustomsClearanceCaseView> {
  return requestJson<CustomsClearanceCaseView>(endpoint(containerId), {
    method: "POST",
    body: input,
    fallback: "保存清关案件失败",
  });
}

function endpoint(containerId: string): string {
  return `/api/containers/${encodeURIComponent(containerId)}/customs-clearance-case`;
}
