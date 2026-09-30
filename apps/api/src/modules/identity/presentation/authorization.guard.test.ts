import "reflect-metadata";
import { type ExecutionContext, Logger } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUserIdentity } from "../domain/authenticated-user-identity";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import {
  PUBLIC_ENDPOINT_KEY,
  SERVICE_ENDPOINT_KEY,
} from "../../../security/route-access.decorator";
import { AuthorizationForbiddenException } from "./authorization-forbidden.exception";
import { AuthorizationGuard } from "./authorization.guard";

describe("AuthorizationGuard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails closed for user endpoints without any access metadata", () => {
    const warn = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);
    function unclassified() {
      return undefined;
    }
    const guard = new AuthorizationGuard(new Reflector());

    expect(() =>
      guard.canActivate(
        context({ identity: user(["planning.read"]) }, unclassified),
      ),
    ).toThrow(AuthorizationForbiddenException);
    expect(warn).toHaveBeenCalledWith(
      "ROUTE_ACCESS_METADATA_MISSING TestController.unclassified",
    );
  });

  it("fails closed when capability metadata is declared empty", () => {
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const handler = () => undefined;
    Reflect.defineMetadata(REQUIRED_CAPABILITIES_KEY, [], handler);
    const guard = new AuthorizationGuard(new Reflector());

    expect(() =>
      guard.canActivate(context({ identity: user([]) }, handler)),
    ).toThrow(AuthorizationForbiddenException);
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

  it("allows service endpoints without a user identity or capabilities", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(SERVICE_ENDPOINT_KEY, true, handler);
    const guard = new AuthorizationGuard(new Reflector());
    expect(
      guard.canActivate(
        context(
          {
            serviceIdentity: {
              actorType: "service",
              serviceId: "svc",
              actorId: "service:svc",
            },
          },
          handler,
        ),
      ),
    ).toBe(true);
  });

  it("rejects missing capabilities with the dedicated authorization exception", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(
      REQUIRED_CAPABILITIES_KEY,
      ["planning.draft"],
      handler,
    );
    const guard = new AuthorizationGuard(new Reflector());
    expect(() =>
      guard.canActivate(context({ identity: user(["task.execute"]) }, handler)),
    ).toThrow(AuthorizationForbiddenException);
  });

  it("rejects capability-protected endpoints when no user identity is attached", () => {
    const handler = () => undefined;
    Reflect.defineMetadata(
      REQUIRED_CAPABILITIES_KEY,
      ["planning.read"],
      handler,
    );
    const guard = new AuthorizationGuard(new Reflector());
    expect(() => guard.canActivate(context({}, handler))).toThrow(
      AuthorizationForbiddenException,
    );
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
          { identity: user(["planning.read", "planning.draft"]) },
          handler,
        ),
      ),
    ).toBe(true);
  });

  it("honours class-level capability metadata", () => {
    const handler = () => undefined;
    class CapabilityController {}
    Reflect.defineMetadata(
      REQUIRED_CAPABILITIES_KEY,
      ["planning.read"],
      CapabilityController,
    );
    const guard = new AuthorizationGuard(new Reflector());
    expect(
      guard.canActivate(
        context(
          { identity: user(["planning.read"]) },
          handler,
          CapabilityController,
        ),
      ),
    ).toBe(true);
  });
});

function user(capabilities: string[]): AuthenticatedUserIdentity {
  return {
    actorType: "user",
    actorId: "op-1",
    tenantId: "t1",
    authenticationMethod: "development_headers",
    roles: [],
    capabilities,
  };
}

function context(
  request: Record<string, unknown>,
  handler: (...args: never[]) => unknown = () => undefined,
  controller: new () => unknown = class TestController {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => undefined,
      getNext: () => undefined,
    }),
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;
}
