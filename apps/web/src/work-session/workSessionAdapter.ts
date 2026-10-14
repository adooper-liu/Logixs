import type { WorkSessionStatusV1, WorkSessionV1 } from "@logix/contracts";

export type DirtyChoice = "save" | "discard" | "stay" | "new-tab";
export type SourceSessionStatus = Exclude<
  WorkSessionStatusV1,
  "current" | "closed"
>;

export type SourceSettlement =
  | { kind: "ready"; sourceStatus: SourceSessionStatus }
  | { kind: "needs-choice"; choices: readonly DirtyChoice[] }
  | { kind: "failed"; message: string };

export type TargetValidation =
  | { kind: "ready"; domainVersionSeen: number | null }
  | { kind: "failed"; message: string };

export interface WorkSessionSwitchAdapter {
  settleBeforeLeave(intent: "switch" | "new-tab"): Promise<SourceSettlement>;
  validateTarget(session: WorkSessionV1): Promise<TargetValidation>;
  restorePointer(session: WorkSessionV1): Promise<void>;
}
