import { describe, expect, it } from "vitest";
import {
  WorkSessionConflictError,
  contextKeyOf,
  prepareWorkSessionActivation,
} from "./work-session";

const HANDOFF_ID = "22222222-2222-4222-8222-222222222222";
const CONTAINER_ID = "44444444-4444-4444-8444-444444444444";
const TASK_ID = "55555555-5555-4555-8555-555555555555";

describe("contextKeyOf", () => {
  it("canonicalizes product selection without UI anchors in identity", () => {
    expect(
      contextKeyOf({ kind: "product_selection.v1", handoffId: HANDOFF_ID }),
    ).toBe(`product_selection|product_initiative_handoff:${HANDOFF_ID}`);
  });

  it("canonicalizes stuffing by container and task", () => {
    expect(
      contextKeyOf({
        kind: "stuffing.v1",
        containerId: CONTAINER_ID,
        taskId: TASK_ID,
      }),
    ).toBe(`stuffing|container:${CONTAINER_ID}|task:${TASK_ID}`);
  });
});

describe("prepareWorkSessionActivation", () => {
  it("rejects stale work-session versions", () => {
    expect(() =>
      prepareWorkSessionActivation(
        { sourceVersion: 4, targetVersion: 7, targetStatus: "resumable" },
        {
          expectedSourceSessionVersion: 3,
          expectedTargetSessionVersion: 7,
          sourceStatus: "resumable",
          domainVersionSeen: 2,
        },
      ),
    ).toThrowError(
      new WorkSessionConflictError("WORK_SESSION_VERSION_CONFLICT"),
    );
  });

  it("rejects closed targets", () => {
    expect(() =>
      prepareWorkSessionActivation(
        { sourceVersion: 4, targetVersion: 7, targetStatus: "closed" },
        {
          expectedSourceSessionVersion: 4,
          expectedTargetSessionVersion: 7,
          sourceStatus: "resumable",
          domainVersionSeen: 2,
        },
      ),
    ).toThrowError(new WorkSessionConflictError("WORK_SESSION_TARGET_CLOSED"));
  });
});
