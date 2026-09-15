import { describe, expect, it } from "vitest";
import { completionRequiresEvidence } from "./completionEvidencePolicy";

describe("completionRequiresEvidence", () => {
  it("只有会发规范事件的三站强制证据", () => {
    expect(completionRequiresEvidence("container_stuffing")).toBe(true);
    expect(completionRequiresEvidence("shipment_dispatch")).toBe(true);
    expect(completionRequiresEvidence("origin_departure")).toBe(true);
    expect(completionRequiresEvidence("customs_clearance")).toBe(false);
    expect(completionRequiresEvidence("cargo_ready")).toBe(false);
  });
});
