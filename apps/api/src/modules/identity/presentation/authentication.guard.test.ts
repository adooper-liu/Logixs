import "reflect-metadata";
import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticationConfig } from "../../../config/env";
import type { UserTokenVerifier } from "../domain/user-token-verifier";
import { AuthenticationGuard } from "./authentication.guard";
import {
  PUBLIC_ENDPOINT_KEY,
  SERVICE_ENDPOINT_KEY,
} from "../../../security/route-access.decorator";

const oidcConfig: AuthenticationConfig = {
  mode: "oidc",
  issuerUrl: "https://id.example.test/realms/logix",
  audience: "logix-api",
  jwksUrl: "https://id.example.test/realms/logix/certs",
  tenantClaim: "tenant_id",
};

describe("AuthenticationGuard", () => {
  it("allows only explicitly public endpoints without an identity", async () => {
    const handler = () => undefined;
    Reflect.defineMetadata(PUBLIC_ENDPOINT_KEY, true, handler);
    const guard = createGuard(oidcConfig);

    await expect(guard.canActivate(context({}, handler))).resolves.toBe(true);
    await expect(guard.canActivate(context({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("accepts an attached development identity only in development mode", async () => {
    const identity = {
      actorType: "user" as const,
      actorId: "operator-1",
      tenantId: "tenant-1",
      authenticationMethod: "development_headers" as const,
    };
    const developmentGuard = createGuard({ mode: "development" });
    const oidcGuard = createGuard(oidcConfig);

    await expect(
      developmentGuard.canActivate(context({ identity })),
    ).resolves.toBe(true);
    await expect(
      oidcGuard.canActivate(
        context({
          identity,
          headers: { "x-tenant-id": "spoofed-tenant" },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("verifies a Bearer token and replaces any spoofed request identity", async () => {
    const verifiedIdentity = {
      actorType: "user" as const,
      actorId: "user-1",
      tenantId: "tenant-1",
      authenticationMethod: "oidc" as const,
    };
    const verifier: UserTokenVerifier = {
      verify: vi.fn().mockResolvedValue(verifiedIdentity),
    };
    const guard = new AuthenticationGuard(
      new Reflector(),
      oidcConfig,
      verifier,
    );
    const request = {
      headers: { authorization: "Bearer signed-token" },
      identity: {
        actorType: "user" as const,
        actorId: "spoofed-user",
        tenantId: "spoofed-tenant",
        authenticationMethod: "development_headers" as const,
      },
    };

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(verifier.verify).toHaveBeenCalledWith("signed-token");
    expect(request.identity).toEqual(verifiedIdentity);
  });

  it("keeps service endpoints separate from user Bearer authentication", async () => {
    const handler = () => undefined;
    Reflect.defineMetadata(SERVICE_ENDPOINT_KEY, true, handler);
    const verifier: UserTokenVerifier = {
      verify: vi.fn().mockResolvedValue({
        actorType: "user",
        actorId: "user-1",
        tenantId: "tenant-1",
        authenticationMethod: "oidc",
      }),
    };
    const guard = new AuthenticationGuard(
      new Reflector(),
      oidcConfig,
      verifier,
    );

    await expect(
      guard.canActivate(
        context({ headers: { authorization: "Bearer signed-token" } }, handler),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      guard.canActivate(
        context(
          {
            serviceIdentity: {
              actorType: "service",
              actorId: "service:publisher",
            },
          },
          handler,
        ),
      ),
    ).resolves.toBe(true);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it("fails closed when an endpoint is marked as both public and service-only", async () => {
    const handler = () => undefined;
    Reflect.defineMetadata(PUBLIC_ENDPOINT_KEY, true, handler);
    Reflect.defineMetadata(SERVICE_ENDPOINT_KEY, true, handler);
    const guard = createGuard(oidcConfig);

    await expect(
      guard.canActivate(
        context(
          {
            serviceIdentity: {
              actorType: "service",
              actorId: "service:publisher",
            },
          },
          handler,
        ),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

function createGuard(config: AuthenticationConfig): AuthenticationGuard {
  return new AuthenticationGuard(new Reflector(), config, {
    verify: vi.fn().mockRejectedValue(new Error("invalid token")),
  });
}

function context(
  request: Record<string, unknown>,
  handler: () => unknown = () => undefined,
): ExecutionContext {
  class TestController {}
  return {
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => undefined,
      getNext: () => undefined,
    }),
  } as unknown as ExecutionContext;
}
