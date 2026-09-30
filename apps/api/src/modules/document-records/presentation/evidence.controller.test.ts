import { describe, expect, it } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { EvidenceController } from "./evidence.controller";

describe("EvidenceController", () => {
  it("登记与核验使用不同能力，不把核验并进提交", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        EvidenceController.prototype.register,
      ),
    ).toEqual(["evidence.submit"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        EvidenceController.prototype.verify,
      ),
    ).toEqual(["evidence.review"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        EvidenceController.prototype.reject,
      ),
    ).toEqual(["evidence.review"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        EvidenceController.prototype.revoke,
      ),
    ).toEqual(["evidence.review"]);
  });
});
