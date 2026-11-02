import { describe, expect, it } from "vitest";
import { buildOceanFocus } from "./ocean-operations-focus";
import type { SourceObservation } from "./ocean-operations-source-review";

const eta: SourceObservation = {
  id: "lifecycle:eta",
  semanticKey: "arrived",
  nodeCode: "destination_arrival",
  segmentId: null,
  unlocode: "USSAV",
  sourceSystem: "retained",
  sourceVersion: "v1",
  parseState: "valid",
  sourcePrecision: "date-only",
  rawValue: "2026-11-01",
  normalizedValue: "2026-11-01T05:00:00Z",
  timeKind: "estimated",
  evidenceRefs: [],
  isCurrent: true,
  conflict: false,
};
const input = () => ({
  shipmentLinked: true,
  actualDepartureAt: "2026-09-23T02:00:00Z",
  observations: [eta],
  history: [] as SourceObservation[],
});

describe("ocean focus", () => {
  it("returns five concerns without manufacturing approval tasks or missing ATA", () => {
    const result = buildOceanFocus(input());
    expect(result.map((item) => item.code)).toEqual([
      "progress",
      "arrival_change",
      "route_risk",
      "information",
      "coordination",
    ]);
    expect(result.filter((item) => item.status === "attention")).toEqual([]);
    expect(result[0]?.evidence).toContain("实际离港：2026-09-23T02:00:00Z");
    expect(result[1]?.summary).toContain("2026-11-01");
    expect(result[1]?.summary).toContain("没有可比前值");
    expect(result[4]?.summary).toContain(
      "不以海运判断或接收回执作为准备工作的开工许可",
    );
  });

  it("compares only an explicit correction of the same destination event", () => {
    const current = {
      ...eta,
      id: "lifecycle:new",
      supersedesObservationId: eta.id,
      rawValue: "2026-11-03",
      normalizedValue: "2026-11-03T05:00:00Z",
    };
    const result = buildOceanFocus({
      ...input(),
      observations: [current],
      history: [eta],
    });
    expect(result[1]?.evidence).toContain(
      "预计抵港由 2026-11-01 更新为 2026-11-03",
    );
    expect(result[1]?.status).toBe("information");
    expect(result[1]?.trigger).toBeNull();
    const differentPort = buildOceanFocus({
      ...input(),
      observations: [current],
      history: [{ ...eta, unlocode: "USNYC" }],
    });
    expect(differentPort[1]?.summary).toContain("没有可比前值");
  });

  it("does not confuse estimated and actual events or unknown contexts with conflicts", () => {
    const result = buildOceanFocus({
      ...input(),
      observations: [
        eta,
        { ...eta, id: "actual", timeKind: "actual", rawValue: "2026-11-02" },
        {
          ...eta,
          id: "transit",
          nodeCode: "transit_arrival",
          rawValue: "2026-10-18",
        },
      ],
    });
    expect(result[3]?.status).toBe("information");
    expect(result[3]?.trigger).toBeNull();
  });

  it("reports a source review signal as pending information, not a proved transport exception", () => {
    const result = buildOceanFocus({
      ...input(),
      observations: [{ ...eta, reviewRequired: true }],
    });
    expect(result[3]?.status).toBe("attention");
    expect(result[3]?.summary).toContain("待核");
    expect(result[2]?.status).toBe("unavailable");
    expect(result[3]?.actions).toContain("view_sources");
  });

  it("requires comparable event context before identifying differing observations", () => {
    const other = {
      ...eta,
      id: "other",
      rawValue: "2026-11-04",
      normalizedValue: "2026-11-04T05:00:00Z",
    };
    expect(
      buildOceanFocus({ ...input(), observations: [eta, other] })[3]?.status,
    ).toBe("attention");
    expect(
      buildOceanFocus({
        ...input(),
        observations: [eta, { ...other, segmentId: "other-leg" }],
      })[3]?.status,
    ).toBe("information");
    expect(
      buildOceanFocus({
        ...input(),
        observations: [
          { ...eta, unlocode: null },
          { ...other, unlocode: null },
        ],
      })[3]?.status,
    ).toBe("information");
  });

  it("does not hide useful dates when the shipment association needs checking", () => {
    const result = buildOceanFocus({ ...input(), shipmentLinked: false });
    expect(result[3]?.status).toBe("attention");
    expect(result[1]?.summary).toContain("2026-11-01");
    expect(result[4]?.status).toBe("unavailable");
  });
});
