import { describe, expect, it } from "vitest";
import { parseRouteContext, toRouteLocation } from "./routeContext";

const HANDOFF_ID = "22222222-2222-4222-8222-222222222222";
const CONTAINER_ID = "44444444-4444-4444-8444-444444444444";
const TASK_ID = "55555555-5555-4555-8555-555555555555";

describe("routeContext", () => {
  it("accepts only the allowlisted product selection pointer", () => {
    expect(
      parseRouteContext({
        path: "/workspaces/product-selection",
        query: { handoffId: HANDOFF_ID },
      }),
    ).toEqual({ kind: "product_selection.v1", handoffId: HANDOFF_ID });
  });

  it("rejects extra query fields instead of persisting a free route", () => {
    expect(() =>
      parseRouteContext({
        path: "/workspaces/product-selection",
        query: { handoffId: HANDOFF_ID, redirect: "https://evil.example" },
      }),
    ).toThrow("WORK_SESSION_ROUTE_CONTEXT_REJECTED");
  });

  it("round trips the stuffing route", () => {
    const context = {
      kind: "stuffing.v1" as const,
      containerId: CONTAINER_ID,
      taskId: TASK_ID,
    };
    expect(parseRouteContext(toRouteLocation(context))).toEqual(context);
  });
});
