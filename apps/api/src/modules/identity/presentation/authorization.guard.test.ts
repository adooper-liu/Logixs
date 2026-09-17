import "reflect-metadata";
import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { PUBLIC_ENDPOINT_KEY } from "../../../security/route-access.decorator";
import { AuthorizationGuard } from "./authorization.guard";

describe("AuthorizationGuard", () => {
  it("skips endpoints without required capabilities", () => {
    const guard = new AuthorizationGuard(new Reflector());
    expect(guard.canActivate(context({}))).toBe(true);
  });

  it("allows public endpoints even when capabilities are declared", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(PUBLIC_ENDPOINT_KEY, true, handler);
    Reflect.defineMetadata(
      REQUIRED_CAPABILITIES_KEY,
      ["planning.draft"],
      handler,
    );
    const guard = new AuthorizationGuard(new Reflector());
    expect(guard.canActivate(context({}, handler))).toBe(true);
  });

  it("rejects missing capabilities with a stable error code", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(
      REQUIRED_CAPABILITIES_KEY,
      ["planning.draft"],
      handler,
    );
    const guard = new AuthorizationGuard(new Reflector());
    expect(() =>
      guard.canActivate(
        context(
          {
            identity: {
              actorType: "user",
              actorId: "op-1",
              tenantId: "t1",
              authenticationMethod: "development_headers",
              roles: ["field_operator"],
              capabilities: ["task.execute"],
            },
          },
          handler,
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it("allows actors that hold every required capability", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(
      REQUIRED_CAPABILITIES_KEY,
      ["planning.read", "planning.draft"],
      handler,
    );
    const guard = new AuthorizationGuard(new Reflector());
    expect(
      guard.canActivate(
        context(
          {
            identity: {
              actorType: "user",
              actorId: "op-1",
              tenantId: "t1",
              authenticationMethod: "development_headers",
              roles: ["operations_dispatcher"],
              capabilities: ["planning.read", "planning.draft"],
            },
          },
          handler,
        ),
      ),
    ).toBe(true);
  });
});

function context(
  request: Record<string, unknown>,
  handler: (...args: never[]) => unknown = () => undefined,
): ExecutionContext {
  class TestController {}
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => undefined,
      getNext: () => undefined,
    }),
    getHandler: () => handler,
    getClass: () => TestController,
  } as unknown as ExecutionContext;
}
