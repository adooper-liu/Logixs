import type { CompletionMode, LifecycleNodeCode } from "@logix/contracts";
import lifecycleNodes from "@logix/contracts/lifecycle-nodes.json";

const MODE_BY_NODE = new Map<LifecycleNodeCode, CompletionMode>();

for (const node of lifecycleNodes) {
  if (MODE_BY_NODE.has(node.nodeCode)) {
    throw new Error(
      `LIFECYCLE_NODE_COMPLETION_MODE_DUPLICATE:${node.nodeCode}`,
    );
  }
  MODE_BY_NODE.set(node.nodeCode, node.completionMode);
}

export function completionModeOf(nodeCode: LifecycleNodeCode): CompletionMode {
  const mode = MODE_BY_NODE.get(nodeCode);
  if (!mode) {
    throw new Error(`LIFECYCLE_NODE_COMPLETION_MODE_UNDEFINED:${nodeCode}`);
  }
  return mode;
}
