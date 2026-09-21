import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { CUSTOMS_CLEARANCE_CASE_REPOSITORY } from "../domain/customs-clearance-case.repository";
import { GetCustomsClearanceReadinessService } from "./get-customs-clearance-readiness.service";

const evidenceId = "44444444-4444-4444-8444-444444444444";
const releasedCase = {
  caseId: "66666666-6666-4666-8666-666666666666",
  filingState: "accepted",
  decisionState: "released",
  activeHoldCodes: [],
  evidenceRefs: [evidenceId],
};

async function service(current: typeof releasedCase | null = releasedCase) {
  const module = await Test.createTestingModule({
    providers: [
      GetCustomsClearanceReadinessService,
      {
        provide: CUSTOMS_CLEARANCE_CASE_REPOSITORY,
        useValue: { findCurrent: vi.fn().mockResolvedValue(current) },
      },
    ],
  }).compile();
  return module.get(GetCustomsClearanceReadinessService);
}

describe("GetCustomsClearanceReadinessService", () => {
  it("confirms a released case with linked evidence", async () => {
    await expect(
      (await service()).execute({
        tenantId: "tenant-a",
        containerRecordId: "container-1",
        evidenceRefs: [evidenceId],
      }),
    ).resolves.toEqual({
      confirmed: true,
      reasonCode: null,
      caseId: releasedCase.caseId,
    });
  });

  it.each([
    [null, "LIFECYCLE_EVENT_PENDING_CUSTOMS_CASE"],
    [
      { ...releasedCase, filingState: "filed" },
      "LIFECYCLE_EVENT_PENDING_CUSTOMS_FILING_ACCEPTANCE",
    ],
    [
      { ...releasedCase, decisionState: "pending" },
      "LIFECYCLE_EVENT_PENDING_CUSTOMS_RELEASE",
    ],
    [
      {
        ...releasedCase,
        decisionState: "held",
        activeHoldCodes: ["DOCUMENT_REVIEW"],
      },
      "LIFECYCLE_EVENT_PENDING_CUSTOMS_HOLD_RELEASE",
    ],
  ])("reports the business blocker", async (current, reasonCode) => {
    await expect(
      (await service(current as typeof releasedCase | null)).execute({
        tenantId: "tenant-a",
        containerRecordId: "container-1",
        evidenceRefs: [evidenceId],
      }),
    ).resolves.toMatchObject({ confirmed: false, reasonCode });
  });

  it("requires the actual date evidence to be linked to the case", async () => {
    await expect(
      (await service()).execute({
        tenantId: "tenant-a",
        containerRecordId: "container-1",
        evidenceRefs: ["77777777-7777-4777-8777-777777777777"],
      }),
    ).resolves.toMatchObject({
      confirmed: false,
      reasonCode: "LIFECYCLE_EVENT_PENDING_CUSTOMS_EVIDENCE",
    });
  });
});
