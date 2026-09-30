import { describe, expect, it } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { OutboxController } from "./outbox.controller";

describe("OutboxController", () => {
  it("死信读取与人工恢复分权", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        OutboxController.prototype.listDeadLettersPage,
      ),
    ).toEqual(["reliability.read"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        OutboxController.prototype.replay,
      ),
    ).toEqual(["reliability.recover"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        OutboxController.prototype.publishBatch,
      ),
    ).toEqual(["reliability.recover"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        OutboxController.prototype.publishDue,
      ),
    ).toEqual(["reliability.recover"]);
  });
});
