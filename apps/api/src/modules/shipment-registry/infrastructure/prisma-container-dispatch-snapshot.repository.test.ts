import { describe, expect, it, vi } from "vitest";
import { PrismaContainerDispatchSnapshotRepository } from "./prisma-container-dispatch-snapshot.repository";

describe("PrismaContainerDispatchSnapshotRepository read scope", () => {
  it("does not pass readiness evidence into Prisma findCurrent filters", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new PrismaContainerDispatchSnapshotRepository({
      containerDispatchSnapshot: { findFirst },
    } as never);
    const input = {
      tenantId: "demo",
      containerRecordId: "container",
      evidenceRefs: ["evidence"],
    };
    await repository.findCurrent(input);
    expect(findFirst.mock.calls[0]?.[0].where).toEqual({
      tenantId: "demo",
      containerRecordId: "container",
      state: "active",
    });
  });
});
