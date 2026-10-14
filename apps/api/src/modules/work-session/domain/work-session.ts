import type {
  WorkSessionRouteContextV1,
  WorkSessionStatusV1,
} from "@logix/contracts";

export type WorkSessionSourceStatus = Exclude<
  WorkSessionStatusV1,
  "current" | "closed"
>;

export interface CurrentWorkSessionActivationState {
  sourceVersion: number;
  targetVersion: number;
  targetStatus: WorkSessionStatusV1;
}

export interface WorkSessionActivationInput {
  expectedSourceSessionVersion: number;
  expectedTargetSessionVersion: number;
  sourceStatus: WorkSessionSourceStatus;
  domainVersionSeen: number | null;
}

export class WorkSessionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkSessionConflictError";
  }
}

export function contextKeyOf(context: WorkSessionRouteContextV1): string {
  switch (context.kind) {
    case "product_selection.v1":
      return `product_selection|product_initiative_handoff:${uuid(context.handoffId)}`;
    case "stuffing.v1":
      return `stuffing|container:${uuid(context.containerId)}|task:${uuid(context.taskId)}`;
  }
}

export function prepareWorkSessionActivation(
  current: CurrentWorkSessionActivationState,
  input: WorkSessionActivationInput,
): WorkSessionActivationInput {
  if (
    current.sourceVersion !== input.expectedSourceSessionVersion ||
    current.targetVersion !== input.expectedTargetSessionVersion
  ) {
    conflict("WORK_SESSION_VERSION_CONFLICT");
  }
  if (current.targetStatus === "closed") {
    conflict("WORK_SESSION_TARGET_CLOSED");
  }
  return input;
}

function uuid(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new Error("VALIDATION_FORMAT: id");
  return value.toLowerCase();
}

function conflict(code: string): never {
  throw new WorkSessionConflictError(code);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
