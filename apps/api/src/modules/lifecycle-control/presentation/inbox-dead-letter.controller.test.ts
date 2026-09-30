import { describe, expect, it } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { InboxDeadLetterController } from "./inbox-dead-letter.controller";

describe("InboxDeadLetterController", () => {
  it("死信读取与重放分权", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        InboxDeadLetterController.prototype.listDeadLettersPage,
      ),
    ).toEqual(["reliability.read"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        InboxDeadLetterController.prototype.replay,
      ),
    ).toEqual(["reliability.recover"]);
  });
});
