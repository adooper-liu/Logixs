import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  Controller,
  ForbiddenException,
  Get,
  type INestApplication,
  MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import commonSchema from "@logix/contracts/schemas/v1/common.schema.json";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "../../../config/env";
import { IdentityModule } from "../identity.module";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import {
  PublicEndpoint,
  ServiceEndpoint,
} from "../../../security/route-access.decorator";
import { DevIdentityMiddleware } from "./dev-identity.middleware";
import { DevServiceIdentityMiddleware } from "./dev-service-identity.middleware";

const errorResponseSchema = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      "../../../../../../packages/contracts/schemas/v1/error-response.schema.json",
    ),
    "utf8",
  ),
) as object;

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(commonSchema);
const validateErrorResponse = ajv.compile(errorResponseSchema);

@Controller("private-probe")
class PrivateProbeController {
  @Get()
  read(): { status: string } {
    return { status: "private" };
  }
}

@PublicEndpoint()
@Controller("public-probe")
class PublicProbeController {
  @Get()
  read(): { status: string } {
    return { status: "public" };
  }
}

@ServiceEndpoint()
@Controller("service-probe")
class ServiceProbeController {
  @Get()
  read(): { status: string } {
    return { status: "service" };
  }
}

@Controller("capability-probe")
class CapabilityProbeController {
  @Get()
  @RequireCapabilities("planning.draft")
  read(): { status: string } {
    return { status: "capable" };
  }
}

@Controller("scope-probe")
class ScopeProbeController {
  @Get()
  @RequireCapabilities("planning.read")
  read(): never {
    throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
  }
}

@Module({
  imports: [IdentityModule],
  controllers: [
    PrivateProbeController,
    PublicProbeController,
    ServiceProbeController,
    CapabilityProbeController,
    ScopeProbeController,
  ],
})
class AuthenticationTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(
        PrivateProbeController,
        CapabilityProbeController,
        ScopeProbeController,
      );
    consumer
      .apply(DevServiceIdentityMiddleware)
      .forRoutes(ServiceProbeController);
  }
}

const operatorHeaders = {
  "x-tenant-id": "tenant-1",
  "x-operator-id": "operator-1",
};

describe("IdentityModule authentication boundary", () => {
  let app: INestApplication | undefined;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthenticationTestModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("denies an unmarked route by default", async () => {
    const response = await fetch(`${baseUrl}/private-probe`);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      message: "AUTHENTICATION_REQUIRED",
      statusCode: 401,
    });
  });

  it("fails closed on an unclassified route even with an attached identity", async () => {
    const response = await fetch(`${baseUrl}/private-probe`, {
      headers: { ...operatorHeaders, "x-roles": "operations_dispatcher" },
    });

    expect(response.status).toBe(403);
    expectAuthorizationForbidden(await response.text());
  });

  it("allows an explicitly public route", async () => {
    const response = await fetch(`${baseUrl}/public-probe`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "public" });
  });

  it("allows a service-only route for an authenticated service identity", async () => {
    const response = await fetch(`${baseUrl}/service-probe`, {
      headers: {
        "x-service-id": config.serviceId,
        "x-service-key": config.serviceKey,
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "service" });
  });

  it("denies routes whose declared capabilities the actor lacks", async () => {
    const response = await fetch(`${baseUrl}/capability-probe`, {
      headers: { ...operatorHeaders, "x-roles": "field_operator" },
    });

    expect(response.status).toBe(403);
    expectAuthorizationForbidden(await response.text());
  });

  it("does not trust a client-supplied trace id", async () => {
    const response = await fetch(`${baseUrl}/capability-probe`, {
      headers: {
        ...operatorHeaders,
        "x-roles": "field_operator",
        "x-trace-id": "client-chosen-trace",
        traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
      },
    });

    expect(response.status).toBe(403);
    const body = expectAuthorizationForbidden(await response.text());
    expect(body.traceId).not.toBe("client-chosen-trace");
    expect(body.traceId).not.toContain("0af7651916cd43dd8448eb211c80319c");
  });

  it("allows capability-protected routes when roles grant the capability", async () => {
    const response = await fetch(`${baseUrl}/capability-probe`, {
      headers: { ...operatorHeaders, "x-roles": "operations_dispatcher" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "capable" });
  });

  it("leaves other forbidden semantics untouched", async () => {
    const response = await fetch(`${baseUrl}/scope-probe`, {
      headers: { ...operatorHeaders, "x-roles": "operations_dispatcher" },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      message: "AUTHORIZATION_SCOPE_DENIED",
      statusCode: 403,
    });
  });
});

function expectAuthorizationForbidden(raw: string): {
  traceId: string;
  timestamp: string;
} {
  const body = JSON.parse(raw) as { traceId: string; timestamp: string };
  const valid = validateErrorResponse(body);
  expect(valid, JSON.stringify(validateErrorResponse.errors)).toBe(true);
  expect(body).toStrictEqual({
    success: false,
    error: {
      code: "AUTHORIZATION_FORBIDDEN",
      message: "You do not have permission to perform this action.",
      category: "authorization",
      retryable: false,
      details: [],
    },
    traceId: expect.any(String),
    timestamp: expect.any(String),
  });
  expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  for (const secret of [
    "Controller",
    "ProbeController",
    "read",
    "planning.draft",
    "field_operator",
    "operations_dispatcher",
    "stack",
  ]) {
    expect(raw).not.toContain(secret);
  }
  return body;
}
