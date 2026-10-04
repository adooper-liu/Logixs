import type { WorkbenchNetworkVolume } from "@logix/contracts";
import { requestJson } from "./httpClient";

export function getWorkbenchNetworkVolume(): Promise<WorkbenchNetworkVolume> {
  return requestJson<WorkbenchNetworkVolume>("/api/workbench-network/volume", {
    fallback: "业务量暂时读不出来",
  });
}
