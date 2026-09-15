import type { LifecycleNodeItem } from "../api/lifecycleNodes";
import { nodeScreenName } from "./uiCopyCatalog";

export interface LiveNodeView {
  nodeInstanceId: string;
  nodeCode: string;
  sequence: number;
  name: string;
  stateLabel: string;
  completedAt: string | null;
  isCurrent: boolean;
}

const NODE_STATE_LABELS: Record<string, string> = {
  pending: "未开始",
  active: "进行中",
  completed: "已完成",
};

export function toLiveNode(item: LifecycleNodeItem): LiveNodeView {
  const notApplicable = item.applicability === "optional_not_applicable";
  return {
    nodeInstanceId: item.nodeInstanceId,
    nodeCode: item.nodeCode,
    sequence: item.sequence,
    name: nodeScreenName(item.nodeCode),
    stateLabel: notApplicable
      ? "不适用"
      : (NODE_STATE_LABELS[item.state] ?? item.state),
    completedAt: item.completedAt,
    isCurrent: item.isCurrent,
  };
}
