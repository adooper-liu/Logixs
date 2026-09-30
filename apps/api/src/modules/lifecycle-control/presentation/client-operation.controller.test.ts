import { describe, expect, it } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { ClientOperationController } from "./client-operation.controller";

describe("ClientOperationController", () => {
  it("读取、恢复和提交使用不同能力", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ClientOperationController.prototype.list,
      ),
    ).toEqual(["reliability.read"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ClientOperationController.prototype.getById,
      ),
    ).toEqual(["reliability.read"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ClientOperationController.prototype.listCompensationsPage,
      ),
    ).toEqual(["reliability.read"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ClientOperationController.prototype.getCompensationById,
      ),
    ).toEqual(["reliability.read"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ClientOperationController.prototype.compensate,
      ),
    ).toEqual(["reliability.recover"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ClientOperationController.prototype.resolve,
      ),
    ).toEqual(["reliability.recover"]);
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ClientOperationController.prototype.submit,
      ),
    ).toEqual(["lifecycle.operate"]);
  });
});
