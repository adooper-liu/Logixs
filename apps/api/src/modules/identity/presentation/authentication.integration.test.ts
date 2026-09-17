import {
  Controller,
  Get,
  type INestApplication,
  MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IdentityModule } from "../identity.module";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { PublicEndpoint } from "../../../security/route-access.decorator";
import { DevIdentityMiddleware } from "./dev-identity.middleware";

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

@Controller("capability-probe")
class CapabilityProbeController {
  @Get()
  @RequireCapabilities("planning.draft")
  read(): { status: string } {
    return { status: "capable" };
  }
}

@Module({
  imports: [IdentityModule],
  controllers: [
    PrivateProbeController,
    PublicProbeController,
    CapabilityProbeController,
  ],
})
class AuthenticationTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(PrivateProbeController, CapabilityProbeController);
  }
}

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

  it("allows a protected route with an attached development identity", async () => {
    const response = await fetch(`${baseUrl}/private-probe`, {
      headers: {
        "x-tenant-id": "tenant-1",
        "x-operator-id": "operator-1",
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "private" });
  });

  it("allows an explicitly public route", async () => {
    const response = await fetch(`${baseUrl}/public-probe`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "public" });
  });

  it("denies protected writes that declare missing capabilities", async () => {
    const response = await fetch(`${baseUrl}/capability-probe`, {
      headers: {
        "x-tenant-id": "tenant-1",
        "x-operator-id": "operator-1",
        "x-roles": "field_operator",
      },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      message: "CAPABILITY_DENIED",
      statusCode: 403,
    });
  });

  it("allows capability-protected routes when roles grant the capability", async () => {
    const response = await fetch(`${baseUrl}/capability-probe`, {
      headers: {
        "x-tenant-id": "tenant-1",
        "x-operator-id": "operator-1",
        "x-roles": "operations_dispatcher",
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "capable" });
  });
});
