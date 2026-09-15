import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isEvidenceUuid,
  registerAndVerifyFloorEvidence,
  resolveCompleteEvidenceRefs,
} from "./evidence";

afterEach(() => {
  vi.unstubAllGlobals();
});

const CONTAINER = "10000000-0000-4000-8000-000000000001";
const EVIDENCE = "11111111-1111-4111-8111-111111111111";

describe("resolveCompleteEvidenceRefs", () => {
  it("清关不强制证据，只转发 UUID", async () => {
    await expect(
      resolveCompleteEvidenceRefs({
        nodeCode: "customs_clearance",
        containerId: CONTAINER,
        raw: "",
      }),
    ).resolves.toEqual([]);
    await expect(
      resolveCompleteEvidenceRefs({
        nodeCode: "customs_clearance",
        containerId: CONTAINER,
        raw: `PACK-1 ${EVIDENCE}`,
      }),
    ).resolves.toEqual([EVIDENCE]);
  });

  it("装箱空单证直接 EVIDENCE_REQUIRED", async () => {
    await expect(
      resolveCompleteEvidenceRefs({
        nodeCode: "container_stuffing",
        containerId: CONTAINER,
        raw: "  ",
      }),
    ).rejects.toThrow("EVIDENCE_REQUIRED");
  });

  it("装箱已是 UUID 则不登记", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      resolveCompleteEvidenceRefs({
        nodeCode: "container_stuffing",
        containerId: CONTAINER,
        raw: EVIDENCE,
      }),
    ).resolves.toEqual([EVIDENCE]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("装箱单证编号会先登记再核验", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === "/api/evidence") {
        return {
          ok: true,
          json: async () => ({ evidenceId: EVIDENCE }),
        };
      }
      return {
        ok: true,
        json: async () => ({ evidenceId: EVIDENCE }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      resolveCompleteEvidenceRefs({
        nodeCode: "container_stuffing",
        containerId: CONTAINER,
        raw: "PACK-88",
      }),
    ).resolves.toEqual([EVIDENCE]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/evidence");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      `/api/evidence/${EVIDENCE}/verify`,
    );
  });
});

describe("registerAndVerifyFloorEvidence", () => {
  it("登记失败不继续核验", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          statusCode: 400,
          message: "VALIDATION_FORMAT: subjectId 必须是 UUID",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      registerAndVerifyFloorEvidence("c1", "PACK-1"),
    ).rejects.toThrow("登记证据失败（400）：VALIDATION_FORMAT: subjectId 必须是 UUID");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("isEvidenceUuid", () => {
  it("只认 UUID", () => {
    expect(isEvidenceUuid(EVIDENCE)).toBe(true);
    expect(isEvidenceUuid("PACK-1")).toBe(false);
  });
});
