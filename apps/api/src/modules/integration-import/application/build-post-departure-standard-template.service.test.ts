import { describe, expect, it, vi } from "vitest";
import { BuildPostDepartureStandardTemplateService } from "./build-post-departure-standard-template.service";

describe("BuildPostDepartureStandardTemplateService", () => {
  it("builds the workbook from the active reference catalog snapshot", async () => {
    const snapshot = {
      countryReleaseVersion: "iso-test",
      portReleaseVersion: "unlocode-test",
      countries: [
        {
          code: "US",
          name: "United States of America",
          nameChinese: "美国",
        },
      ],
      ports: [
        {
          code: "USLAX",
          name: "Los Angeles",
          nameChinese: "洛杉矶",
          nameChineseState: "confirmed" as const,
          countryCode: "US",
          countryNameChinese: "美国",
        },
      ],
    };
    const referenceLocations = {
      listActive: vi.fn().mockResolvedValue(snapshot),
    };
    const service = new BuildPostDepartureStandardTemplateService(
      referenceLocations,
    );

    const result = await service.execute();

    expect(result).toBeInstanceOf(Buffer);
    expect(referenceLocations.listActive).toHaveBeenCalledOnce();
  });
});
