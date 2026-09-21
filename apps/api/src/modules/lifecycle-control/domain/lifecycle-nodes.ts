import type { LifecycleNodeCode, NodeApplicability } from "@logix/contracts";
import canonicalEvents from "@logix/contracts/canonical-events.json";
import type {
  LifecycleDateApplicationState,
  LifecycleDateFactProjectionRecord,
} from "./lifecycle-date-fact";
import type { FlowWithNodes } from "./lifecycle.repository";
import { NODE_SEQUENCE } from "./node-status";

export interface LifecycleNodeTimeTrack {
  plannedAt: Date | null;
  estimatedAt: Date | null;
  actualAt: Date | null;
}

export type LifecycleNodeTimeFact = Pick<
  LifecycleDateFactProjectionRecord,
  | "nodeCode"
  | "eventCode"
  | "timeKind"
  | "occurredAt"
  | "verificationState"
  | "confidenceState"
  | "validity"
  | "applicationState"
  | "authorityPolicyRef"
>;

export interface LifecycleNodeFactsInput {
  facts: readonly LifecycleNodeTimeFact[];
}

export interface LifecycleNodeProjection {
  nodeInstanceId: string;
  nodeCode: LifecycleNodeCode;
  sequence: number;
  state: string;
  applicability: NodeApplicability;
  completedAt: Date | null;
  blockedReasonRefs: string[];
  isCurrent: boolean;
  times: LifecycleNodeTimeTrack;
}

export interface LifecycleNodesView {
  flow: {
    id: string;
    state: string;
    currentNodeCode: string;
    version: number;
  } | null;
  nodes: LifecycleNodeProjection[];
}

function sequenceOf(nodeCode: LifecycleNodeCode): number {
  return NODE_SEQUENCE[nodeCode] ?? Number.MAX_SAFE_INTEGER;
}

export function projectLifecycleNodes(
  flow: FlowWithNodes | null,
  input: LifecycleNodeFactsInput = { facts: [] },
): LifecycleNodesView {
  if (!flow) {
    return { flow: null, nodes: [] };
  }

  const timesByNode = projectNodeTimeTracks(input.facts);
  const nodes = flow.nodes
    .map((node) => ({
      nodeInstanceId: node.id,
      nodeCode: node.nodeCode,
      sequence: sequenceOf(node.nodeCode),
      state: node.state,
      applicability: node.applicability,
      completedAt: node.completedAt,
      blockedReasonRefs: node.blockedReasonRefs ?? [],
      isCurrent: node.nodeCode === flow.flow.currentNodeCode,
      times: timesByNode.get(node.nodeCode) ?? emptyTimeTrack(),
    }))
    .sort((left, right) => {
      if (left.sequence !== right.sequence) {
        return left.sequence - right.sequence;
      }
      return left.nodeInstanceId.localeCompare(right.nodeInstanceId);
    });

  return {
    flow: {
      id: flow.flow.id,
      state: flow.flow.state,
      currentNodeCode: flow.flow.currentNodeCode,
      version: flow.flow.version,
    },
    nodes,
  };
}

const completionNodesByEvent = new Map<string, readonly LifecycleNodeCode[]>(
  canonicalEvents.map((event) => [
    event.eventCode,
    event.completionEligibleNodeCodes as LifecycleNodeCode[],
  ]),
);

function projectNodeTimeTracks(
  facts: readonly LifecycleNodeTimeFact[],
): Map<LifecycleNodeCode, LifecycleNodeTimeTrack> {
  const candidates = new Map<
    string,
    { nodeCode: LifecycleNodeCode; timeKind: string; occurredAt: Date }[]
  >();

  for (const fact of facts) {
    if (!isEligibleSummaryFact(fact)) continue;
    for (const targetNodeCode of completionNodesByEvent.get(fact.eventCode) ??
      []) {
      const key = `${targetNodeCode}:${fact.timeKind}`;
      const slot = candidates.get(key) ?? [];
      slot.push({
        nodeCode: targetNodeCode,
        timeKind: fact.timeKind,
        occurredAt: fact.occurredAt,
      });
      candidates.set(key, slot);
    }
  }

  const result = new Map<LifecycleNodeCode, LifecycleNodeTimeTrack>();
  for (const slot of candidates.values()) {
    // 摘要槽不能表达多事件/航段歧义；留空比按查询顺序猜测更可靠。
    if (slot.length !== 1) continue;
    const [fact] = slot;
    if (!fact) continue;
    const track = result.get(fact.nodeCode) ?? emptyTimeTrack();
    if (fact.timeKind === "planned") track.plannedAt = fact.occurredAt;
    if (fact.timeKind === "estimated") track.estimatedAt = fact.occurredAt;
    if (fact.timeKind === "actual") track.actualAt = fact.occurredAt;
    result.set(fact.nodeCode, track);
  }
  return result;
}

function isEligibleSummaryFact(fact: LifecycleNodeTimeFact): boolean {
  if (fact.validity !== "effective") return false;
  if ((completionNodesByEvent.get(fact.eventCode)?.length ?? 0) === 0) {
    return false;
  }
  if (fact.timeKind !== "actual") return true;
  return (
    fact.verificationState === "verified" &&
    fact.confidenceState === "confirmed" &&
    fact.authorityPolicyRef !== null &&
    isAcceptedActualApplicationState(fact.applicationState)
  );
}

function isAcceptedActualApplicationState(
  state: LifecycleDateApplicationState,
): boolean {
  return (
    state === "pending_application" ||
    state === "applied" ||
    state === "rejected"
  );
}

function emptyTimeTrack(): LifecycleNodeTimeTrack {
  return { plannedAt: null, estimatedAt: null, actualAt: null };
}
