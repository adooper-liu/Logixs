import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { CONTAINER_REPOSITORY } from "../domain/container.repository";
import { AssertContainerTenantService } from "./assert-container-tenant.service";

async function buildService(
  repository: Record<string, ReturnType<typeof vi.fn>>,
) {
  const module = await Test.createTestingModule({
    providers: [
      AssertContainerTenantService,
      { provide: CONTAINER_REPOSITORY, useValue: repository },
    ],
  }).compile();
  return module.get(AssertContainerTenantService);
}

describe("AssertContainerTenantService", () => {
  it("货柜不存在 → RESOURCE_NOT_FOUND", async () => {
    const service = await buildService({
      findTenantId: vi.fn().mockResolvedValue(null),
    });
    await expect(
      service.execute({ containerId: "c1", tenantId: "t1" }),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
  });

  it("租户不匹配 → AUTHORIZATION_SCOPE_DENIED", async () => {
    const service = await buildService({
      findTenantId: vi.fn().mockResolvedValue("other"),
    });
    await expect(
      service.execute({ containerId: "c1", tenantId: "t1" }),
    ).rejects.toThrow("AUTHORIZATION_SCOPE_DENIED");
  });

  it("租户匹配放行", async () => {
    const service = await buildService({
      findTenantId: vi.fn().mockResolvedValue("t1"),
    });
    await expect(
      service.execute({ containerId: "c1", tenantId: "t1" }),
    ).resolves.toBeUndefined();
  });
});
