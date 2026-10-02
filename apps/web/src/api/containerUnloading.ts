import type {
  AppendContainerUnloadingReportCommand,
  ContainerUnloadingReport,
} from "@logix/contracts";
import { requestJson } from "./httpClient";

export async function getContainerUnloadingReport(
  containerId: string,
): Promise<ContainerUnloadingReport | null> {
  return requestJson<ContainerUnloadingReport | null>(endpoint(containerId), {
    fallback: "加载卸柜作业失败",
  });
}

export async function appendContainerUnloadingReport(
  containerId: string,
  input: AppendContainerUnloadingReportCommand,
): Promise<ContainerUnloadingReport> {
  return requestJson<ContainerUnloadingReport>(endpoint(containerId), {
    method: "POST",
    body: input,
    fallback: "保存卸柜作业失败",
  });
}

function endpoint(containerId: string): string {
  return `/api/containers/${encodeURIComponent(containerId)}/unloading-report`;
}
