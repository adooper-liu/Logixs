import type {
  AppendContainerUnloadingReportCommand,
  ContainerUnloadingReport,
} from "@logix/contracts";
import { DEV_TENANT_ID } from "./developmentIdentity";
import { formatHttpError } from "./httpError";

const IDENTITY_HEADERS = {
  "X-Tenant-Id": DEV_TENANT_ID,
  "X-Operator-Id": "dev-operator",
  "X-Roles": "warehouse_operator",
};

export async function getContainerUnloadingReport(
  containerId: string,
): Promise<ContainerUnloadingReport | null> {
  const response = await fetch(endpoint(containerId), {
    headers: IDENTITY_HEADERS,
  });
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "加载卸柜作业失败",
      ),
    );
  }
  return (await response.json()) as ContainerUnloadingReport | null;
}

export async function appendContainerUnloadingReport(
  containerId: string,
  input: AppendContainerUnloadingReportCommand,
): Promise<ContainerUnloadingReport> {
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
        "保存卸柜作业失败",
      ),
    );
  }
  return (await response.json()) as ContainerUnloadingReport;
}

function endpoint(containerId: string): string {
  return `/api/containers/${encodeURIComponent(containerId)}/unloading-report`;
}
