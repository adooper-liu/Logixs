import type { WorkSessionRouteContextV1 } from "@logix/contracts";
import type { RouteLocationRaw } from "vue-router";

interface RouteLike {
  path: string;
  query: Record<string, unknown>;
}

export function parseRouteContext(route: RouteLike): WorkSessionRouteContextV1 {
  if (route.path === "/workspaces/product-selection") {
    assertOnlyKeys(route.query, ["handoffId"]);
    return {
      kind: "product_selection.v1",
      handoffId: uuid(route.query.handoffId),
    };
  }
  if (route.path === "/workspaces/stuffing") {
    assertOnlyKeys(route.query, ["containerId", "taskId"]);
    return {
      kind: "stuffing.v1",
      containerId: uuid(route.query.containerId),
      taskId: uuid(route.query.taskId),
    };
  }
  reject();
}

export function toRouteLocation(
  context: WorkSessionRouteContextV1,
): RouteLocationRaw & RouteLike {
  switch (context.kind) {
    case "product_selection.v1":
      return {
        path: "/workspaces/product-selection",
        query: { handoffId: context.handoffId },
      };
    case "stuffing.v1":
      return {
        path: "/workspaces/stuffing",
        query: { containerId: context.containerId, taskId: context.taskId },
      };
  }
}

function assertOnlyKeys(query: Record<string, unknown>, allowed: string[]) {
  const keys = Object.keys(query).sort();
  if (
    keys.length !== allowed.length ||
    keys.some((key) => !allowed.includes(key))
  ) {
    reject();
  }
}

function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) reject();
  return value.toLowerCase();
}

function reject(): never {
  throw new Error("WORK_SESSION_ROUTE_CONTEXT_REJECTED");
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
