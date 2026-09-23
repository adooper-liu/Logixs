import {
  ForbiddenException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AssertEvidenceAvailableService } from "./assert-evidence-available.service";

const qualified = {
  id: "evidence-1",
  tenantId: "tenant-1",
  verificationState: "verified",
  validity: "effective",
};

describe("AssertEvidenceAvailableService", () => {
  it("accepts verified effective evidence in the authenticated tenant", async () => {
    const repository = { findByIds: vi.fn().mockResolvedValue([qualified]) };
    const service = new AssertEvidenceAvailableService(repository as never);

    await service.execute({
      tenantId: "tenant-1",
      evidenceIds: ["evidence-1"],
    });

    expect(repository.findByIds).toHaveBeenCalledWith(["evidence-1"]);
  });

  it("rejects cross-tenant evidence", async () => {
    const repository = { findByIds: vi.fn().mockResolvedValue([qualified]) };
    const service = new AssertEvidenceAvailableService(repository as never);
    await expect(
      service.execute({ tenantId: "tenant-2", evidenceIds: ["evidence-1"] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects missing or unqualified evidence", async () => {
    const repository = { findByIds: vi.fn().mockResolvedValue([]) };
    const service = new AssertEvidenceAvailableService(repository as never);
    await expect(
      service.execute({ tenantId: "tenant-1", evidenceIds: ["missing"] }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
