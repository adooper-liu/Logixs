import { describe, expect, it, vi } from "vitest";
import { OceanOperationsSourceReviewService } from "./ocean-operations-source-review.service";

function setup() {
  const projection = { container: { id: "c1", number: "MEDU7620177", typeCode: "40HQ", status: "in_transit" }, shipment: { carrier: "MSC", origin: { code: "CNFOC", name: "福州" }, destination: { code: "USSAV", name: "萨凡纳" } } };
  const repository = { getProjection: vi.fn().mockResolvedValue(projection) };
  const baseline = { readBaseline: vi.fn().mockResolvedValue({ release: { version: "1.1.0" }, carriers: [{ canonicalCode: "MSC", nameZh: "地中海航运", nameEn: "Mediterranean Shipping Company" }], containerTypes: [{ canonicalCode: "40HC", length: 40, typeCode: "HC" }] }) };
  const ports = { findByUnlocodes: vi.fn().mockResolvedValue([{ unlocode: "USSAV", officialName: "Savannah", nameChinese: "萨凡纳", nameChineseState: "confirmed" }]) };
  const mappings = { resolve: vi.fn().mockResolvedValue({ status: "pending_review" }) };
  const service = new OceanOperationsSourceReviewService(repository as never, baseline as never, ports as never, mappings as never);
  return { service, projection, repository, baseline, ports, mappings };
}
describe("ocean standard consumption", () => {
  it("explains MSC from master data while preserving unconfirmed type and port codes", async () => {
    const { service, projection } = setup();
    const result = await service.getProjection("tenant", "c1");
    expect(result.standards.carrier).toMatchObject({ rawCode: "MSC", name: "地中海航运", status: "recognized", version: "1.1.0" });
    expect(result.standards.containerType).toMatchObject({ rawCode: "40HQ", status: "pending_review", canonicalCode: null });
    expect(result.standards.origin).toMatchObject({ rawCode: "CNFOC", status: "unrecognized", canonicalCode: null });
    expect(result.standards.destination).toMatchObject({ rawCode: "USSAV", name: "萨凡纳", status: "recognized" });
    expect(result.container.typeCode).toBe("40HQ");
    expect(projection.shipment.origin.code).toBe("CNFOC");
  });
  it("recognizes exact internal type without asking a supplier mapping to approve it", async () => {
    const { service, projection, mappings } = setup();
    projection.container.typeCode = "40HC";
    const result = await service.getProjection("tenant", "c1");
    expect(result.standards.containerType).toMatchObject({ rawCode: "40HC", canonicalCode: "40HC", status: "recognized", name: "40HC" });
    expect(mappings.resolve).not.toHaveBeenCalled();
  });
  it("keeps facts available when standard catalogs fail", async () => {
    const { service, baseline, ports } = setup();
    baseline.readBaseline.mockRejectedValueOnce(new Error("catalog offline"));
    ports.findByUnlocodes.mockRejectedValueOnce(new Error("port catalog offline"));
    const result = await service.getProjection("tenant", "c1");
    expect(result.container.number).toBe("MEDU7620177");
    expect(result.standards.carrier.status).toBe("unavailable");
    expect(result.standards.origin.status).toBe("unavailable");
  });
});
