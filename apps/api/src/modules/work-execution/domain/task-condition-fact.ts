import type { LifecycleNodeCode } from "@logix/contracts";

export interface TaskConditionFact {
  id: string;
  factCode: string;
  eventCode: string | null;
  nodeCode: LifecycleNodeCode | null;
  timeKind: "actual" | "estimated";
  captureSource: string;
  evidenceRef: string | null;
}
