import { describe, expect, it } from "vitest";
import {
  catalogStubWorkbenchStages,
  getDownstreamWorkbenchStages,
  getInboundWorkbenchRelations,
  getWorkbenchStage,
  getOutboundWorkbenchRelations,
  getUpstreamWorkbenchStages,
  isProductionMaturity,
  mainWorkbenchChain,
  supportingWorkbenches,
  workbenchBaseline,
  workbenchRelations,
  workbenchStage,
  workbenchStages,
} from "./workbenchNetwork";

describe("workbench catalog", () => {
  it("keeps the approved 23-workbench baseline and unique catalog identities", () => {
    expect(workbenchBaseline).toEqual({
      version: "2026-10-03",
      total: 23,
      main: 20,
      support: 3,
    });
    expect(mainWorkbenchChain).toHaveLength(20);
    expect(supportingWorkbenches.map(({ code }) => code)).toEqual([
      "compliance_operations",
      "charges",
      "exceptions",
    ]);
    expect(new Set(workbenchStages.map(({ code }) => code)).size).toBe(23);
    expect(new Set(workbenchStages.map(({ path }) => path)).size).toBe(23);
    expect(mainWorkbenchChain.map(({ sequence }) => sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
    expect(
      supportingWorkbenches.every(({ sequence }) => sequence === null),
    ).toBe(true);
  });

  it("records the approved titles and catalog-only surfaces without promoting runtime capability", () => {
    expect(workbenchStage("customs")?.title).toBe("进口清关");
    expect(workbenchStage("booking")).toMatchObject({
      path: "/workspaces/booking",
      assessmentState: "assessed",
      maturity: "planned",
      surface: "catalog_stub",
    });
    expect(workbenchStage("export_customs")).toMatchObject({
      path: "/workspaces/export-customs",
      assessmentState: "assessed",
      maturity: "planned",
      surface: "catalog_stub",
    });
    expect(workbenchStage("compliance_operations")).toMatchObject({
      path: "/workspaces/compliance-operations",
      assessmentState: "assessed",
      maturity: "planned",
      surface: "catalog_stub",
    });
    expect(
      workbenchStages
        .filter(
          ({ assessmentState }) => assessmentState === "pending_assessment",
        )
        .every(
          ({ maturity, surface }) =>
            maturity === null && surface === "dedicated",
        ),
    ).toBe(true);
    expect(isProductionMaturity(null)).toBe(false);
    expect(isProductionMaturity("planned")).toBe(false);
    expect(isProductionMaturity("facts_only")).toBe(false);
    expect(isProductionMaturity("operational")).toBe(true);
    expect(isProductionMaturity("validated")).toBe(true);
  });

  it("resolves runtime lookup through the typed catalog", () => {
    expect(getWorkbenchStage("cargo_ready")).toMatchObject({
      assessmentState: "pending_assessment",
      maturity: null,
    });
    expect(getWorkbenchStage("booking")).toMatchObject({
      assessmentState: "assessed",
      maturity: "planned",
      surface: "catalog_stub",
    });
    expect(getWorkbenchStage("unknown_workbench")).toBeUndefined();
  });

  it("exposes exactly the catalog-only workbenches for later consumers", () => {
    expect(catalogStubWorkbenchStages.map(({ code }) => code)).toEqual([
      "booking",
      "export_customs",
      "compliance_operations",
    ]);
  });

  it("models the approved fan-in and fan-out dependencies", () => {
    const relationPairs = workbenchRelations.map(
      ({ from, to }) => `${from}->${to}`,
    );

    expect(relationPairs).toEqual(
      expect.arrayContaining([
        "shipment_planning->booking",
        "shipment_planning->cargo_ready",
        "supply_readiness->cargo_ready",
        "booking->stuffing",
        "cargo_ready->stuffing",
        "booking->export_customs",
        "stuffing->export_customs",
        "booking->dispatch",
        "stuffing->dispatch",
        "export_customs->dispatch",
      ]),
    );
    expect(
      getInboundWorkbenchRelations("dispatch").map(({ from }) => from),
    ).toEqual(
      expect.arrayContaining(["booking", "stuffing", "export_customs"]),
    );
    expect(
      getUpstreamWorkbenchStages("dispatch").map(({ code }) => code),
    ).toEqual(
      expect.arrayContaining(["booking", "stuffing", "export_customs"]),
    );
    expect(
      getDownstreamWorkbenchStages("booking").map(({ code }) => code),
    ).toEqual(
      expect.arrayContaining(["stuffing", "export_customs", "dispatch"]),
    );
    expect(
      getOutboundWorkbenchRelations("booking").every(
        ({ kind, handoffCode }) =>
          kind === "fact_dependency" && handoffCode === null,
      ),
    ).toBe(true);
  });

  it("only relates catalog stages that exist", () => {
    const codes = new Set(workbenchStages.map(({ code }) => code));

    for (const relation of workbenchRelations) {
      expect(codes.has(relation.from)).toBe(true);
      expect(codes.has(relation.to)).toBe(true);
    }
  });
});
