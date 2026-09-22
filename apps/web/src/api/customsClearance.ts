import type {
  CustomsClearanceCase,
  ReplaceCustomsClearanceCaseCommand,
} from "@logix/contracts";
import { DEV_TENANT_ID } from "./developmentIdentity";
import { formatHttpError } from "./httpError";

const HEADERS = {
  "X-Tenant-Id": DEV_TENANT_ID,
  "X-Operator-Id": "dev-operator",
  "X-Roles": "operations_dispatcher",
};

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
  const response = await fetch(endpoint(containerId), { headers: HEADERS });
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "加载清关案件失败",
      ),
    );
  }
  return (await response.json()) as CustomsClearanceCaseView | null;
}

export async function replaceCustomsClearanceCase(
  containerId: string,
  input: ReplaceCustomsClearanceCaseInput,
): Promise<CustomsClearanceCaseView> {
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
        "保存清关案件失败",
      ),
    );
  }
  return (await response.json()) as CustomsClearanceCaseView;
}

function endpoint(containerId: string): string {
  return `/api/containers/${encodeURIComponent(containerId)}/customs-clearance-case`;
}
