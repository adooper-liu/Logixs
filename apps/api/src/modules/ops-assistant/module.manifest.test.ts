import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../security/require-capabilities.decorator";
import { moduleManifest } from "./module.manifest";
import { OpsAssistantController } from "./presentation/ops-assistant.controller";
import { TaskActionCandidateController } from "./presentation/task-action-candidate.controller";

describe("ops-assistant module manifest", () => {
  it("declares the exact capability union used by its controllers", () => {
    const routeCapabilities = new Set(
      [OpsAssistantController, TaskActionCandidateController].flatMap(
        controllerCapabilities,
      ),
    );

    expect(moduleManifest.permissions).toEqual([
      "notification.read",
      "task.read",
      "task.execute",
    ]);
    expect([...routeCapabilities].sort()).toEqual(
      [...moduleManifest.permissions].sort(),
    );
  });
});

function controllerCapabilities(controller: { prototype: object }): string[] {
  return Object.getOwnPropertyNames(controller.prototype).flatMap((name) => {
    const handler = Reflect.get(controller.prototype, name) as unknown;
    if (typeof handler !== "function") return [];
    return (
      (Reflect.getMetadata(REQUIRED_CAPABILITIES_KEY, handler) as string[]) ??
      []
    );
  });
}
