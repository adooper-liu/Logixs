import { describe, expect, it, vi } from "vitest";
import { OceanOperationsSourceReviewService } from "./ocean-operations-source-review.service";

function setup() {
  const projection = {
    container: {
      id: "c1",
      number: "MEDU7620177",
      typeCode: "40HQ",
      status: "in_transit",
    },
    shipment: {
      carrier: "MSC",
      origin: { code: "CNFOC", name: "福州" },
      destination: { code: "USSAV", name: "萨凡纳" },
    },
  };
  const repository = { getProjection: vi.fn().mockResolvedValue(projection) };
  const baseline = {
    readBaseline: vi.fn().mockResolvedValue({
      release: { version: "1.1.0" },
      carriers: [
        {
          canonicalCode: "MSC",
          nameZh: "地中海航运",
          nameEn: "Mediterranean Shipping Company",
        },
      ],
      containerTypes: [{ canonicalCode: "40HC", length: 40, typeCode: "HC" }],
    }),
  };
  const ports = {
    findByUnlocodes: vi.fn().mockResolvedValue([
      {
        unlocode: "USSAV",
        officialName: "Savannah",
        nameChinese: "萨凡纳",
        nameChineseState: "confirmed",
      },
    ]),
  };
  const mappings = {
    resolve: vi.fn().mockResolvedValue({ status: "pending_review" }),
  };
  const deadlines = {
    execute: vi.fn().mockResolvedValue({
      stage: "before_arrival",
      items: [],
      pickup: {
        state: "incomplete",
        date: null,
        nature: null,
        limitingStandardIds: [],
        issues: ["NO_MATCHING_STANDARD"],
      },
      return: {
        state: "incomplete",
        date: null,
        nature: null,
        limitingStandardIds: [],
        issues: ["NO_MATCHING_STANDARD"],
      },
    }),
  };
  const service = new OceanOperationsSourceReviewService(
    repository as never,
    baseline as never,
    ports as never,
    mappings as never,
    deadlines as never,
  );
  return {
    service,
    projection,
    repository,
    baseline,
    ports,
    mappings,
    deadlines,
  };
}
describe("ocean standard consumption", () => {
  it("exposes deadline gaps and serialized business dates from the public computation port", async () => {
    const { service, deadlines } = setup();
    deadlines.execute.mockResolvedValueOnce({
      stage: "before_arrival",
      items: [],
      pickup: {
        state: "complete",
        date: new Date("2026-11-05T00:00:00Z"),
        nature: "estimated",
        limitingStandardIds: ["dem"],
        issues: [],
      },
      return: {
        state: "incomplete",
        date: null,
        nature: null,
        limitingStandardIds: [],
        issues: ["MISSING_ESTIMATED_PICKUP"],
      },
    } as never);
    const result = await service.getProjection("tenant", "c1");
    expect(result.deadlines.pickup).toMatchObject({
      date: "2026-11-05",
      nature: "estimated",
      state: "complete",
    });
    expect(result.deadlines.return.issues).toContain(
      "MISSING_ESTIMATED_PICKUP",
    );
  });
  it("retains transport facts if fee computation is unavailable", async () => {
    const { service, deadlines } = setup();
    deadlines.execute.mockRejectedValueOnce(
      new Error("database connection details must not escape"),
    );
    const result = await service.getProjection("tenant", "c1");
    expect(result.container.number).toBe("MEDU7620177");
    expect(result.deadlines.pickup.issues).toContain(
      "DEADLINE_COMPUTATION_UNAVAILABLE",
    );
    expect(JSON.stringify(result.deadlines)).not.toContain(
      "database connection",
    );
  });
  it("explains MSC from master data while preserving unconfirmed type and port codes", async () => {
    const { service, projection } = setup();
    const result = await service.getProjection("tenant", "c1");
    expect(result.standards.carrier).toMatchObject({
      rawCode: "MSC",
      name: "地中海航运",
      status: "recognized",
      version: "1.1.0",
    });
    expect(result.standards.containerType).toMatchObject({
      rawCode: "40HQ",
      status: "pending_review",
      canonicalCode: null,
    });
    expect(result.standards.origin).toMatchObject({
      rawCode: "CNFOC",
      status: "unrecognized",
      canonicalCode: null,
    });
    expect(result.standards.destination).toMatchObject({
      rawCode: "USSAV",
      name: "萨凡纳",
      status: "recognized",
    });
    expect(result.container.typeCode).toBe("40HQ");
    expect(projection.shipment.origin.code).toBe("CNFOC");
  });
  it("recognizes exact internal type without asking a supplier mapping to approve it", async () => {
    const { service, projection, mappings } = setup();
    projection.container.typeCode = "40HC";
    const result = await service.getProjection("tenant", "c1");
    expect(result.standards.containerType).toMatchObject({
      rawCode: "40HC",
      canonicalCode: "40HC",
      status: "recognized",
      name: "40HC",
    });
    expect(mappings.resolve).not.toHaveBeenCalled();
  });
  it("keeps facts available when standard catalogs fail", async () => {
    const { service, baseline, ports } = setup();
    baseline.readBaseline.mockRejectedValueOnce(new Error("catalog offline"));
    ports.findByUnlocodes.mockRejectedValueOnce(
      new Error("port catalog offline"),
    );
    const result = await service.getProjection("tenant", "c1");
    expect(result.container.number).toBe("MEDU7620177");
    expect(result.standards.carrier.status).toBe("unavailable");
    expect(result.standards.origin.status).toBe("unavailable");
  });
});
